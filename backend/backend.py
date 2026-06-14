"""
Iris AI Backend — backend.py

Purpose
- Main FastAPI API surface for most backend routes (auth, chat, admin, orders, returns).
- Houses core services used by the routes:
  - JWT auth helpers (get_current_user, get_admin_user)
  - OllamaService wrapper (generate JSON + plain text)
  - RAGService for SOP/policy retrieval (ChromaDB)
  - SOP ingestion helpers (extract_text, chunk_text, ingest_sop_file)
  - UnifiedAIService for structured JSON orchestration
  - ReturnValidator for eligibility validation using policy + AI

Everything except main.py and database.py lives here:


  • JWT auth middleware + helpers           (get_current_user, get_admin_user)
  • OllamaService                           (LLM wrapper)
  • RAGService                              (ChromaDB retrieval)
  • SOP ingestion helpers                   (extract_text, chunk_text, ingest_sop_file)
  • UnifiedAIService                        (JSON-structured AI calls)
  • CustomerContextService                  (order fetch helper)
  • ReturnValidator                         (policy + AI return validation)
  • All FastAPI APIRouters:
      auth_router   → /api/auth/*
      chat_router   → /api/chat/*
      admin_router  → /api/admin/*
      orders_router → /api/orders/*
      returns_router→ /api/returns/*

RAG data paths:
  rag_data/chroma_db/   — ChromaDB persistent store
  rag_data/uploads/     — raw SOP / policy files
"""

# ── stdlib & third-party ──────────────────────────────────────────────────────
import asyncio, csv, json, logging, re, uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sentence_transformers import SentenceTransformer
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
import chromadb
from chromadb.config import Settings
import os

load_dotenv()
logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent
RAG_DIR     = BASE_DIR / "rag_data"
CHROMA_DIR  = RAG_DIR  / "chroma_db"
UPLOAD_DIR  = RAG_DIR  / "uploads"

for _d in [RAG_DIR, CHROMA_DIR, UPLOAD_DIR]:
    _d.mkdir(parents=True, exist_ok=True)

# ── DB session (imported from database.py) ────────────────────────────────────
from database import get_db, User


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════════════════

SECRET_KEY                  = os.getenv("SECRET_KEY", "fallback-secret-key")
ALGORITHM                   = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

pwd_context    = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme  = HTTPBearer()


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire    = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload  = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise exc
    except JWTError:
        raise exc

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user   = result.scalar_one_or_none()
    if user is None:
        raise exc
    return user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ═══════════════════════════════════════════════════════════════════════════════
# OLLAMA SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

OLLAMA_BASE_URL  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
PREFERRED_MODELS = [
    "llama3.1", "llama3", "llama3:8b", "llama3.1:8b", "llama3.2", "llama3.2:3b",
    "mistral", "mistral:7b", "gemma2", "gemma2:9b", "phi3", "phi3:mini",
    "deepseek-r1", "qwen2.5", "codellama",
]

OLLAMA_SYSTEM_PROMPT = """
You are Iris, a premium AI assistant for an ecommerce platform.
Rules:
- Use retrieved RAG context as primary truth.
- Answer directly from uploaded SOPs and available documents.
- Use the customer's actual order history when discussing returns, tracking, or purchases.
- Never invent order information.
- Prefer concise factual answers.
- If context does not contain the answer, say so clearly.
"""


class OllamaService:
    def __init__(self):
        self._available_models: List[str] = []
        self._active_model:     Optional[str] = None
        self._is_running:       bool = False

    async def check_connection(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    self._available_models = [m["name"] for m in data.get("models", [])]
                    self._is_running = True
                    self._select_best_model()
                    return True
        except Exception as e:
            logger.info(f"Ollama not available: {e}")
        self._is_running = False
        return False

    def _select_best_model(self):
        if not self._available_models:
            return
        for preferred in PREFERRED_MODELS:
            for available in self._available_models:
                if preferred.lower() in available.lower():
                    self._active_model = available
                    return
        self._active_model = self._available_models[0]

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        model: Optional[str] = None,
        conversation_history: Optional[List[dict]] = None,
        context: str = "",
    ) -> str:
        if not self._is_running:
            await self.check_connection()
        if not self._is_running:
            raise RuntimeError("Ollama is not running")

        use_model = model or self._active_model
        if not use_model:
            raise RuntimeError("No Ollama model available")

        system   = self._build_system(system_prompt, context)
        messages = [{"role": "system", "content": system}]
        if conversation_history:
            for msg in conversation_history[-10:]:
                messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model":   use_model,
                    "messages": messages,
                    "stream":   False,
                    "options": {"temperature": 0.7, "top_p": 0.9, "repeat_penalty": 1.1, "num_ctx": 4096},
                },
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]

    # Alias kept for compatibility with chat router
    async def generate_response(self, prompt: str, system: str = "", session_id=None) -> str:
        return await self.generate(prompt=prompt, system_prompt=system)

    def _build_system(self, base: str, context: str) -> str:
        parts = [base or OLLAMA_SYSTEM_PROMPT]
        if context:
            parts.append(
                "\n--- CONTEXT (customer data + knowledge base) ---\n"
                + context
                + "\n--- END CONTEXT ---"
            )
        return "\n\n".join(parts)

    @property
    def is_running(self)       -> bool:            return self._is_running
    @property
    def active_model(self)     -> Optional[str]:   return self._active_model
    @property
    def available_models(self) -> List[str]:       return self._available_models


ollama_service = OllamaService()

# ── Damage-verification constants ─────────────────────────────────────────────
OLLAMA_VISION_URL   = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_VISION_MODEL = "iris-damage"   # ollama create iris-damage -f Modelfile


def _extract_base64(data_url: str) -> str:
    """Strip 'data:image/...;base64,' prefix and return raw base64."""
    if "," in data_url:
        return data_url.split(",", 1)[1]
    return data_url


