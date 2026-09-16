"""
scheduler.py'nin process_all_recurring cron işi için test.

Bu fonksiyon kendi veritabanı oturumunu kendisi açıyor (AsyncSessionLocal,
gerçek/production veritabanına bağlı) — testte bizim test veritabanımıza
yönlendirmek için bunu geçici olarak "yamalıyoruz" (patch).
"""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlalchemy import select

from app.core import scheduler
from app.models.receipt import Receipt
from app.models.recurring import RecurringTransaction
from tests.conftest import TestSessionLocal


async def _get_user_id(client, token):
    res = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    return uuid.UUID(res.json()["id"])


async def test_process_all_recurring_creates_receipt_and_advances_date(
    client, db_session, test_user
):
    user_id = await _get_user_id(client, test_user["token"])

    past_date = datetime.now(timezone.utc) - timedelta(days=1)
    recurring = RecurringTransaction(
        user_id=user_id,
        merchant_name="Netflix",
        amount=100,
        category="subscriptions",
        receipt_type="expense",
        frequency="monthly",
        next_date=past_date,
        is_active=True,
    )
    db_session.add(recurring)
    await db_session.commit()
    await db_session.refresh(recurring)

    # scheduler.py kendi AsyncSessionLocal'ını açıyor — test veritabanımıza yönlendiriyoruz
    with patch("app.core.scheduler.AsyncSessionLocal", TestSessionLocal):
        await scheduler.process_all_recurring()

    # Otomatik fiş oluşmuş mu?
    receipt_result = await db_session.execute(
        select(Receipt).where(Receipt.user_id == user_id, Receipt.merchant_name == "Netflix")
    )
    receipt = receipt_result.scalars().first()
    assert receipt is not None
    assert float(receipt.total_amount) == 100.0

    # next_date ileri alınmış mı? (aylık -> yaklaşık 1 ay sonrasına gitmeli)
    await db_session.refresh(recurring)
    assert recurring.next_date > past_date
