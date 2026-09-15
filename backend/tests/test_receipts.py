"""
Fiş (receipt) CRUD ve sahiplik izolasyonu testleri.
"""


async def test_create_receipt(client, test_user):
    """Giriş yapmış bir kullanıcı fiş oluşturabilmeli."""
    payload = {
        "merchant_name": "Migros",
        "total_amount": 150.50,
        "category": "market",
        "receipt_type": "expense",
    }

    res = await client.post(
        "/api/v1/receipts/",
        json=payload,
        headers={"Authorization": f"Bearer {test_user['token']}"},
    )

    assert res.status_code == 201
    data = res.json()
    assert data["merchant_name"] == "Migros"
    assert float(data["total_amount"]) == 150.50
    assert data["category"] == "market"


async def test_cannot_read_another_users_receipt(client, test_user):
    """
    Kullanıcı A'nın fişine, Kullanıcı B'nin token'ıyla erişilmeye
    çalışılırsa 404 dönmeli — fiş "yok" gibi davranılmalı, "bu fişe
    erişimin yok" (403) denilmemeli, aksi halde fişin VAR OLDUĞU bilgisi
    sızmış olur.
    """
    # Kullanıcı A (test_user fixture'ından) bir fiş oluşturuyor
    create_res = await client.post(
        "/api/v1/receipts/",
        json={"merchant_name": "Kullanıcı A'nın Marketi", "total_amount": 50},
        headers={"Authorization": f"Bearer {test_user['token']}"},
    )
    receipt_id = create_res.json()["id"]

    # Kullanıcı B'yi elle oluşturup giriş yaptırıyoruz
    b_email = "kullanici_b@test.com"
    b_password = "testpass123"
    await client.post(
        "/api/v1/auth/signup",
        json={"email": b_email, "password": b_password, "full_name": "Kullanici B"},
    )
    b_login = await client.post(
        "/api/v1/auth/login",
        data={"username": b_email, "password": b_password},
    )
    b_token = b_login.json()["access_token"]

    # Kullanıcı B, Kullanıcı A'nın fişini okumaya çalışıyor
    res = await client.get(
        f"/api/v1/receipts/{receipt_id}",
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert res.status_code == 404


async def test_delete_receipt(client, test_user):
    """Bir fiş silindikten sonra artık okunamamalı."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    # HAZIRLA: silinecek fişi önce oluşturuyoruz
    create_res = await client.post(
        "/api/v1/receipts/",
        json={"merchant_name": "Silinecek Fiş", "total_amount": 25},
        headers=auth_headers,
    )
    receipt_id = create_res.json()["id"]

    # UYGULA: fişi sil
    delete_res = await client.delete(
        f"/api/v1/receipts/{receipt_id}",
        headers=auth_headers,
    )
    # DOĞRULA (1): silme isteği 204 (No Content) dönmeli
    assert delete_res.status_code == 204

    # DOĞRULA (2): fiş gerçekten gitmiş mi, tekrar okumayı dene
    read_res = await client.get(
        f"/api/v1/receipts/{receipt_id}",
        headers=auth_headers,
    )
    assert read_res.status_code == 404
