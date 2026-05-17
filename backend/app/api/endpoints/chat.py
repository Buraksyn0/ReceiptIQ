"""
/api/v1/chat — RAG tabanlı LLM chat endpoint'i
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import deps
from app.models.user import User
from app.models.receipt import Receipt
from app.models.savings_goal import SavingsGoal

router = APIRouter()


class HistoryMessage(BaseModel):
    role: str  # "user" veya "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str
    history: list[HistoryMessage] = []


class ChatResponse(BaseModel):
    answer: str


@router.post("/", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Kullanıcının sorusunu alır, RAG + DB analitik + GPT-4o ile yanıtlar.
    """
    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=400, detail="Soru boş olamaz.")

    from app.services.chat import chat_with_receipts

    history = [{"role": m.role, "content": m.content} for m in payload.history]
    answer = await chat_with_receipts(
        db=db,
        user_id=current_user.id,
        question=payload.question,
        history=history,
    )
    return ChatResponse(answer=answer)


@router.post("/financial-score", response_model=ChatResponse)
async def financial_score_chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Finansal skor bağlamlı AI asistan.
    """
    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=400, detail="Soru boş olamaz.")

    from app.services.chat import chat_with_financial_score

    history = [{"role": m.role, "content": m.content} for m in payload.history]
    answer = await chat_with_financial_score(
        db=db,
        user_id=current_user.id,
        question=payload.question,
        history=history,
    )
    return ChatResponse(answer=answer)


@router.post("/savings", response_model=ChatResponse)
async def savings_chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Tasarruf hedefi bağlamlı AI asistan.
    """
    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=400, detail="Soru boş olamaz.")

    from app.services.chat import chat_with_savings_goal

    history = [{"role": m.role, "content": m.content} for m in payload.history]
    answer = await chat_with_savings_goal(
        db=db,
        user_id=current_user.id,
        question=payload.question,
        history=history,
    )
    return ChatResponse(answer=answer)
