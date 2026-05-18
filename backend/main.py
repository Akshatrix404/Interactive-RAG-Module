from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import asyncio
import logging

from routes import auth, chat, admin
from models.db import init_db
from middleware.auth import get_current_user
from models.database import User

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(name)s | %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="HelpDesk AI API",
    description="AI helpdesk with Ollama + Gemini Flash + RAG (Python docs)",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    logger.info("Starting HelpDesk AI Backend v2.0 ...")

    await init_db()

    from services.ollama_service import ollama_service
    ollama_ok = await ollama_service.check_connection()

    if ollama_ok:
        logger.info(
            f"Ollama ready — active model: {ollama_service.active_model}"
        )
    else:
        logger.info(
            "Ollama not running — will use Gemini Flash as primary"
        )

    from services.rag_service import rag_service
    asyncio.create_task(_init_rag(rag_service))

    logger.info("Server ready at http://localhost:8000")


async def _init_rag(rag_service):
    try:
        await rag_service.initialize()
    except Exception as e:
        logger.error(f"RAG init failed: {e}")


@app.get("/api/health")
async def health():
    from services.rag_service import rag_service
    from services.ollama_service import ollama_service

    return {
        "status": "healthy",
        "version": "2.0.0",
        "rag": rag_service.stats(),
        "ollama": {
            "running": ollama_service.is_running,
            "model": ollama_service.active_model
        },
    }


@app.get("/api/me")
async def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "is_admin": current_user.is_admin,
        "created_at": current_user.created_at.isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("APP_HOST", "0.0.0.0"),
        port=int(os.getenv("APP_PORT", "8000")),
        reload=True
    )