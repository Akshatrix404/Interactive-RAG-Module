import os
import re
import time
import hashlib
import asyncio
import logging
import urllib.request
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
import PyPDF2
import httpx

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent.parent
DATA_DIR   = BASE_DIR / "rag_data"
PDF_DIR    = DATA_DIR / "pdfs"
CHROMA_DIR = DATA_DIR / "chroma_db"

for d in [DATA_DIR, PDF_DIR, CHROMA_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ── Python Reference Sources ──────────────────────────────────────────────────
PYTHON_SOURCES = [
    {
        "id":   "think_python2",
        "name": "Think Python 2nd Edition",
        "url":  "https://greenteapress.com/thinkpython2/thinkpython2.pdf",
        "type": "pdf",
        "filename": "think_python2.pdf",
    },
    {
        "id":   "automate_boring",
        "name": "Automate the Boring Stuff with Python",
        "url":  "https://automatetheboringstuff.com/2e/chapter0/",
        "type": "web_multipage",
        "pages": [
            "https://automatetheboringstuff.com/2e/chapter0/",
            "https://automatetheboringstuff.com/2e/chapter1/",
            "https://automatetheboringstuff.com/2e/chapter2/",
            "https://automatetheboringstuff.com/2e/chapter3/",
            "https://automatetheboringstuff.com/2e/chapter4/",
            "https://automatetheboringstuff.com/2e/chapter5/",
            "https://automatetheboringstuff.com/2e/chapter6/",
            "https://automatetheboringstuff.com/2e/chapter7/",
            "https://automatetheboringstuff.com/2e/chapter8/",
            "https://automatetheboringstuff.com/2e/chapter9/",
        ],
        "filename": "automate_boring.txt",
    },
    {
        "id":   "python_docs_tutorial",
        "name": "Python Official Tutorial",
        "url":  "https://docs.python.org/3/tutorial/",
        "type": "web_multipage",
        "pages": [
            "https://docs.python.org/3/tutorial/introduction.html",
            "https://docs.python.org/3/tutorial/controlflow.html",
            "https://docs.python.org/3/tutorial/datastructures.html",
            "https://docs.python.org/3/tutorial/modules.html",
            "https://docs.python.org/3/tutorial/inputoutput.html",
            "https://docs.python.org/3/tutorial/errors.html",
            "https://docs.python.org/3/tutorial/classes.html",
            "https://docs.python.org/3/tutorial/stdlib.html",
            "https://docs.python.org/3/tutorial/stdlib2.html",
            "https://docs.python.org/3/tutorial/venv.html",
        ],
        "filename": "python_official_tutorial.txt",
    },
    {
        "id":   "pep8",
        "name": "PEP 8 — Style Guide for Python Code",
        "url":  "https://peps.python.org/pep-0008/",
        "type": "web_single",
        "filename": "pep8.txt",
    },
    {
        "id":   "pep20",
        "name": "PEP 20 — The Zen of Python",
        "url":  "https://peps.python.org/pep-0020/",
        "type": "web_single",
        "filename": "pep20.txt",
    },
    {
        "id":   "pep257",
        "name": "PEP 257 — Docstring Conventions",
        "url":  "https://peps.python.org/pep-0257/",
        "type": "web_single",
        "filename": "pep257.txt",
    },
    {
        "id":   "pep3107",
        "name": "PEP 3107 — Function Annotations",
        "url":  "https://peps.python.org/pep-3107/",
        "type": "web_single",
        "filename": "pep3107.txt",
    },
    {
        "id":   "python_glossary",
        "name": "Python Glossary",
        "url":  "https://docs.python.org/3/glossary.html",
        "type": "web_single",
        "filename": "python_glossary.txt",
    },
    {
        "id":   "python_builtins",
        "name": "Python Built-in Functions",
        "url":  "https://docs.python.org/3/library/functions.html",
        "type": "web_single",
        "filename": "python_builtins.txt",
    },
    {
        "id":   "python_exceptions",
        "name": "Python Built-in Exceptions",
        "url":  "https://docs.python.org/3/library/exceptions.html",
        "type": "web_single",
        "filename": "python_exceptions.txt",
    },
    {
        "id":   "python_string_methods",
        "name": "Python String Methods",
        "url":  "https://docs.python.org/3/library/stdtypes.html",
        "type": "web_single",
        "filename": "python_string_methods.txt",
    },
    {
        "id":   "python_collections",
        "name": "Python Collections Module",
        "url":  "https://docs.python.org/3/library/collections.html",
        "type": "web_single",
        "filename": "python_collections.txt",
    },
    {
        "id":   "python_itertools",
        "name": "Python Itertools",
        "url":  "https://docs.python.org/3/library/itertools.html",
        "type": "web_single",
        "filename": "python_itertools.txt",
    },
    {
        "id":   "python_functools",
        "name": "Python Functools",
        "url":  "https://docs.python.org/3/library/functools.html",
        "type": "web_single",
        "filename": "python_functools.txt",
    },
    {
        "id":   "python_asyncio",
        "name": "Python AsyncIO",
        "url":  "https://docs.python.org/3/library/asyncio.html",
        "type": "web_single",
        "filename": "python_asyncio.txt",
    },
    {
        "id":   "python_pathlib",
        "name": "Python Pathlib",
        "url":  "https://docs.python.org/3/library/pathlib.html",
        "type": "web_single",
        "filename": "python_pathlib.txt",
    },
]


@dataclass
class Chunk:
    text: str
    source: str
    source_id: str
    chunk_id: str
    page: int = 0


# ── Text Extraction ────────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract all text from a PDF file."""
    text_parts = []
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for i, page in enumerate(reader.pages):
                try:
                    t = page.extract_text()
                    if t and t.strip():
                        text_parts.append(f"\n--- Page {i+1} ---\n{t}")
                except Exception:
                    continue
        logger.info(f"Extracted {len(reader.pages)} pages from {pdf_path.name}")
    except Exception as e:
        logger.error(f"PDF extraction error for {pdf_path}: {e}")
    return "\n".join(text_parts)


def clean_html_text(html: str) -> str:
    """Strip HTML tags and clean whitespace."""
    # Remove script/style blocks
    html = re.sub(r'<(script|style)[^>]*>.*?</(script|style)>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove nav/header/footer
    html = re.sub(r'<(nav|header|footer)[^>]*>.*?</(nav|header|footer)>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove HTML tags
    html = re.sub(r'<[^>]+>', ' ', html)
    # Decode common HTML entities
    html = html.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
    html = html.replace('&quot;', '"').replace('&#39;', "'").replace('&nbsp;', ' ')
    html = html.replace('&laquo;', '«').replace('&raquo;', '»')
    # Collapse whitespace
    html = re.sub(r'[ \t]+', ' ', html)
    html = re.sub(r'\n{3,}', '\n\n', html)
    return html.strip()


async def fetch_web_page(url: str, client: httpx.AsyncClient) -> str:
    """Fetch a web page and return cleaned text."""
    try:
        resp = await client.get(url, timeout=30, follow_redirects=True)
        resp.raise_for_status()
        return clean_html_text(resp.text)
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return ""


async def download_pdf(url: str, dest: Path) -> bool:
    """Download a PDF file."""
    if dest.exists() and dest.stat().st_size > 10_000:
        logger.info(f"PDF already cached: {dest.name}")
        return True
    try:
        logger.info(f"Downloading PDF: {url}")
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            logger.info(f"Downloaded PDF ({dest.stat().st_size // 1024} KB): {dest.name}")
            return True
    except Exception as e:
        logger.error(f"PDF download failed {url}: {e}")
        return False


# ── Chunking ──────────────────────────────────────────────────────────────────

def chunk_text(
    text: str,
    source_name: str,
    source_id: str,
    chunk_size: int = 600,
    overlap: int = 100,
) -> List[Chunk]:
    """
    Split text into overlapping chunks for embedding.
    Tries to split on paragraph/sentence boundaries.
    """
    chunks = []
    # Split into paragraphs first
    paragraphs = re.split(r'\n{2,}', text)
    
    buffer = ""
    chunk_index = 0

    for para in paragraphs:
        para = para.strip()
        if not para or len(para) < 20:
            continue
        
        # If adding this paragraph exceeds chunk_size, flush buffer
        if buffer and len(buffer) + len(para) > chunk_size:
            chunk_text_val = buffer.strip()
            if len(chunk_text_val) > 80:
                cid = hashlib.md5(f"{source_id}_{chunk_index}".encode()).hexdigest()[:12]
                chunks.append(Chunk(
                    text=chunk_text_val,
                    source=source_name,
                    source_id=source_id,
                    chunk_id=f"{source_id}_{cid}",
                    page=chunk_index,
                ))
                chunk_index += 1
            # Keep overlap from end of buffer
            words = buffer.split()
            overlap_words = words[-overlap//6:] if len(words) > overlap//6 else words
            buffer = " ".join(overlap_words) + "\n\n" + para
        else:
            buffer = (buffer + "\n\n" + para).strip() if buffer else para

    # Flush remaining buffer
    if buffer.strip() and len(buffer.strip()) > 80:
        cid = hashlib.md5(f"{source_id}_{chunk_index}".encode()).hexdigest()[:12]
        chunks.append(Chunk(
            text=buffer.strip(),
            source=source_name,
            source_id=source_id,
            chunk_id=f"{source_id}_{cid}",
            page=chunk_index,
        ))

    logger.info(f"Chunked '{source_name}' → {len(chunks)} chunks")
    return chunks


# ── RAG Service ───────────────────────────────────────────────────────────────

class RAGService:
    COLLECTION_NAME = "python_knowledge"
    EMBED_MODEL     = "all-MiniLM-L6-v2"   # fast, good quality, 384-dim
    TOP_K           = 5                     # chunks to retrieve per query

    def __init__(self):
        self._ready        = False
        self._embed_model  = None
        self._chroma_client = None
        self._collection   = None
        self._init_lock    = asyncio.Lock()

    # ── Initialisation ────────────────────────────────────────────────────────

    async def initialize(self):
        """Download sources, embed, and load ChromaDB. Idempotent."""
        async with self._init_lock:
            if self._ready:
                return
            logger.info("🔄 Initialising RAG pipeline...")
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, self._load_embedding_model
                )
                self._setup_chroma()

                existing_count = self._collection.count()
                logger.info(f"ChromaDB has {existing_count} existing chunks")

                if existing_count < 100:
                    logger.info("Downloading & indexing Python reference materials...")
                    all_chunks = await self._ingest_all_sources()
                    self._index_chunks(all_chunks)
                    logger.info(f"✅ RAG ready — {self._collection.count()} chunks indexed")
                else:
                    logger.info(f"✅ RAG ready — {existing_count} chunks already indexed")

                self._ready = True
            except Exception as e:
                logger.error(f"❌ RAG initialization error: {e}")
                self._ready = False

    def _load_embedding_model(self):
        logger.info(f"Loading embedding model: {self.EMBED_MODEL}")
        self._embed_model = SentenceTransformer(self.EMBED_MODEL)
        logger.info("✅ Embedding model loaded")

    def _setup_chroma(self):
        self._chroma_client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
        self._collection = self._chroma_client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    # ── Ingestion ─────────────────────────────────────────────────────────────

    async def _ingest_all_sources(self) -> List[Chunk]:
        all_chunks: List[Chunk] = []
        async with httpx.AsyncClient(
            headers={"User-Agent": "HelpDeskAI/1.0 (educational)"},
            timeout=60,
        ) as client:
            for src in PYTHON_SOURCES:
                try:
                    chunks = await self._ingest_source(src, client)
                    all_chunks.extend(chunks)
                    await asyncio.sleep(0.5)   # polite crawl delay
                except Exception as e:
                    logger.error(f"Failed to ingest '{src['name']}': {e}")
        return all_chunks

    async def _ingest_source(
        self,
        src: dict,
        client: httpx.AsyncClient,
    ) -> List[Chunk]:
        cache_file = PDF_DIR / src["filename"]

        # Use cached text if fresh enough (< 7 days old)
        if cache_file.exists() and cache_file.suffix == ".txt":
            age = time.time() - cache_file.stat().st_mtime
            if age < 7 * 86400:
                text = cache_file.read_text(encoding="utf-8", errors="ignore")
                logger.info(f"Using cached text for '{src['name']}'")
                return chunk_text(text, src["name"], src["id"])

        # ── PDF ──
        if src["type"] == "pdf":
            pdf_path = PDF_DIR / src["filename"]
            ok = await download_pdf(src["url"], pdf_path)
            if ok:
                text = extract_text_from_pdf(pdf_path)
                (PDF_DIR / src["filename"].replace(".pdf", ".txt")).write_text(
                    text, encoding="utf-8"
                )
                return chunk_text(text, src["name"], src["id"])
            return []

        # ── Single web page ──
        if src["type"] == "web_single":
            text = await fetch_web_page(src["url"], client)
            if text:
                cache_file.write_text(text, encoding="utf-8")
            return chunk_text(text, src["name"], src["id"]) if text else []

        # ── Multi-page web ──
        if src["type"] == "web_multipage":
            parts = []
            for page_url in src.get("pages", []):
                t = await fetch_web_page(page_url, client)
                if t:
                    parts.append(t)
                await asyncio.sleep(0.3)
            combined = "\n\n".join(parts)
            if combined:
                cache_file.write_text(combined, encoding="utf-8")
            return chunk_text(combined, src["name"], src["id"]) if combined else []

        return []

    # ── Indexing ──────────────────────────────────────────────────────────────

    def _index_chunks(self, chunks: List[Chunk]):
        """Embed and upsert chunks into ChromaDB in batches."""
        if not chunks:
            logger.warning("No chunks to index")
            return

        BATCH = 64
        for i in range(0, len(chunks), BATCH):
            batch = chunks[i : i + BATCH]
            texts      = [c.text      for c in batch]
            ids        = [c.chunk_id  for c in batch]
            metadatas  = [
                {"source": c.source, "source_id": c.source_id, "page": c.page}
                for c in batch
            ]
            embeddings = self._embed_model.encode(texts, show_progress_bar=False).tolist()
            self._collection.upsert(
                ids=ids,
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas,
            )
        logger.info(f"Indexed {len(chunks)} chunks into ChromaDB")

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def retrieve(self, query: str, top_k: int = None) -> List[Dict]:
        """
        Retrieve the most relevant chunks for a query.
        Returns list of dicts with 'text', 'source', 'score'.
        """
        if not self._ready or not self._embed_model or not self._collection:
            return []
        try:
            k = top_k or self.TOP_K
            q_emb = self._embed_model.encode([query]).tolist()
            results = self._collection.query(
                query_embeddings=q_emb,
                n_results=min(k, self._collection.count()),
                include=["documents", "metadatas", "distances"],
            )
            retrieved = []
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                score = 1 - dist   # cosine similarity
                if score > 0.25:   # relevance threshold
                    retrieved.append({
                        "text":   doc,
                        "source": meta.get("source", "Python Reference"),
                        "score":  round(score, 3),
                    })
            return retrieved
        except Exception as e:
            logger.error(f"Retrieval error: {e}")
            return []

    def build_context(self, query: str, top_k: int = None) -> Tuple[str, List[str]]:
        """
        Build a context block and source list for injection into a prompt.
        Returns (context_string, source_names_list).
        """
        chunks = self.retrieve(query, top_k)
        if not chunks:
            return "", []

        parts   = []
        sources = []
        seen    = set()

        for i, chunk in enumerate(chunks, 1):
            parts.append(
                f"[Reference {i} — {chunk['source']}]\n{chunk['text']}"
            )
            if chunk["source"] not in seen:
                sources.append(chunk["source"])
                seen.add(chunk["source"])

        context = (
            "RELEVANT PYTHON REFERENCE MATERIAL\n"
            "===================================\n"
            + "\n\n".join(parts)
            + "\n==================================="
        )
        return context, sources

    @property
    def is_ready(self) -> bool:
        return self._ready

    def stats(self) -> dict:
        if self._collection:
            return {
                "chunks": self._collection.count(),
                "model":  self.EMBED_MODEL,
                "ready":  self._ready,
            }
        return {"chunks": 0, "model": self.EMBED_MODEL, "ready": False}


# ── Singleton ─────────────────────────────────────────────────────────────────
rag_service = RAGService()
