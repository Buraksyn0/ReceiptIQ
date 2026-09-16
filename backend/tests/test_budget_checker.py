"""
budget_checker.py (bütçe aşımı bildirimi) testleri. Bu servis, fiş
oluşturma akışına gömülü olarak çalışıyor (receipts.py -> create_receipt).
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.notification import Notification

# receipt_date'i AÇIKÇA belirtiyoruz — boş bırakılırsa NULL olur, ve
# budget_checker.py'nin sorgusu "receipt_date >= ayın başı" ile filtrelediği
# için NULL tarihli fişler sessizce hesaba katılmaz (dün de bu hatayı yapmıştık).
TODAY = datetime.now(timezone.utc).isoformat()


async def _get_user_id(client, token):
    res = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    return uuid.UUID(res.json()["id"])


async def test_budget_exceeded_creates_notification(client, db_session, test_user):
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}
    user_id = await _get_user_id(client, test_user["token"])

    await client.post(
        "/api/v1/budgets/",
        json={"category": "market", "limit_amount": 100},
        headers=auth_headers,
    )

    # Limiti aşan bir fiş (₺150 > ₺100 limit)
    await client.post(
        "/api/v1/receipts/",
        json={"category": "market", "receipt_type": "expense", "total_amount": 150, "receipt_date": TODAY},
        headers=auth_headers,
    )

    result = await db_session.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.notification_type == "budget_exceeded",
        )
    )
    notifications = result.scalars().all()
    assert len(notifications) == 1
    assert "Market" in notifications[0].message


async def test_budget_exceeded_notification_not_duplicated_same_month(client, db_session, test_user):
    """
    Aynı ay, aynı kategori için zaten okunmamış bir budget_exceeded
    bildirimi varsa, ikinci bir fiş daha eklense bile YENİ bildirim
    oluşturulmamalı — kullanıcının bildirim kutusu spam'lenmesin diye.
    """
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}
    user_id = await _get_user_id(client, test_user["token"])

    await client.post(
        "/api/v1/budgets/",
        json={"category": "market", "limit_amount": 100},
        headers=auth_headers,
    )

    # İlk fiş limiti aşıyor -> bildirim oluşur
    await client.post(
        "/api/v1/receipts/",
        json={"category": "market", "receipt_type": "expense", "total_amount": 150, "receipt_date": TODAY},
        headers=auth_headers,
    )
    # İkinci fiş de aynı kategoride, limit zaten aşılmış durumda
    await client.post(
        "/api/v1/receipts/",
        json={"category": "market", "receipt_type": "expense", "total_amount": 20, "receipt_date": TODAY},
        headers=auth_headers,
    )

    result = await db_session.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.notification_type == "budget_exceeded",
        )
    )
    notifications = result.scalars().all()
    assert len(notifications) == 1  # İki değil, tek bildirim
