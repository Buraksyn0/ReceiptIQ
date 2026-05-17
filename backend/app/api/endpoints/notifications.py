"""
ReceiptIQ — Bildirim Endpoint'leri

GET  /notifications/          → Kullanıcının bildirimleri (yeniden eskiye)
GET  /notifications/unread-count → Okunmamış bildirim sayısı
PATCH /notifications/{id}/read → Bildirimi okundu işaretle
PATCH /notifications/read-all  → Tüm bildirimleri okundu işaretle
"""

from __future__ import annotations
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from app.api import deps
from app.models.user import User
from app.models.notification import Notification

router = APIRouter()


@router.get("/")
async def list_notifications(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Kullanıcının tüm bildirimlerini döner (yeniden eskiye, max 50)."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifications = result.scalars().all()
    return [_serialize(n) for n in notifications]


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Okunmamış bildirim sayısını döner."""
    result = await db.execute(
        select(func.count()).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    count = result.scalar() or 0
    return {"unread_count": count}


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Tek bildirimi okundu işaretle."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalars().first()
    if not notification:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı.")

    notification.is_read = True
    db.add(notification)
    await db.commit()
    return {"ok": True}


@router.patch("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Tüm bildirimleri okundu işaretle."""
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


def _serialize(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "notification_type": n.notification_type,
        "title": n.title,
        "message": n.message,
        "receipt_id": str(n.receipt_id) if n.receipt_id else None,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
    }
