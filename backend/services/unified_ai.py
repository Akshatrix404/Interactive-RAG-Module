
import os
import logging
from typing import List, Optional
from dotenv import load_dotenv

import google.generativeai as genai

from services.rag_service    import rag_service
from services.ollama_service import ollama_service, OLLAMA_SYSTEM_PROMPT

load_dotenv()
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

GEMINI_SYSTEM = """
You are HelpDesk AI, an enterprise AI assistant.

You answer strictly based on retrieved reference documents and uploaded SOPs.

Rules:
- Answer ONLY from the provided retrieved context when relevant.
- Do NOT generate programming code unless the user explicitly asks for code.
- Do NOT assume the topic is Python or software.
- If the question is about SOPs, policies, business processes, refunds, HR, operations, or uploaded documents, answer directly and professionally.
- Keep responses concise, accurate, and document-grounded.
- If the answer is not found in available context, say:
  "I could not find that information in the available documents."

Format responses clearly in markdown.
"""


class UnifiedAIService:
    """
    Single entry point for all AI calls.
    Handles RAG retrieval + model selection automatically.
    """

    def __init__(self):
        self._gemini_model = None
        self._init_gemini()

    def _init_gemini(self):
        if not GEMINI_API_KEY:
            logger.warning("No GEMINI_API_KEY — Gemini fallback disabled")
            return
        try:
            self._gemini_model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                generation_config={
                    "temperature":      0.7,
                    "top_p":            0.95,
                    "max_output_tokens": 2048,
                },
                system_instruction=GEMINI_SYSTEM,
            )
            logger.info("✅ Gemini Flash initialised")
        except Exception as e:
            logger.error(f"Gemini init failed: {e}")

    # ── Public API ─────────────────────────────────────────────────────────────

    async def get_response(
        self,
        query: str,
        conversation_history: Optional[List[dict]] = None,
        preferred_provider: str = "auto",   # "auto" | "ollama" | "gemini"
    ) -> dict:
        """
        Main entry point.
        1. Retrieve RAG context
        2. Try Ollama (or Gemini) with context injected
        3. Return answer + sources + provider used
        """

        # ── Step 1: RAG retrieval ──────────────────────────────────────────────
        context, rag_sources = ("", [])
        if rag_service.is_ready:
            context, rag_sources = rag_service.build_context(query)
            if context:
                logger.info(f"RAG retrieved {len(rag_sources)} sources for query")
        else:
            logger.info("RAG not ready yet — answering without context")

        # ── Step 2: Choose provider ────────────────────────────────────────────
        use_ollama = (
            preferred_provider == "ollama"
            or (preferred_provider == "auto" and ollama_service.is_running)
        )

        answer   = ""
        provider = ""
        error    = None

        if use_ollama:
            try:
                answer   = await self._ask_ollama(query, conversation_history, context)
                provider = f"Ollama ({ollama_service.active_model})"
            except Exception as e:
                logger.warning(f"Ollama failed, falling back to Gemini: {e}")
                error = str(e)

        if not answer:  # Gemini fallback (or primary if ollama not wanted)
            try:
                answer   = await self._ask_gemini(query, conversation_history, context)
                provider = "Gemini Flash"
            except Exception as e:
                logger.error(f"Gemini also failed: {e}")
                answer   = self._offline_answer(query, error or str(e))
                provider = "offline"

        # ── Step 3: Determine displayed sources ───────────────────────────────
        extra_sources = self._keyword_sources(query)
        all_sources   = list(dict.fromkeys(rag_sources + extra_sources))[:4]

        return {
            "answer":   answer,
            "sources":  all_sources,
            "provider": provider,
            "rag_used": bool(rag_sources),
        }

    # ── Ollama ─────────────────────────────────────────────────────────────────

    async def _ask_ollama(
        self,
        query: str,
        history: Optional[List[dict]],
        context: str,
    ) -> str:
        return await ollama_service.generate(
            prompt=query,
            system_prompt=OLLAMA_SYSTEM_PROMPT,
            conversation_history=history,
            context=context,
        )

    # ── Gemini ─────────────────────────────────────────────────────────────────

    async def _ask_gemini(
        self,
        query: str,
        history: Optional[List[dict]],
        context: str,
    ) -> str:
        if not self._gemini_model:
            raise RuntimeError("Gemini not configured")

        # Build chat history
        chat_history = []
        if history:
            for msg in history[-10:]:
                role = "user" if msg["role"] == "user" else "model"
                chat_history.append({"role": role, "parts": [msg["content"]]})

        chat = self._gemini_model.start_chat(history=chat_history)

        # Inject RAG context into prompt
        if context:
            full_prompt = (
                f"{context}\n\n"
                f"Using the reference material above where relevant, answer this question:\n\n"
                f"{query}\n\n"
                f"Cite which reference you used if applicable."
            )
        else:
            full_prompt = query

        resp = chat.send_message(full_prompt)
        return resp.text

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _keyword_sources(self, query: str) -> List[str]:
        """Add extra source labels based on keywords in the query."""
        q = query.lower()
        sources = []
        if any(k in q for k in ["pep", "style", "convention", "docstring"]):
            sources.append("PEP 8 / PEP 257 — Python Style Guides")
        if any(k in q for k in ["async", "await", "asyncio", "coroutine", "event loop"]):
            sources.append("Python AsyncIO Docs (docs.python.org/3/library/asyncio)")
        if any(k in q for k in ["list", "dict", "tuple", "set", "string", "type"]):
            sources.append("Python Built-in Types (docs.python.org/3/library/stdtypes)")
        if any(k in q for k in ["function", "decorator", "lambda", "closure", "generator"]):
            sources.append("Think Python 2nd Edition — Allen Downey")
        if any(k in q for k in ["automate", "file", "os", "path", "regex", "csv", "excel"]):
            sources.append("Automate the Boring Stuff with Python — Al Sweigart")
        if any(k in q for k in ["class", "object", "inherit", "oop", "polymorphism"]):
            sources.append("Python Official Tutorial — Classes (docs.python.org/3/tutorial)")
        if any(k in q for k in ["collections", "deque", "counter", "orderdict", "namedtuple"]):
            sources.append("Python Collections Module (docs.python.org/3/library/collections)")
        if any(k in q for k in ["itertools", "chain", "product", "combinations", "permutations"]):
            sources.append("Python Itertools (docs.python.org/3/library/itertools)")
        if any(k in q for k in ["functools", "partial", "lru_cache", "reduce", "wraps"]):
            sources.append("Python Functools (docs.python.org/3/library/functools)")
        return sources

    def _offline_answer(self, query: str, error: str) -> str:
        return f"""⚠️ **Both AI providers are currently unavailable.**

**Your question:** {query}

**Error details:** {error}

**To fix this, choose one:**

**Option A — Use Gemini (recommended, free):**
1. Get a key at https://makersuite.google.com/app/apikey
2. Set `GEMINI_API_KEY=your-key` in `backend/.env`
3. Restart the backend

**Option B — Use Ollama (local, private):**
1. Download Ollama from https://ollama.com
2. Run: `ollama pull llama3.1`
3. Start Ollama — it runs automatically on port 11434
4. Set `OLLAMA_BASE_URL=http://localhost:11434` in `.env`
5. Restart the backend"""

    # ── Status ─────────────────────────────────────────────────────────────────

    async def status(self) -> dict:
        ollama_ok = await ollama_service.check_connection()
        return {
            "ollama": {
                "available":  ollama_ok,
                "models":     ollama_service.available_models,
                "active":     ollama_service.active_model,
            },
            "gemini": {
                "available": bool(GEMINI_API_KEY and self._gemini_model),
                "model":     "gemini-1.5-flash",
            },
            "rag": rag_service.stats(),
        }


# ── Singleton ─────────────────────────────────────────────────────────────────
unified_ai = UnifiedAIService()
