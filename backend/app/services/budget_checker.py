"""
ReceiptIQ — Bütçe Aşımı Kontrolü

Receipt kaydedildikten sonra çağrılır.
İlgili kategoride bütçe varsa ve toplam harcama limiti aştıysa
'budget_exceeded' tipinde bir bildirim oluşturur.

Duplicate önleme: Aynı ay için aynı kategori için zaten okunmamış bir
budget_exceeded bildirimi varsa yeni bildirim oluşturulmaz.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.budget import Budget
from app.models.receipt import Receipt
from app.models.notification import Notification

# Frontend'deki CATEGORIES sabitiyle senkronize etiket haritası
_CATEGORY_LABELS: dict[str, str] = {
    "food": "Gıda",
    "market": "Market",
    "shopping": "Alışveriş",
    "transport": "Ulaşım",
    "entertainment": "Eğlence",
    "rent": "Kira/Fatura",
    "salary": "Maaş/Gelir",
    "education": "Eğitim",
    "sports": "Spor",
    "clothing": "Giyim",
    "fuel": "Yakıt",
    "health": "Sağlık",
    "personal_care": "Kişisel Bakım",
    "subscriptions": "Abonelik",
    "other": "Diğer",
}


async def check_and_notify_budget(
    db: AsyncSession,
    user_id: uuid.UUID,
    category: str,
    receipt_id: uuid.UUID | None = None,
) -> None:
    """
    Verilen kategori için bütçe limitini kontrol eder.
    Limit aşıldıysa ve bu ay için henüz bildirim gönderilmediyse bildirim oluşturur.
    """
    if not category:
        return

    # Bu kategoride bütçe var mı?
    budget_result = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.category == category,
        )
    )
    budget = budget_result.scalars().first()
    if not budget:
        return

    # Bu ay bu kategoride toplam harcama
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    spent_result = await db.execute(
        select(func.coalesce(func.sum(Receipt.total_amount), 0))
        .where(
            Receipt.user_id == user_id,
            Receipt.category == category,
            Receipt.receipt_type == "expense",
            Receipt.receipt_date >= month_start,
        )
    )
    total_spent = float(spent_result.scalar() or 0)
    limit = float(budget.limit_amount)

    if total_spent < limit:
        return  # Limit aşılmadı

    # Bu ay için zaten okunmamış budget_exceeded bildirimi var mı?
    existing_result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.notification_type == "budget_exceeded",
            Notification.is_read == False,
            Notification.created_at >= month_start,
            Notification.message.contains(category),
        )
    )
    existing = existing_result.scalars().first()
    if existing:
        return  # Zaten bildirildi

    # Bütçe aşıldı → bildirim oluştur
    overflow = total_spent - limit
    cat_label = _CATEGORY_LABELS.get(category, category)  # ID yoksa orijinali kullan
    notif = Notification(
        user_id=user_id,
        notification_type="budget_exceeded",
        receipt_id=receipt_id,
        title="Bütçe Limiti Aşıldı!",
        message=(
            f'"{cat_label}" kategorisinde aylık ₺{limit:,.2f} limitini '
            f'₺{overflow:,.2f} aştınız. Toplam harcama: ₺{total_spent:,.2f}.'
        ),
    )
    db.add(notif)
    # commit çağırana bırakıyoruz — zaten receipt commit'inden sonra çağrılıyor
    await db.flush()

    # E-posta + Push bildirimi gönder
    try:
        from sqlalchemy import select as sa_select
        from app.models.user import User
        from app.services.email_service import send_budget_exceeded_email
        from app.services.push_service import send_push
        import asyncio

        user_result = await db.execute(
            sa_select(User.email, User.push_token).where(User.id == user_id)
        )
        user_row = user_result.first()
        if user_row:
            user_email, push_token = user_row

            if user_email:
                asyncio.create_task(
                    send_budget_exceeded_email(user_email, cat_label, total_spent, limit)
                )

            asyncio.create_task(
                send_push(
                    token=push_token,
                    title="⚠️ Bütçe Limiti Aşıldı!",
                    body=f'"{cat_label}" kategorisinde ₺{limit:,.0f} limitini ₺{overflow:,.0f} aştınız.',
                    data={"type": "budget_exceeded", "category": category},
                )
            )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Bütçe bildirimi gönderilemedi: %s", e)
