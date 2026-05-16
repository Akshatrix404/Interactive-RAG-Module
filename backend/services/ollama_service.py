"""
Ollama Service
==============
Connects to a locally running Ollama instance,
lists available models, and streams/returns chat completions.
"""

import os
import json
import logging
import httpx
from typing import List, Optional, AsyncGenerator
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# Preferred model priority order (first available wins)
PREFERRED_MODELS = [
    "llama3.1",
    "llama3",
    "llama3:8b",
    "llama3.1:8b",
    "llama3.2",
    "llama3.2:3b",
    "mistral",
    "mistral:7b",
    "gemma2",
    "gemma2:9b",
    "phi3",
    "phi3:mini",
    "deepseek-r1",
    "qwen2.5",
    "codellama",
]


class OllamaService:
    def __init__(self):
        self._available_models: List[str] = []
        self._active_model: Optional[str] = None
        self._is_running = False

    async def check_connection(self) -> bool:
        """Check if Ollama is running and reachable."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m["name"] for m in data.get("models", [])]
                    self._available_models = models
                    self._is_running = True
                    self._select_best_model()
                    logger.info(f"✅ Ollama running — models: {models}")
                    return True
        except Exception as e:
            logger.info(f"ℹ️  Ollama not available: {e}")
        self._is_running = False
        return False

    def _select_best_model(self):
        """Pick the best available model from preference list."""
        if not self._available_models:
            return
        # Try preferred models first
        for preferred in PREFERRED_MODELS:
            for available in self._available_models:
                if preferred.lower() in available.lower():
                    self._active_model = available
                    logger.info(f"Selected Ollama model: {available}")
                    return
        # Fallback: just use whatever is installed
        self._active_model = self._available_models[0]
        logger.info(f"Fallback Ollama model: {self._active_model}")

    async def list_models(self) -> List[str]:
        """Return list of locally installed Ollama models."""
        await self.check_connection()
        return self._available_models

    async def pull_model(self, model_name: str) -> bool:
        """Pull (download) a model into Ollama."""
        try:
            logger.info(f"Pulling Ollama model: {model_name} ...")
            async with httpx.AsyncClient(timeout=600) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_BASE_URL}/api/pull",
                    json={"name": model_name},
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                status = data.get("status", "")
                                if "pulling" in status or "verifying" in status:
                                    logger.info(f"  {status}")
                            except Exception:
                                pass
            await self.check_connection()
            return True
        except Exception as e:
            logger.error(f"Model pull failed: {e}")
            return False

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        model: Optional[str] = None,
        conversation_history: Optional[List[dict]] = None,
        context: str = "",
    ) -> str:
        """
        Generate a response using the local Ollama model.
        Injects RAG context into the system prompt.
        """
        if not self._is_running:
            await self.check_connection()
        if not self._is_running:
            raise RuntimeError("Ollama is not running")

        use_model = model or self._active_model
        if not use_model:
            raise RuntimeError("No Ollama model available")

        # Build messages array (OpenAI-compatible format)
        system = self._build_system_prompt(system_prompt, context)
        messages = [{"role": "system", "content": system}]

        # Add conversation history (last 10 turns)
        if conversation_history:
            for msg in conversation_history[-10:]:
                messages.append({
                    "role":    msg["role"],
                    "content": msg["content"],
                })

        messages.append({"role": "user", "content": prompt})

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model":    use_model,
                        "messages": messages,
                        "stream":   False,
                        "options": {
                            "temperature":   0.7,
                            "top_p":         0.9,
                            "repeat_penalty": 1.1,
                            "num_ctx":       4096,
                        },
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data["message"]["content"]

        except httpx.TimeoutException:
            raise RuntimeError(
                "Ollama response timed out. The model may be loading — try again in a moment."
            )
        except Exception as e:
            raise RuntimeError(f"Ollama generation error: {e}")

    def _build_system_prompt(self, base_system: str, context: str) -> str:
        """Inject RAG context into the system prompt."""
        parts = [base_system or OLLAMA_SYSTEM_PROMPT]
        if context:
            parts.append(
                "\nUse the following Python reference material to answer accurately. "
                "Cite the source when you use it.\n\n" + context
            )
        return "\n\n".join(parts)

    @property
    def is_running(self) -> bool:
        return self._is_running

    @property
    def active_model(self) -> Optional[str]:
        return self._active_model

    @property
    def available_models(self) -> List[str]:
        return self._available_models


OLLAMA_SYSTEM_PROMPT = """You are HelpBot, an expert Python and software development assistant.
You have deep knowledge of:
- Python 3 programming (syntax, idioms, standard library)
- Software design patterns and best practices
- Data structures and algorithms
- Web development (FastAPI, Django, Flask, React)
- Databases (PostgreSQL, SQLite, Redis)
- DevOps, Docker, deployment
- Machine learning basics

When answering:
1. Be precise and technically accurate
2. Always include working code examples in markdown code blocks
3. Explain WHY, not just HOW
4. Reference Python documentation or PEPs when relevant
5. If the reference material provided contains relevant info, use and cite it
6. For complex topics, structure with clear headings
7. Mention edge cases and common mistakes

Format responses in clean Markdown."""


# ── Singleton ─────────────────────────────────────────────────────────────────
ollama_service = OllamaService()