async def _get_recommendations_for_session(session_id: str, db: AsyncSession) -> list:
    """
    Return product recommendations based on the customer's past purchase categories.
    Queries your existing orders + browsing_history tables.
    """
    try:
        rows = (await db.execute(
            text("""
                SELECT DISTINCT b.category
                FROM return_sessions rs
                JOIN orders o ON o.order_id = rs.order_id
                JOIN browsing_history b ON b.customer_id = o.customer_id
                WHERE rs.session_id = :s
                ORDER BY b.category
                LIMIT 5
            """),
            {"s": session_id},
        )).fetchall()

        categories = [r[0] for r in rows if r[0]]

        if not categories:
            return []

        # Fetch top-rated products in those categories
        placeholders = ", ".join(f":cat{i}" for i in range(len(categories)))
        params       = {f"cat{i}": c for i, c in enumerate(categories)}
        params["lim"] = 3

        products = (await db.execute(
            text(f"""
                SELECT DISTINCT ON (b.product_name) b.product_name, o.total_amount, o.currency, o.category
                FROM browsing_history b
                JOIN orders o ON o.customer_id = b.customer_id
                               AND LOWER(o.product_name) ILIKE LOWER(b.product_name)
                WHERE LOWER(b.category) IN ({placeholders})
                  AND o.status = 'delivered'
                ORDER BY b.product_name, o.ordered_at DESC
                LIMIT :lim
            """),
            params,
        )).fetchall()

        recs = []
        for p in products:
            recs.append({
                "name":   p[0],
                "price":  f"{p[2]} {p[1]}" if p[1] else "Price unavailable",
                "reason": f"Based on your interest in {p[3]}",
            })
        return recs

    except Exception as e:
        logger.warning(f"_get_recommendations_for_session failed: {e}")
        return []


async def _get_amazon_recs(product_name: str, count: int = 3) -> list:
    """Generate realistic Amazon.in style recommendations for a given product name."""
    q_enc  = product_name.replace(" ", "+")
    prompt = (
        f"Generate {count} realistic Amazon.in product recommendations for '{product_name}'. "
        f"Return ONLY a JSON array, no markdown:\n"
        f'[{{"name":"Full Product Name","price":"₹X,XXX","rating":"4.3","url":"https://www.amazon.in/s?k={q_enc}"}}]'
    )
    try:
        raw     = await ollama_service.generate(prompt=prompt, system_prompt="You are a JSON API. Return ONLY valid JSON array. No markdown.")
        cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()
        recs    = json.loads(cleaned)
        for r in recs:
            if not str(r.get("url", "")).startswith("http"):
                r["url"] = f"https://www.amazon.in/s?k={r.get('name', product_name).replace(' ', '+')}"
        return recs[:count]
    except Exception:
        return [{"name": product_name, "price": "See Amazon", "rating": "—", "url": f"https://www.amazon.in/s?k={q_enc}"}]


async def _get_comparison_recs(reference_product: str, category: str, count: int = 2):
    """
    Generate `count` similar alternatives to `reference_product` (in `category`),
    along with a spec-by-spec comparison against `reference_product`.
    Returns (recommendations, specs, reference_price, reference_rating).
    """
    q_enc  = reference_product.replace(" ", "+")
    prompt = (
        f"The customer is interested in '{reference_product}' (category: {category}). "
        f"Generate {count} similar alternatives on Amazon.in with a spec comparison. "
        f"Return ONLY JSON, no markdown:\n"
        f'{{"recommendations":[{{"name":"...","price":"₹X,XXX","rating":"4.2","url":"https://www.amazon.in/s?k=..."}}],'
        f'"specs":[{{"label":"Battery Life","ordered":"20hrs","alternatives":["30hrs","25hrs"]}}],'
        f'"ordered_price":"₹X,XXX","ordered_rating":"4.1"}}'
    )
    try:
        raw     = await ollama_service.generate(prompt=prompt, system_prompt="You are a JSON API. Return ONLY valid JSON. No markdown.")
        cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()
        result  = json.loads(cleaned)
        recs    = result.get("recommendations", [])
        for r in recs:
            if not str(r.get("url", "")).startswith("http"):
                r["url"] = f"https://www.amazon.in/s?k={r.get('name', reference_product).replace(' ', '+')}"
        return recs[:count], result.get("specs", []), result.get("ordered_price", ""), result.get("ordered_rating", "")
    except Exception:
        return ([{"name": f"Alternative to {reference_product}", "price": "See Amazon", "rating": "—",
                  "url": f"https://www.amazon.in/s?k={q_enc}"}], [], "", "")


# ═══════════════════════════════════════════════════════════════════════════════
# RAG SERVICE  (ChromaDB — SOP-only)
# ═══════════════════════════════════════════════════════════════════════════════

class RAGService:
    COLLECTION_NAME = "sop_knowledge"
    EMBED_MODEL     = "all-MiniLM-L6-v2"
    TOP_K           = 5

    def __init__(self):
        self._ready         = False
        self._embed_model   = None
        self._chroma_client = None
        self._collection    = None
        self._init_lock     = asyncio.Lock()

    async def initialize(self):
        async with self._init_lock:
            if self._ready:
                return
            logger.info("🔄 Initialising RAG pipeline (SOP mode)...")
            try:
                await asyncio.get_event_loop().run_in_executor(None, self._load_embed_model)
                self._setup_chroma()
                logger.info(f"✅ RAG ready — {self._collection.count()} SOP chunks in ChromaDB")
                self._ready = True
            except Exception as e:
                logger.error(f"❌ RAG init error: {e}")

    def _load_embed_model(self):
        self._embed_model = SentenceTransformer(self.EMBED_MODEL)

    def _setup_chroma(self):
        self._chroma_client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
        self._collection = self._chroma_client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    def ingest_chunks(self, documents: List[str], metadatas: List[dict], ids: List[str]):
        if not self._ready or not self._embed_model:
            raise RuntimeError("RAG service not initialised")
        BATCH = 64
        for i in range(0, len(documents), BATCH):
            b_docs, b_meta, b_ids = documents[i:i+BATCH], metadatas[i:i+BATCH], ids[i:i+BATCH]
            b_embs = self._embed_model.encode(b_docs, show_progress_bar=False).tolist()
            self._collection.upsert(ids=b_ids, documents=b_docs, embeddings=b_embs, metadatas=b_meta)
        logger.info(f"Ingested {len(documents)} SOP chunks")

    def retrieve(self, query: str, top_k: int = None) -> List[Dict]:
        if not self._ready or not self._embed_model or not self._collection:
            return []
        try:
            k   = top_k or self.TOP_K
            cnt = self._collection.count()
            if cnt == 0:
                return []
            q_emb   = self._embed_model.encode([query]).tolist()
            results = self._collection.query(
                query_embeddings=q_emb, n_results=min(k, cnt),
                include=["documents", "metadatas", "distances"],
            )
            retrieved = []
            for doc, meta, dist in zip(
                results["documents"][0], results["metadatas"][0], results["distances"][0]
            ):
                score = 1 - dist
                if score > 0.20:
                    retrieved.append({"text": doc, "source": meta.get("source", "SOP"), "score": round(score, 3)})
            return retrieved
        except Exception as e:
            logger.error(f"Retrieval error: {e}")
            return []

    def build_context(self, query: str, top_k: int = None) -> Tuple[str, List[str]]:
        chunks = self.retrieve(query, top_k)
        if not chunks:
            return "", []
        parts, sources, seen = [], [], set()
        for i, c in enumerate(chunks, 1):
            parts.append(f"[Policy Reference {i} — {c['source']}]\n{c['text']}")
            if c["source"] not in seen:
                sources.append(c["source"]); seen.add(c["source"])
        context = (
            "RELEVANT POLICY / SOP CONTENT\n"
            "==============================\n"
            + "\n\n".join(parts)
            + "\n=============================="
        )
        return context, sources

    @property
    def is_ready(self) -> bool: return self._ready

    def stats(self) -> dict:
        if self._collection:
            return {"chunks": self._collection.count(), "model": self.EMBED_MODEL,
                    "ready": self._ready, "collection": self.COLLECTION_NAME}
        return {"chunks": 0, "model": self.EMBED_MODEL, "ready": False}


