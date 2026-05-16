from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import List, Optional
import uuid, json

from models.db       import get_db
from models.database import User, ChatSession, ChatMessage
from middleware.auth import get_current_user
from services.unified_ai import unified_ai

router = APIRouter(prefix="/chat", tags=["Chat"])

class SendMessageRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    provider: Optional[str] = "auto"

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    sources: Optional[List[str]] = None
    provider: Optional[str] = None
    created_at: str
    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    message_count: int = 0

class ChatResponse(BaseModel):
    session_id: str
    message: MessageResponse

@router.post("/send", response_model=ChatResponse)
async def send_message(
    request: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    session = None
    if request.session_id:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == request.session_id,
                ChatSession.user_id == current_user.id,
            )
        )
        session = result.scalar_one_or_none()

    if not session:
        title = request.query[:60] + ("..." if len(request.query) > 60 else "")
        session = ChatSession(id=uuid.uuid4(), user_id=current_user.id, title=title)
        db.add(session)
        await db.flush()

    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
        .limit(20)
    )
    history = [{"role": m.role, "content": m.content} for m in history_result.scalars().all()]

    user_msg = ChatMessage(id=uuid.uuid4(), session_id=session.id, role="user", content=request.query)
    db.add(user_msg)

    ai_result = await unified_ai.get_response(
        query=request.query,
        conversation_history=history,
        preferred_provider=request.provider or "auto",
    )

    assistant_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="assistant",
        content=ai_result["answer"],
        sources=json.dumps({
            "sources":  ai_result.get("sources", []),
            "provider": ai_result.get("provider", ""),
            "rag_used": ai_result.get("rag_used", False),
        }),
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    meta = json.loads(assistant_msg.sources) if assistant_msg.sources else {}
    return ChatResponse(
        session_id=str(session.id),
        message=MessageResponse(
            id=str(assistant_msg.id),
            role=assistant_msg.role,
            content=assistant_msg.content,
            sources=meta.get("sources", []),
            provider=meta.get("provider", ""),
            created_at=assistant_msg.created_at.isoformat(),
        ),
    )

@router.get("/sessions", response_model=List[SessionResponse])
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.user_id == current_user.id).order_by(desc(ChatSession.created_at))
    )
    sessions = result.scalars().all()
    out = []
    for s in sessions:
        cnt = await db.execute(select(ChatMessage).where(ChatMessage.session_id == s.id))
        out.append(SessionResponse(id=str(s.id), title=s.title, created_at=s.created_at.isoformat(), message_count=len(cnt.scalars().all())))
    return out

@router.get("/sessions/{session_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s_result = await db.execute(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id))
    if not s_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")
    result = await db.execute(select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at))
    out = []
    for m in result.scalars().all():
        meta = {}
        if m.sources:
            try: meta = json.loads(m.sources)
            except: meta = {}
        out.append(MessageResponse(id=str(m.id), role=m.role, content=m.content, sources=meta.get("sources", []), provider=meta.get("provider", ""), created_at=m.created_at.isoformat()))
    return out

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"message": "Session deleted"}

@router.get("/status")
async def ai_status(current_user: User = Depends(get_current_user)):
    return await unified_ai.status()

@router.get("/rag/stats")
async def rag_stats(current_user: User = Depends(get_current_user)):
    from services.rag_service import rag_service
    return rag_service.stats()
