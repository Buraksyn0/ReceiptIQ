"""
Tasarruf hedefi (savings goal) iş kuralları ve ilerleme hesaplama testleri.
"""
from datetime import datetime, timezone


async def test_create_goal_deactivates_previous_active_goal(client, test_user):
    """Yeni bir hedef oluşturunca, var olan aktif hedef otomatik pasife alınmalı."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    first_res = await client.post(
        "/api/v1/goals/",
        json={"title": "Tatil Fonu", "target_amount": 5000},
        headers=auth_headers,
    )
    first_id = first_res.json()["id"]
    assert first_res.json()["is_active"] is True

    second_res = await client.post(
        "/api/v1/goals/",
        json={"title": "Yeni Laptop", "target_amount": 20000},
        headers=auth_headers,
    )
    assert second_res.json()["is_active"] is True

    # İlk hedef artık pasif olmalı
    list_res = await client.get("/api/v1/goals/", headers=auth_headers)
    goals_by_id = {g["id"]: g for g in list_res.json()}
    assert goals_by_id[first_id]["is_active"] is False


async def test_goal_progress_calculation(client, test_user):
    """
    saved_amount = gelir - gider, progress_percent = saved_amount / target * 100
    olmalı. Hedef ₺1000, ₺600 gelir + ₺100 gider -> tasarruf ₺500, ilerleme %50.
    """
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    await client.post(
        "/api/v1/goals/",
        json={"title": "Test Hedefi", "target_amount": 1000},
        headers=auth_headers,
    )

    # receipt_date'i AÇIKÇA belirtiyoruz — boş bırakılırsa NULL olur, ve
    # progress sorgusu "receipt_date >= goal.created_at" ile filtrelediği
    # için NULL tarihli fişler sessizce hesaba katılmaz.
    today = datetime.now(timezone.utc).isoformat()
    await client.post(
        "/api/v1/receipts/",
        json={"receipt_type": "income", "total_amount": 600, "category": "salary", "receipt_date": today},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/receipts/",
        json={"receipt_type": "expense", "total_amount": 100, "category": "food", "receipt_date": today},
        headers=auth_headers,
    )

    res = await client.get("/api/v1/goals/progress", headers=auth_headers)
    data = res.json()

    assert data["saved_amount"] == 500
    assert data["progress_percent"] == 50.0
