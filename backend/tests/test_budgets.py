"""
Bütçe (budget) oluşturma ve "harcanan tutar" hesaplama testleri.
"""


async def test_create_budget(client, test_user):
    """Giriş yapmış kullanıcı bütçe oluşturabilmeli."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    res = await client.post(
        "/api/v1/budgets/",
        json={"category": "market", "limit_amount": 500},
        headers=auth_headers,
    )

    assert res.status_code == 201
    data = res.json()
    assert data["category"] == "market"
    assert data["limit_amount"] == 500


async def test_budget_spent_amount_calculation(client, test_user):
    """
    spent_amount, sadece AYNI kategorideki VE "expense" (gider) tipindeki
    fişleri toplamalı — farklı kategori ya da "income" (gelir) fişleri
    hesaba katılmamalı.
    """
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    await client.post(
        "/api/v1/budgets/",
        json={"category": "market", "limit_amount": 500},
        headers=auth_headers,
    )

    # Sayılması gereken iki fiş (market + expense)
    await client.post(
        "/api/v1/receipts/",
        json={"category": "market", "receipt_type": "expense", "total_amount": 100},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/receipts/",
        json={"category": "market", "receipt_type": "expense", "total_amount": 50},
        headers=auth_headers,
    )

    # Sayılmaması gereken iki fiş (yanlış kategori / yanlış tip)
    await client.post(
        "/api/v1/receipts/",
        json={"category": "food", "receipt_type": "expense", "total_amount": 200},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/receipts/",
        json={"category": "market", "receipt_type": "income", "total_amount": 1000},
        headers=auth_headers,
    )

    res = await client.get("/api/v1/budgets/", headers=auth_headers)
    budgets = res.json()

    assert len(budgets) == 1
    assert budgets[0]["spent_amount"] == 150.0
