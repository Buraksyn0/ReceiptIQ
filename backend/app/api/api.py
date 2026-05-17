from fastapi import APIRouter
from app.api.endpoints import auth, users, receipts, budgets, uploads, chat, analytics, notifications, recurring, savings_goals, tags

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(receipts.router, prefix="/receipts", tags=["receipts"])
# Faz 1: /receipts/upload altında upload endpoints
api_router.include_router(
    uploads.router, prefix="/receipts/upload", tags=["uploads"]
)
api_router.include_router(budgets.router, prefix="/budgets", tags=["budgets"])
# Faz 3: RAG + LLM chat
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
# Faz 4: Anomali tespiti + harcama tahmini
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
# Faz 6: Bildirim sistemi
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
# Faz 7: Tekrarlayan işlemler
api_router.include_router(recurring.router, prefix="/recurring", tags=["recurring"])
# Faz 8: Tasarruf hedefi
api_router.include_router(savings_goals.router, prefix="/goals", tags=["goals"])
# Faz 9: Etiket sistemi
api_router.include_router(tags.router, prefix="/tags", tags=["tags"])
