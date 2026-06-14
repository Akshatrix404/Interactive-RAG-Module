"""
Iris AI Backend — main.py

Entrypoint
- Creates the FastAPI app
- Registers API routers under /api
- Triggers DB init at startup
- Initializes RAG asynchronously and checks Ollama availability
"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os, asyncio, logging

# ── Internal imports (everything lives in backend.py + database.py) ──────────
from backend import (
    # Routers
    auth_router, chat_router, admin_router, orders_router, returns_router,
    # Auth helper (used by /api/me)
    get_current_user,
)
from database import User, init_db

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Iris AI API",
    version="4.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router,    prefix="/api")
app.include_router(chat_router,    prefix="/api")
app.include_router(admin_router,   prefix="/api")
app.include_router(orders_router,  prefix="/api")
app.include_router(returns_router, prefix="/api")


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Starting Iris AI Backend v4.0 ...")
    await init_db()

    from backend import ollama_service
    if await ollama_service.check_connection():
        logger.info(f"✅ Ollama ready — model: {ollama_service.active_model}")
    else:
        logger.warning("⚠️  Ollama not running — AI responses will be limited")

    from backend import rag_service
    asyncio.create_task(rag_service.initialize())
    logger.info("✅ Server ready at http://localhost:8000")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    from backend import rag_service, ollama_service
    return {
        "status": "healthy",
        "version": "4.0.0",
        "rag": rag_service.stats(),
        "ollama": {
            "running": ollama_service.is_running,
            "model": ollama_service.active_model,
        },
    }


@app.get("/api/me")
async def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "id":         str(current_user.id),
        "email":      current_user.email,
        "username":   current_user.username,
        "full_name":  current_user.full_name,
        "is_admin":   current_user.is_admin,
        "created_at": current_user.created_at.isoformat(),
    }


# ── Dev runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("APP_PORT", "8000")),
        reload=True,
    )
