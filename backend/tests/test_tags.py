"""
Etiket (tag) doğrulama ve fişe etiket ekleme testleri.
"""
from sqlalchemy import select

from app.models.tag import ReceiptTag


async def test_create_tag_rejects_empty_name(client, test_user):
    """Boş (veya sadece boşluk) etiket adı reddedilmeli."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    res = await client.post(
        "/api/v1/tags/",
        json={"name": "   ", "color": "#00A878"},
        headers=auth_headers,
    )
    assert res.status_code == 400


async def test_add_tag_to_receipt_is_idempotent(client, test_user, db_session):
    """
    Bir etiketi bir fişe iki kez eklemeye çalışmak hataya değil, "zaten ekli"
    mesajına yol açmalı — VE veritabanında tek bir ReceiptTag satırı olmalı
    (ikinci istek yanlışlıkla yinelenen kayıt oluşturmamalı).
    """
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    tag_res = await client.post(
        "/api/v1/tags/", json={"name": "İş", "color": "#00A878"}, headers=auth_headers
    )
    tag_id = tag_res.json()["id"]

    receipt_res = await client.post(
        "/api/v1/receipts/",
        json={"merchant_name": "Ofis Marketi", "total_amount": 30},
        headers=auth_headers,
    )
    receipt_id = receipt_res.json()["id"]

    # Etiketi ilk kez ekle
    first = await client.post(
        f"/api/v1/tags/receipts/{receipt_id}/tags/{tag_id}", headers=auth_headers
    )
    assert first.status_code == 201

    # AYNI etiketi tekrar eklemeye çalış
    second = await client.post(
        f"/api/v1/tags/receipts/{receipt_id}/tags/{tag_id}", headers=auth_headers
    )
    assert second.status_code == 201
    assert second.json()["detail"] == "Etiket zaten ekli."

    # Veritabanında hâlâ tek bir kayıt olmalı, iki değil
    result = await db_session.execute(
        select(ReceiptTag).where(
            ReceiptTag.receipt_id == receipt_id,
            ReceiptTag.tag_id == tag_id,
        )
    )
    rows = result.scalars().all()
    assert len(rows) == 1
