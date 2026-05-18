from fastapi import APIRouter, UploadFile, File, Depends
from middleware.auth import get_admin_user
from models.database import User
from pathlib import Path
from services.sop_ingestion import ingest_sop_file
from services.rag_service import rag_service

router = APIRouter(prefix="/admin", tags=["Admin"])

UPLOAD_DIR = Path("uploads/sops")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/me")
async def admin_me(current_user: User = Depends(get_admin_user)):
    return {
        "email": current_user.email,
        "username": current_user.username
    }


@router.post("/upload-sops")
async def upload_sops(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_admin_user)
):
    results = []

    for file in files:
        file_path = UPLOAD_DIR / file.filename

        with open(file_path, "wb") as f:
            f.write(await file.read())

        chunks = await ingest_sop_file(file_path, rag_service)

        results.append({
            "filename": file.filename,
            "chunks": chunks
        })

    return {
        "message": "SOPs uploaded successfully",
        "files": results
    }