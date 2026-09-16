"""
Analytics uç noktaları testleri: kategori dağılımı ve finansal skor.
"""


async def test_categories_percentage_calculation(client, test_user):
    """
    2 market fişi (toplam 300) + 1 food fişi (100) -> market %75, food %25.
    (400 toplam üzerinden, yuvarlama sorunu olmayan temiz sayılar seçildi.)
    """
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    for amount in (200, 100):
        await client.post(
            "/api/v1/receipts/",
            json={"category": "market", "receipt_type": "expense", "total_amount": amount},
            headers=auth_headers,
        )
    await client.post(
        "/api/v1/receipts/",
        json={"category": "food", "receipt_type": "expense", "total_amount": 100},
        headers=auth_headers,
    )

    res = await client.get("/api/v1/analytics/categories", headers=auth_headers)
    data = {row["category"]: row for row in res.json()}

    assert data["market"]["total"] == 300
    assert data["market"]["percentage"] == 75.0
    assert data["food"]["total"] == 100
    assert data["food"]["percentage"] == 25.0


async def test_financial_score_with_no_data_uses_neutral_defaults(client, test_user):
    """
    Hiç fiş/bütçe/hedef olmayan taze bir kullanıcı için, kod her faktörde
    "veri yok" (nötr) dalına düşmeli:
      budget=15 (bütçe yok) + savings=12 (hedef yok) + consistency=10 (fiş yok)
      + balance=7 (gelir/gider yok) + activity=0 (fiş yok) = 44 -> D notu
    """
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    res = await client.get("/api/v1/analytics/financial-score", headers=auth_headers)
    data = res.json()

    assert data["total_score"] == 44
    assert data["grade"] == "D"

    factor_scores = {f["id"]: f["score"] for f in data["factors"]}
    assert factor_scores["budget"] == 15
    assert factor_scores["savings"] == 12
    assert factor_scores["consistency"] == 10
    assert factor_scores["balance"] == 7
    assert factor_scores["activity"] == 0
