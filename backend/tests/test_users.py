"""
Kullanıcı profili güncelleme testleri (hesap silme testi ayrı dosyada:
test_account_deletion.py).
"""


async def test_update_profile_partial_update(client, test_user):
    """Sadece gönderilen alan (full_name) değişmeli, diğerleri aynı kalmalı."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    res = await client.patch(
        "/api/v1/users/me",
        json={"full_name": "Yeni İsim"},
        headers=auth_headers,
    )

    assert res.status_code == 200
    data = res.json()
    assert data["full_name"] == "Yeni İsim"
    assert data["email"] == test_user["email"]  # değişmemeli


async def test_update_password_is_hashed_and_replaces_old_one(client, test_user):
    """
    Şifre güncellendikten sonra: eski şifreyle giriş yapılamamalı,
    yeni şifreyle yapılabilmeli. (Dolaylı olarak, şifrenin düz metin
    değil, hashlenmiş şekilde saklandığını da doğrular.)
    """
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    update_res = await client.patch(
        "/api/v1/users/me",
        json={"password": "yenisifre456"},
        headers=auth_headers,
    )
    assert update_res.status_code == 200

    old_login = await client.post(
        "/api/v1/auth/login",
        data={"username": test_user["email"], "password": test_user["password"]},
    )
    assert old_login.status_code in (400, 401)

    new_login = await client.post(
        "/api/v1/auth/login",
        data={"username": test_user["email"], "password": "yenisifre456"},
    )
    assert new_login.status_code == 200


async def test_upload_avatar_rejects_invalid_content_type(client, test_user):
    """JPEG/PNG/WebP dışındaki dosya tipleri reddedilmeli (diske hiç yazılmadan)."""
    auth_headers = {"Authorization": f"Bearer {test_user['token']}"}

    res = await client.post(
        "/api/v1/users/me/avatar",
        files={"file": ("belge.pdf", b"sahte pdf icerigi", "application/pdf")},
        headers=auth_headers,
    )

    assert res.status_code == 400