rag_service = RAGService()


# ═══════════════════════════════════════════════════════════════════════════════
# SOP INGESTION HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def extract_text(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    if ext in (".txt", ".md"):
        return open(file_path, "r", encoding="utf-8", errors="ignore").read()

    elif ext == ".pdf":
        import PyPDF2
        text = ""
        with open(file_path, "rb") as f:
            for page in PyPDF2.PdfReader(f).pages:
                t = page.extract_text()
                if t: text += t + "\n"
        return text

    elif ext == ".docx":
        import docx
        doc = docx.Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    elif ext == ".json":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            data = json.load(f)
        return _flatten_json(data)

    elif ext == ".csv":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            rows = list(csv.DictReader(f))
        return "\n".join(" | ".join(f"{k}: {v}" for k, v in row.items()) for row in rows)

    elif ext in (".xlsx", ".xls"):
        import pandas as pd
        df_dict = pd.read_excel(file_path, sheet_name=None)
        lines = []
        for sheet, df in df_dict.items():
            lines.append(f"=== Sheet: {sheet} ===")
            for _, row in df.iterrows():
                lines.append(" | ".join(f"{col}: {val}" for col, val in row.items() if str(val) != "nan"))
        return "\n".join(lines)

    elif ext in (".jpg", ".jpeg", ".png"):
        try:
            from PIL import Image
            img = Image.open(file_path)
            return (f"Image file: {Path(file_path).name}\n"
                    f"Format: {img.format}, Size: {img.size[0]}x{img.size[1]}px\n"
                    "This image has been uploaded to the knowledge base.")
        except Exception:
            return f"Image uploaded: {Path(file_path).name}"

    elif ext == ".svg":
        content = open(file_path, "r", encoding="utf-8", errors="ignore").read()
        text    = re.sub(r"<[^>]+>", " ", content)
        text    = re.sub(r"\s+", " ", text).strip()
        return f"SVG file: {Path(file_path).name}\nContent: {text[:2000]}"

    raise ValueError(f"Unsupported file type: {ext}")


def _flatten_json(data, prefix="", depth=0) -> str:
    if depth > 6: return str(data)
    lines = []
    if isinstance(data, dict):
        for k, v in data.items():
            key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, (dict, list)):
                lines.append(f"{key}:")
                lines.append(_flatten_json(v, key, depth + 1))
            else:
                lines.append(f"{key}: {v}")
    elif isinstance(data, list):
        for i, item in enumerate(data[:200]):
            lines.append(_flatten_json(item, f"{prefix}[{i}]", depth + 1))
    else:
        lines.append(str(data))
    return "\n".join(lines)


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    chunks, start = [], 0
    while start < len(text):
        chunk = text[start:start + chunk_size].strip()
        if chunk: chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


async def ingest_sop_file(file_path: str, _rag_service) -> int:
    try:
        raw_text = extract_text(file_path)
    except Exception as e:
        logger.error(f"Text extraction failed for {file_path}: {e}"); return 0
    if not raw_text.strip():
        logger.warning(f"No text extracted from {file_path}"); return 0
    chunks = chunk_text(raw_text)
    if not chunks: return 0
    source_name = Path(file_path).name
    documents, metadatas, ids = [], [], []
    for chunk in chunks:
        documents.append(chunk)
        metadatas.append({"source": source_name, "type": "sop", "ext": Path(file_path).suffix.lower()})
        ids.append(str(uuid.uuid4()))
    try:
        _rag_service.ingest_chunks(documents, metadatas, ids)
        return len(chunks)
    except Exception as e:
        logger.error(f"ChromaDB ingest failed for {source_name}: {e}"); return 0


# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED AI SERVICE  (structured JSON responses)
# ═══════════════════════════════════════════════════════════════════════════════

class UnifiedAIService:
    async def generate_json(self, prompt: str) -> Dict[str, Any]:
        system_prompt = "You are a JSON API. Return ONLY valid JSON. No markdown, no explanation."
        try:
            raw = await ollama_service.generate(prompt=prompt, system_prompt=system_prompt)
            clean = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(clean)
            approved = result.get("approved", False) and result.get("risk") != "high"
            return {
                "type": "return_resolution" if approved else "return_rejected",
                "approved": approved,
                "confidence": result.get("confidence", 0.0),
                "risk": result.get("risk", "high"),
                "requires_manual_review": result.get("requires_manual_review", False),
                "explanation": result.get("explanation", "No explanation available."),
            }
        except Exception as e:
            logger.error(f"JSON orchestration failed: {e}")
            return {"type": "return_rejected", "approved": False, "confidence": 0.0,
                    "risk": "high", "requires_manual_review": True,
                    "explanation": "Unable to validate return at this time."}

    async def validate_return(self, order_context: Dict[str, Any]) -> Dict[str, Any]:
        prompt = (
            "Analyze this eligible return request. The return policy has already been validated.\n\n"
            f"Order Data:\n{json.dumps(order_context, indent=2)}\n\n"
            "Evaluate: (1) reason consistency, (2) fraud risk.\n"
            "Return JSON ONLY:\n"
            '{"approved": bool, "confidence": float, "risk": "low"|"medium"|"high", '
            '"requires_manual_review": bool, "explanation": "string"}'
        )
        return await self.generate_json(prompt)


