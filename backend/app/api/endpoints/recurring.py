import calendar
from datetime import datetime, timedelta
from typing import List
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.api import deps
from app.models.user import User
from app.models.recurring import RecurringTransaction
from app.models.receipt import Receipt
from app.schemas.recurring import RecurringCreate, RecurringUpdate, RecurringOut

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def _send_push_notification(push_token: str, names: list[str]) -> None:
    """Kullanıcıya Expo push bildirimi gönderir."""
    if not push_token or not push_token.startswith("ExponentPushToken"):
        return
    if len(names) == 1:
        title = "Otomatik Ödeme İşlendi 💳"
        body = f"{names[0]} ödemeni otomatik olarak kaydettik."
    else:
        title = f"{len(names)} Otomatik Ödeme İşlendi 💳"
        body = ", ".join(names[:3])
        if len(names) > 3:
            body += f" ve {len(names) - 3} diğeri"

    message = {
        "to": push_token,
        "title": title,
        "body": body,
        "sound": "default",
        "data": {"type": "recurring"},
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=[message],
                headers={"Content-Type": "application/json"},
            )
            pass
    except Exception:
        pass  # Bildirim hatası ana akışı bozmasın

router = APIRouter()


def _next_date_after(current: datetime, frequency: str) -> datetime:
    """Bir sonraki tekrar tarihini hesaplar."""
    if frequency == "daily":
        return current + timedelta(days=1)
    elif frequency == "weekly":
        return current + timedelta(weeks=1)
    elif frequency == "yearly":
        return current.replace(year=current.year + 1)
    else:  # monthly (default)
        month = current.month + 1
        year = current.year
        if month > 12:
            month = 1
            year += 1
        max_day = calendar.monthrange(year, month)[1]
        day = min(current.day, max_day)
        return current.replace(year=year, month=month, day=day)


async def _get_owned(
    recurring_id: UUID, db: AsyncSession, user: User
) -> RecurringTransaction:
    result = await db.execute(
        select(RecurringTransaction).where(
            RecurringTransaction.id == recurring_id,
            RecurringTransaction.user_id == user.id,
        )
    )
    obj = result.scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    return obj


@router.get("/", response_model=List[RecurringOut])
async def list_recurring(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Kullanıcının tüm tekrarlayan işlemlerini listele."""
    result = await db.execute(
        select(RecurringTransaction)
        .where(RecurringTransaction.user_id == current_user.id)
        .order_by(RecurringTransaction.next_date)
    )
    return result.scalars().all()


@router.post("/", response_model=RecurringOut, status_code=status.HTTP_201_CREATED)
async def create_recurring(
    data: RecurringCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Yeni tekrarlayan işlem oluştur."""
    obj = RecurringTransaction(**data.model_dump(), user_id=current_user.id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{recurring_id}", response_model=RecurringOut)
async def update_recurring(
    recurring_id: UUID,
    data: RecurringUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Tekrarlayan işlemi güncelle (aktif/pasif dahil)."""
    obj = await _get_owned(recurring_id, db, current_user)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{recurring_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring(
    recurring_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Tekrarlayan işlemi sil."""
    obj = await _get_owned(recurring_id, db, current_user)
    await db.delete(obj)
    await db.commit()
    return None


@router.post("/check", response_model=List[RecurringOut])
async def check_and_apply_recurring(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Vadesi gelen aktif tekrarlayan işlemleri otomatik fişe çevirir
    ve next_date'i ileri alır.
    Uygulama açılışında veya dashboard yüklendiğinde çağrılabilir.
    """
    now = datetime.utcnow()
    result = await db.execute(
        select(RecurringTransaction).where(
            RecurringTransaction.user_id == current_user.id,
            RecurringTransaction.is_active == True,
            RecurringTransaction.next_date <= now,
        )
    )
    due_items = result.scalars().all()
    applied = []

    for item in due_items:
        # Otomatik fiş oluştur
        new_receipt = Receipt(
            user_id=current_user.id,
            merchant_name=item.merchant_name,
            total_amount=item.amount,
            category=item.category,
            receipt_type=item.receipt_type,
            receipt_date=now,
            text_content="Otomatik tekrarlayan işlem",
        )
        db.add(new_receipt)

        # next_date'i güncelle
        item.next_date = _next_date_after(item.next_date, item.frequency)
        db.add(item)
        applied.append(item)

    await db.commit()
    for item in applied:
        await db.refresh(item)

    # İşlem yapıldıysa push bildirimi gönder
    if applied and current_user.push_token:
        names = [item.merchant_name for item in applied]
        await _send_push_notification(current_user.push_token, names)

    return applied