unified_ai_service = UnifiedAIService()


# ═══════════════════════════════════════════════════════════════════════════════
# CUSTOMER CONTEXT SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

class CustomerContextService:
    async def get_customer_orders(self, db: AsyncSession, email: str) -> list:
        q = text("""
            SELECT o.order_id, b.product_name, o.total_amount, o.currency,
                   o.status, o.ordered_at, o.category
            FROM orders o
            JOIN browsing_history b
              ON b.customer_id = o.customer_id
             AND b.viewed_at BETWEEN o.ordered_at - INTERVAL '30 days'
                                 AND o.ordered_at + INTERVAL '7 days'
            JOIN customers c ON c.customer_id = o.customer_id
            WHERE c.primary_email = :e OR c.alt_email = :e
            ORDER BY o.ordered_at DESC LIMIT 20
        """)
        result = await db.execute(q, {"e": email})
        rows   = result.fetchall()
        return [
            {
                "order_id": str(row.order_id),
                "name":     row.product_name,
                "price":    f"{row.currency} {row.total_amount}",
                "status":   row.status,
                "label":    f"ordered {row.ordered_at.date()}",
            }
            for row in rows
        ]


customer_context_service = CustomerContextService()


# ═══════════════════════════════════════════════════════════════════════════════
# RETURN VALIDATOR
# ═══════════════════════════════════════════════════════════════════════════════

class ReturnValidator:
    async def validate_return(self, session_id: str, db: AsyncSession):
        session_row = (await db.execute(
            text("SELECT * FROM return_sessions WHERE session_id=:s"), {"s": session_id}
        )).fetchone()
        if not session_row:
            return {"type": "return_rejected", "reason": "Invalid return session"}

        order_row = (await db.execute(
            text("SELECT * FROM orders WHERE order_id=:o"), {"o": session_row.order_id}
        )).fetchone()
        if not order_row:
            return {"type": "return_rejected", "reason": "Order not found"}
        if not order_row.delivered_at:
            return {"type": "return_rejected", "reason": "Order not delivered yet"}

        # Load return policy JSON
        policy_path = UPLOAD_DIR / "return_policy.json"
        if not policy_path.exists():
            # Fall back to legacy path
            policy_path = BASE_DIR / "rag_data" / "uploads" / "return_policy.json"
        if policy_path.exists():
            with open(policy_path) as f:
                policy = json.load(f)
        else:
            policy = {}

        prev_reason = (await db.execute(
            text("SELECT reason FROM return_requests WHERE user_id=:u ORDER BY created_at DESC LIMIT 1"),
            {"u": session_row.user_id},
        )).scalar()

        days_elapsed = (datetime.utcnow().date() - order_row.delivered_at.date()).days
        context = {
            "order_id":       order_row.order_id,
            "product_name":   order_row.product_name or "Unknown Product",
            "category":       order_row.category or "general",
            "reason":         session_row.selected_reason,
            "detailed_reason": session_row.detailed_reason,
            "previous_reason": prev_reason,
            "days_elapsed":   days_elapsed,
            "policy":         policy,
        }

        try:
            ai_result = await unified_ai_service.validate_return(context)
        except Exception:
            ai_result = {"type": "return_rejected", "approved": False, "confidence": 0.0,
                         "risk": "high", "explanation": "Unable to validate return."}

        result_status = "approved" if ai_result.get("approved") else "rejected"

        await db.execute(
            text("""
                UPDATE return_sessions
                   SET status=:status, confidence_score=:confidence,
                       risk_level=:risk, ai_explanation=:explanation
                 WHERE session_id=:s
            """),
            {"status": result_status, "confidence": ai_result.get("confidence"),
             "risk": ai_result.get("risk"), "explanation": ai_result.get("explanation"),
             "s": session_id},
        )

        existing = (await db.execute(
            text("SELECT 1 FROM return_requests WHERE user_id=:u AND order_id=:o LIMIT 1"),
            {"u": session_row.user_id, "o": session_row.order_id},
        )).fetchone()

        if not existing:
            await db.execute(
                text("INSERT INTO return_requests (user_id, order_id, reason, detailed_reason, status) "
                     "VALUES (:u, :o, :r, :dr, :st)"),
                {"u": session_row.user_id, "o": session_row.order_id,
                 "r": session_row.selected_reason, "dr": session_row.detailed_reason,
                 "st": result_status},
            )

        await db.commit()
        return ai_result


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTERS
# ═══════════════════════════════════════════════════════════════════════════════

# ── Pydantic schemas ──────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email:     EmailStr
    username:  str
    full_name: str
    password:  str

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class UserResponse(BaseModel):
    id:        str
    email:     str
    username:  str
    full_name: str
    is_admin:  bool
    class Config: from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str
    user:         UserResponse

class ChatRequest(BaseModel):
    query:      str
    session_id: Optional[str] = None

class ConfirmOrderRequest(BaseModel):
    product_name: str
    price:        str
    brand:        Optional[str] = ""
    quantity:     int = 1

class ConfirmReturnRequest(BaseModel):
    product_name: str
    reason:       Optional[str] = "Customer request"

class StartReturnRequest(BaseModel):
    order_id: int

class ReturnReasonRequest(BaseModel):
    session_id:             str
    reason:                 str
    detailed_reason:        str
    include_recommendations: Optional[bool] = False

class VerifyDamageRequest(BaseModel):
    session_id:      str
    damage_location: str
    images:          List[str]   # base64 data URLs: "data:image/jpeg;base64,..."


# ── Helper ────────────────────────────────────────────────────────────────────
async def _get_customer_id(email: str, db: AsyncSession) -> Optional[str]:
    r = await db.execute(
        text("SELECT customer_id FROM customers WHERE primary_email=:e OR alt_email=:e LIMIT 1"),
        {"e": email},
    )
    row = r.mappings().first()
    return str(row["customer_id"]) if row else None


def _parse_postgres_products(products_str: str) -> list:
    if not products_str: return []
    items = []
    for p in products_str.split(" | "):
        m = re.match(r"^(.*?)\s*\[(.*?)\]$", p.strip())
        if m:
            name  = m.group(1).strip()
            meta  = m.group(2)
            parts = [x.strip() for x in meta.split(",")]
            items.append({
                "name":   name,
                "price":  parts[1] if len(parts) >= 2 else "INR 0.00",
                "status": parts[0] if parts else "delivered",
                "label":  parts[2] if len(parts) >= 3 else "Eligible for return",
            })
    return items


# ──────────────────────────────────────────────────────────────────────────────
# AUTH ROUTER
# ──────────────────────────────────────────────────────────────────────────────
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])


@auth_router.post("/register", response_model=TokenResponse, status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if (await db.execute(select(User).where(User.email == req.email))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    if (await db.execute(select(User).where(User.username == req.username))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    admin_check = await db.execute(
        text("SELECT 1 FROM admins WHERE email = :email LIMIT 1"), {"email": req.email}
    )
    is_admin = admin_check.scalar() is not None

    user = User(
        id=uuid.uuid4(), email=req.email, username=req.username, full_name=req.full_name,
        hashed_password=get_password_hash(req.password), is_admin=is_admin,
    )
    db.add(user); await db.commit(); await db.refresh(user)

    token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(
        access_token=token, token_type="bearer",
        user=UserResponse(id=str(user.id), email=user.email, username=user.username,
                          full_name=user.full_name, is_admin=user.is_admin),
    )


@auth_router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user   = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")

    token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(
        access_token=token, token_type="bearer",
        user=UserResponse(id=str(user.id), email=user.email, username=user.username,
                          full_name=user.full_name, is_admin=user.is_admin),
    )


# ──────────────────────────────────────────────────────────────────────────────
# CHAT ROUTER
# ──────────────────────────────────────────────────────────────────────────────
chat_router = APIRouter(prefix="/chat", tags=["Chat"])


@chat_router.post("/send")
async def send_message(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    u:  User          = Depends(get_current_user),
):
    q = req.query.strip()
    lower = q.lower()

    # ── Fetch customer context ────────────────────────────────────────────
    stmt = text("SELECT ordered_products, full_name FROM customer_360_view WHERE primary_email=:e LIMIT 1")
    res  = await db.execute(stmt, {"e": u.email})
    row  = res.fetchone()
    db_items      = _parse_postgres_products(row[0]) if row else []
    customer_name = row[1] if row else u.full_name

    def reply(content):
        return {"session_id": req.session_id, "message": {"role": "assistant", "content": content}}

    # ── Shortcut: return ──────────────────────────────────────────────────
    if lower == "return":
        return reply(json.dumps({"type": "order_list", "items": db_items}))

    # ── Detect ORDER intent ───────────────────────────────────────────────
    order_keywords = ["order", "buy", "purchase", "want to get", "add to cart", "kharidna", "chahiye", "book"]
    is_order_intent = any(kw in lower for kw in order_keywords)

    if is_order_intent:
        prompt = f"""Customer {customer_name} wants to order something. Their message: "{q}"

Extract the product details and respond ONLY with this JSON (no markdown, no extra text):
{{
  "type": "order_confirm",
  "product_name": "exact product name",
  "brand": "brand if mentioned or empty string",
  "price": "price if mentioned e.g. INR 199 or leave as INR 0.00",
  "qty": 1
}}

If the message is too vague and you cannot identify a product, respond with:
{{"type": "text", "content": "Could you tell me which product you'd like to order and the price?"}}"""

        try:
            raw = await ollama_service.generate(
                prompt=prompt,
                system_prompt="You are a JSON API. Return ONLY valid JSON. No markdown, no explanation.",
            )
            clean = raw.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            return reply(json.dumps(parsed))
        except Exception:
            return reply("Could you tell me which product you'd like to order? Please include the name and price.")

    # ── Detect COMPARE intent ─────────────────────────────────────────────
    compare_keywords = ["compare", "difference between", "vs", "versus", "better", "which one", "comparison"]
    is_compare_intent = any(kw in lower for kw in compare_keywords)

    if is_compare_intent:
        rag_context, _ = rag_service.build_context(q)
        prompt = f"""Customer {customer_name} wants to compare products. Their message: "{q}"

{f'Relevant product info from knowledge base:{chr(10)}{rag_context}' if rag_context else ''}

Respond ONLY with this JSON (no markdown, no extra text):
{{
  "type": "compare_result",
  "items": [
    {{
      "name": "Product A name",
      "price": "price if known",
      "specs": {{
        "key1": "value1",
        "key2": "value2"
      }}
    }},
    {{
      "name": "Product B name",
      "price": "price if known",
      "specs": {{
        "key1": "value1",
        "key2": "value2"
      }}
    }}
  ],
  "recommendation": "Which one you recommend and why in one sentence"
}}

Use real specs if available from context. If not, use general knowledge about the products."""

        try:
            raw = await ollama_service.generate(
                prompt=prompt,
                system_prompt="You are a JSON API. Return ONLY valid JSON. No markdown, no explanation.",
            )
            clean = raw.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            return reply(json.dumps(parsed))
        except Exception:
            pass  # fall through to general AI

    # ── Detect OFFERS / VOUCHERS intent ───────────────────────────────────
    offer_keywords = ["offer", "voucher", "coupon", "discount", "deal", "promo", "code"]
    if any(kw in lower for kw in offer_keywords):
        prompt = f"""Customer {customer_name} is asking about offers, vouchers or coupons. Message: "{q}"
Their order history: {json.dumps(db_items)}

Respond ONLY with this JSON (no markdown, no extra text):
{{
  "type": "offers_list",
  "offers": [
    {{"title": "offer title", "description": "offer detail", "code": "COUPONCODE", "expiry": "date"}},
    {{"title": "offer title", "description": "offer detail", "code": "COUPONCODE2", "expiry": "date"}}
  ]
}}

Create 2-3 relevant offers based on the customer's purchase history."""

        try:
            raw = await ollama_service.generate(
                prompt=prompt,
                system_prompt="You are a JSON API. Return ONLY valid JSON. No markdown, no explanation.",
            )
            clean = raw.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(clean)
            return reply(json.dumps(parsed))
        except Exception:
            return reply(json.dumps({
                "type": "offers_list",
                "offers": [
                    {"title": "Welcome Offer", "description": "10% off on your next order", "code": "IRIS10", "expiry": "30 June 2026"},
                    {"title": "Electronics Deal", "description": "Flat ₹500 off on electronics above ₹5000", "code": "ELEC500", "expiry": "15 June 2026"},
                    {"title": "Loyalty Bonus", "description": "Free shipping on orders above ₹999", "code": "SHIPFREE", "expiry": "31 July 2026"},
                ]
            }))

    # ── General AI (RAG-enhanced) ─────────────────────────────────────────
    rag_context, _ = rag_service.build_context(q)

    system_prompt = (
        f"You are Iris, a premium ecommerce AI assistant. Be concise, friendly and helpful.\n"
        f"Customer name: {customer_name}\n"
        f"Customer orders: {json.dumps(db_items)}\n"
        "Rules:\n"
        "- Use the customer's actual order history only. Never invent orders.\n"
        "- For tracking queries, reference actual order statuses.\n"
        "- For recommendations, base them on their purchase history.\n"
        "- Respond in the same language the customer uses.\n"
        "- Keep responses concise — 3-5 sentences max unless detail is needed.\n"
    )

    if rag_context:
        system_prompt += f"\nRelevant knowledge base info:\n{rag_context}\n"

    try:
        raw_reply = await ollama_service.generate_response(
            prompt=q, system=system_prompt, session_id=req.session_id
        )
        try:
            parsed = json.loads(raw_reply.replace("```json", "").replace("```", "").strip())
            return reply(json.dumps(parsed))
        except json.JSONDecodeError:
            return reply(raw_reply)

    except Exception:
        return reply("I'm having trouble connecting right now. Please try again in a moment.")


# ──────────────────────────────────────────────────────────────────────────────
# ADMIN ROUTER
# ──────────────────────────────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".txt", ".md", ".json", ".csv", ".xlsx", ".xls",
    ".jpg", ".jpeg", ".png", ".svg",
}

admin_router = APIRouter(prefix="/admin", tags=["Admin"])


@admin_router.get("/me")
async def admin_me(current_user: User = Depends(get_admin_user)):
    return {"email": current_user.email, "username": current_user.username, "is_admin": current_user.is_admin}


@admin_router.post("/upload-sops")
async def upload_sops(
    files:        list[UploadFile] = File(...),
    current_user: User             = Depends(get_admin_user),
):
    if not rag_service.is_ready:
        raise HTTPException(status_code=503, detail="RAG service not ready — try again shortly.")

    results = []
    for file in files:
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type '{ext}' not supported.")

        file_path = UPLOAD_DIR / file.filename
        content   = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        chunks = await ingest_sop_file(str(file_path), rag_service)
        results.append({"filename": file.filename, "chunks": chunks, "size_kb": round(len(content) / 1024, 1)})

    return {"message": "Files uploaded and injected into RAG pipeline", "files": results}


@admin_router.get("/rag-stats")
async def rag_stats(current_user: User = Depends(get_admin_user)):
    return rag_service.stats()


@admin_router.get("/uploaded-files")
async def list_uploaded_files(current_user: User = Depends(get_admin_user)):
    files = [
        {"name": f.name, "size_kb": round(f.stat().st_size / 1024, 1), "ext": f.suffix.lower()}
        for f in sorted(UPLOAD_DIR.glob("*")) if f.is_file()
    ]
    return {"files": files}


@admin_router.delete("/clear-rag")
async def clear_rag_collection(current_user: User = Depends(get_admin_user)):
    try:
        rag_service._chroma_client.delete_collection(rag_service.COLLECTION_NAME)
        rag_service._collection = rag_service._chroma_client.get_or_create_collection(
            name=rag_service.COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
        )
        return {"message": "RAG collection cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# ORDERS ROUTER
# ──────────────────────────────────────────────────────────────────────────────
orders_router = APIRouter(prefix="/orders", tags=["Orders"])


@orders_router.post("/confirm")
async def confirm_order(
    req:          ConfirmOrderRequest,
    current_user: User          = Depends(get_current_user),
    db:           AsyncSession  = Depends(get_db),
):
    customer_id = await _get_customer_id(current_user.email, db)
    if not customer_id:
        raise HTTPException(status_code=404, detail="Customer profile not found.")

    price_str = req.price.replace("₹", "").replace("INR", "").replace(",", "").strip()
    try:    amount = float(price_str)
    except: amount = 0.0

    order_id = str(uuid.uuid4())
    now      = datetime.now(timezone.utc)

    try:
        await db.execute(
            text("""
                INSERT INTO orders (order_id, customer_id, status, total_amount, currency,
                                    ordered_at, product_name, category)
                VALUES (:oid, :cid, 'pending', :amt, 'INR', :now, :product_name, :category)
            """),
            {"oid": order_id, "cid": customer_id, "amt": amount, "now": now,
             "product_name": req.product_name, "category": req.brand or "general"},
        )
        await db.execute(
            text("INSERT INTO browsing_history (customer_id, product_name, category, viewed_at) "
                 "VALUES (:cid, :name, :cat, :now)"),
            {"cid": customer_id, "name": req.product_name, "cat": req.brand or "General", "now": now},
        )
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Order failed: {e}")

    return {"order_id": order_id, "product_name": req.product_name,
            "status": "pending", "message": f"Order placed for {req.product_name}!"}


@orders_router.post("/return")
async def confirm_return(
    req:          ConfirmReturnRequest,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    customer_id = await _get_customer_id(current_user.email, db)
    if not customer_id:
        raise HTTPException(status_code=404, detail="Customer profile not found.")

    r = await db.execute(
        text("""
            SELECT o.order_id, o.status, o.ordered_at, o.delivered_at
            FROM orders o
            JOIN browsing_history b ON b.customer_id = o.customer_id
             AND b.viewed_at BETWEEN o.ordered_at - INTERVAL '30 days'
                                 AND o.ordered_at + INTERVAL '7 days'
            WHERE o.customer_id=:cid AND LOWER(b.product_name) ILIKE LOWER(:product)
              AND o.status NOT IN ('returned','cancelled')
            ORDER BY o.ordered_at DESC LIMIT 1
        """),
        {"cid": customer_id, "product": f"%{req.product_name}%"},
    )
    order = r.mappings().first()
    if not order:
        raise HTTPException(status_code=404, detail=f"No active order found for '{req.product_name}'.")

    ref_date = order["delivered_at"] or order["ordered_at"]
    if ref_date:
        days = (datetime.now(timezone.utc) - ref_date.replace(tzinfo=timezone.utc)).days
        if days > 30:
            raise HTTPException(status_code=400, detail=f"Return window expired ({days} days ago).")

    try:
        await db.execute(
            text("UPDATE orders SET status='returned', return_reason=:reason WHERE order_id=:oid"),
            {"reason": req.reason, "oid": str(order["order_id"])},
        )
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Return failed: {e}")

    return {"product_name": req.product_name, "status": "returned",
            "message": f"Return confirmed for {req.product_name}. Refund in 5-7 business days."}


@orders_router.get("/check-return/{product_name}")
async def check_return(
    product_name: str,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    customer_id = await _get_customer_id(current_user.email, db)
    if not customer_id:
        return {"eligible": False, "reason": "Customer not found."}

    r = await db.execute(
        text("""
            SELECT o.order_id, o.status, o.ordered_at, o.delivered_at,
                   o.total_amount, o.currency, o.product_name, o.category
            FROM orders o
            JOIN browsing_history b ON b.customer_id = o.customer_id
             AND b.viewed_at BETWEEN o.ordered_at - INTERVAL '30 days'
                                 AND o.ordered_at + INTERVAL '7 days'
            WHERE o.customer_id=:cid AND LOWER(b.product_name) ILIKE LOWER(:product)
            ORDER BY o.ordered_at DESC LIMIT 1
        """),
        {"cid": customer_id, "product": f"%{product_name}%"},
    )
    order = r.mappings().first()
    if not order: return {"eligible": False, "reason": "Order not found."}
    if order["status"] in ("returned", "cancelled", "pending"):
        return {"eligible": False, "reason": f"Order status is '{order['status']}'."}

    ref  = order["delivered_at"] or order["ordered_at"]
    days = (datetime.now(timezone.utc) - ref.replace(tzinfo=timezone.utc)).days if ref else 0
    if days > 30:
        return {"eligible": False, "reason": f"Return window expired {days} days ago."}

    return {
        "eligible": True, "order_id": str(order["order_id"]),
        "product_name": order["product_name"], "category": order["category"],
        "status": order["status"], "days_left": 30 - days,
        "amount": float(order["total_amount"]), "currency": order["currency"],
    }


@orders_router.get("", response_model=list)
async def get_user_orders(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    return await customer_context_service.get_customer_orders(db, current_user.email)


# ──────────────────────────────────────────────────────────────────────────────
# RETURNS ROUTER
# ──────────────────────────────────────────────────────────────────────────────
returns_router = APIRouter(prefix="/returns", tags=["Returns"])


@returns_router.post("/start")
async def start_return(
    req: StartReturnRequest,
    db:  AsyncSession = Depends(get_db),
    u:   User         = Depends(get_current_user),
):
    res   = await db.execute(text("SELECT * FROM orders WHERE order_id=:id"), {"id": req.order_id})
    order = res.fetchone()
    if not order:
        return {"type": "return_rejected", "reason": "Order not found"}

    # Load policy from rag_data/uploads/
    policy_path = UPLOAD_DIR / "return_policy.json"
    if policy_path.exists():
        with open(policy_path) as f:
            sop = json.load(f)
        allowed_days = sop.get("categories", {}).get(order.category, {}).get("return_window_days", 30)
    else:
        allowed_days = 30

    if not order.delivered_at:
        return {"type": "return_rejected", "reason": "Order not delivered yet"}

    days_elapsed = (datetime.utcnow().date() - order.delivered_at.date()).days
    if days_elapsed > allowed_days:
        return {"type": "return_rejected", "reason": "Return period expired"}

    session_id = str(uuid.uuid4())
    await db.execute(
        text("INSERT INTO return_sessions (session_id, user_id, order_id, status) VALUES (:s, :u, :o, 'started')"),
        {"s": session_id, "u": u.id, "o": req.order_id},
    )
    await db.commit()
    return {"session_id": session_id, "type": "return_reason_required"}


@returns_router.post("/reason")
async def process_reason(
    req: ReturnReasonRequest,
    db:  AsyncSession = Depends(get_db),
    u:   User         = Depends(get_current_user),
):
    session = (await db.execute(
        text("SELECT * FROM return_sessions WHERE session_id=:s AND user_id=:u"),
        {"s": req.session_id, "u": u.id},
    )).fetchone()
    if not session:
        return {"type": "return_rejected", "reason": "Invalid session"}

    # Check repeat only for the *same order*, not across all orders
    existing_reason = (await db.execute(
        text("""
            SELECT rr.reason FROM return_requests rr
            JOIN return_sessions rs ON rs.order_id = rr.order_id AND rs.user_id = rr.user_id
            WHERE rs.session_id = :s AND rr.user_id = :u
            ORDER BY rr.created_at DESC LIMIT 1
        """),
        {"s": req.session_id, "u": u.id},
    )).scalar()
    if existing_reason and existing_reason.lower() == req.reason.lower():
        return {"type": "reason_repeat_detected"}

    await db.execute(
        text("UPDATE return_sessions SET selected_reason=:r, detailed_reason=:dr, "
             "status='awaiting_validation' WHERE session_id=:s"),
        {"r": req.reason, "dr": req.detailed_reason, "s": req.session_id},
    )
    await db.commit()

    validator = ReturnValidator()
    result    = await validator.validate_return(req.session_id, db)

    # If caller asked for recommendations (damaged return + recommend flow), attach them
    if req.include_recommendations and result.get("type") == "return_resolution":
        recs = await _get_recommendations_for_session(req.session_id, db)
        result["recommendations"] = recs

    return result


# ── NEW: Damage verification via Ollama llava (iris-damage model) ─────────────
@returns_router.post("/verify-damage")
async def verify_damage(
    req: VerifyDamageRequest,
    db:  AsyncSession = Depends(get_db),
    u:   User         = Depends(get_current_user),
):
    if not req.images:
        raise HTTPException(status_code=400, detail="At least one image is required.")

    prompt = (
        f"damage_location: {req.damage_location}\n\n"
        "Look at the provided image(s) and decide if the visible damage matches the described location.\n"
        "Respond ONLY with valid JSON as instructed in your system prompt."
    )

    payload = {
        "model":  OLLAMA_VISION_MODEL,
        "prompt": prompt,
        "images": [_extract_base64(img) for img in req.images],
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(OLLAMA_VISION_URL, json=payload)
            resp.raise_for_status()
            raw = resp.json().get("response", "")
    except httpx.HTTPError as e:
        logger.error(f"Ollama vision call failed: {e}")
        raise HTTPException(status_code=502, detail=f"Ollama unreachable: {str(e)}")

    # Parse JSON from model output (strip accidental markdown fences)
    try:
        cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()
        result  = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning(f"iris-damage model returned unparseable output: {raw[:200]}")
        return {
            "type":            "damage_mismatch",
            "verdict":         "mismatch",
            "confidence":      0.0,
            "explanation":     "We couldn't automatically verify the damage. Please contact support for manual review.",
            "session_id":      req.session_id,
            "recommendations": [],
        }

    verdict     = result.get("verdict", "mismatch").lower()
    confidence  = float(result.get("confidence", 0.5))
    explanation = result.get("explanation", "")

    # Confidence < 0.5 → treat as mismatch even if verdict says match
    is_verified = (verdict == "match" and confidence >= 0.5)

    if is_verified:
        recommendations = await _get_recommendations_for_session(req.session_id, db)
        return {
            "type":            "damage_verified",
            "verdict":         "match",
            "confidence":      confidence,
            "explanation":     explanation,
            "session_id":      req.session_id,
            "recommendations": recommendations,
        }
    else:
        return {
            "type":            "damage_mismatch",
            "verdict":         "mismatch",
            "confidence":      confidence,
            "explanation":     explanation or "The uploaded photos don't clearly show the damage you described.",
            "session_id":      req.session_id,
            "recommendations": [],
        }

# ── Wrong-item check ──────────────────────────────────────────────────────────
class WrongItemCheckRequest(BaseModel):
    session_id:     str
    wanted_product: str


class SessionIdRequest(BaseModel):
    session_id: str


class ChangedMindCheckRequest(BaseModel):
    session_id:     str
    wanted_product: str


@returns_router.post("/wrong-item-check")
async def wrong_item_check(
    req: WrongItemCheckRequest,
    db:  AsyncSession = Depends(get_db),
    u:   User         = Depends(get_current_user),
):
    """
    1. Fetch browsing history 30 days before this order.
    2. wanted_product in history  → legit wrong item  → wrong_item_history_match + Amazon recs
    3. ordered product in history → they searched & bought it → wrong_item_no_match + comparison table
    """
    session_row = (await db.execute(
        text("SELECT * FROM return_sessions WHERE session_id=:s AND user_id=:u"),
        {"s": req.session_id, "u": u.id},
    )).fetchone()
    if not session_row:
        return {"type": "return_rejected", "reason": "Invalid return session"}

    order_row = (await db.execute(
        text("SELECT * FROM orders WHERE order_id=:o"), {"o": session_row.order_id}
    )).fetchone()
    if not order_row:
        return {"type": "return_rejected", "reason": "Order not found"}

    ordered_product = order_row.product_name or ""
    category        = order_row.category or "electronics"

    history_rows = (await db.execute(
        text("""
            SELECT product_name FROM browsing_history
            WHERE customer_id = (SELECT customer_id FROM orders WHERE order_id=:o LIMIT 1)
              AND viewed_at BETWEEN CAST(:o_date AS timestamp) - INTERVAL '30 days' AND CAST(:o_date AS timestamp)
            ORDER BY viewed_at DESC LIMIT 50
        """),
        {"o": session_row.order_id, "o_date": order_row.ordered_at},
    )).fetchall()

    history_names  = [r[0].lower() for r in history_rows if r[0]]
    wanted_lower   = req.wanted_product.lower()
    ordered_lower  = ordered_product.lower()

    wanted_in_history  = any(wanted_lower in h or h in wanted_lower for h in history_names)
    ordered_in_history = any(ordered_lower in h or h in ordered_lower for h in history_names)

    async def get_amazon_recs(product_name: str, count: int = 3) -> list:
        return await _get_amazon_recs(product_name, count)

    async def get_comparison_recs(ordered: str, cat: str, count: int = 2):
        return await _get_comparison_recs(ordered, cat, count)


    if wanted_in_history:
        recs = await get_amazon_recs(req.wanted_product)
        return {
            "type":            "wrong_item_history_match",
            "session_id":      req.session_id,
            "wanted_product":  req.wanted_product,
            "ordered_product": ordered_product,
            "recommendations": recs,
        }

    recs, specs, o_price, o_rating = await get_comparison_recs(ordered_product, category)
    return {
        "type":            "wrong_item_no_match",
        "session_id":      req.session_id,
        "wanted_product":  req.wanted_product,
        "ordered_product": ordered_product,
        "ordered_price":   o_price,
        "ordered_rating":  o_rating,
        "recommendations": recs,
        "specs":           specs,
    }


# ── Changed Mind: history-based recommendations + wanted-product comparison ───
@returns_router.post("/changed-mind-recommendations")
async def changed_mind_recommendations(
    req: SessionIdRequest,
    db:  AsyncSession = Depends(get_db),
    u:   User         = Depends(get_current_user),
):
    """Step 1: customer picked 'Changed Mind' → show recs based on their browsing history."""
    session_row = (await db.execute(
        text("SELECT * FROM return_sessions WHERE session_id=:s AND user_id=:u"),
        {"s": req.session_id, "u": u.id},
    )).fetchone()
    if not session_row:
        return {"type": "return_rejected", "reason": "Invalid return session"}

    recs = await _get_recommendations_for_session(req.session_id, db)
    return {
        "type":            "changed_mind_recommendations",
        "session_id":      req.session_id,
        "recommendations": recs,
    }


@returns_router.post("/changed-mind-check")
async def changed_mind_check(
    req: ChangedMindCheckRequest,
    db:  AsyncSession = Depends(get_db),
    u:   User         = Depends(get_current_user),
):
    """Step 2: customer said what they'd want instead → recommendations + spec comparison for it."""
    session_row = (await db.execute(
        text("SELECT * FROM return_sessions WHERE session_id=:s AND user_id=:u"),
        {"s": req.session_id, "u": u.id},
    )).fetchone()
    if not session_row:
        return {"type": "return_rejected", "reason": "Invalid return session"}

    order_row = (await db.execute(
        text("SELECT * FROM orders WHERE order_id=:o"), {"o": session_row.order_id}
    )).fetchone()
    if not order_row:
        return {"type": "return_rejected", "reason": "Order not found"}

    ordered_product = order_row.product_name or ""
    category        = order_row.category or "electronics"

    recs, specs, w_price, w_rating = await _get_comparison_recs(req.wanted_product, category)
    return {
        "type":            "changed_mind_comparison",
        "session_id":      req.session_id,
        "wanted_product":  req.wanted_product,
        "ordered_product": ordered_product,
        "wanted_price":    w_price,
        "wanted_rating":   w_rating,
        "recommendations": recs,
        "specs":           specs,
    }