"""
Auth akışı testleri: kayıt, giriş ve şifre sıfırlama rate limiting.
"""


async def test_signup_and_login(client):
    """Yeni bir kullanıcı kayıt olup, aynı bilgilerle giriş yapabilmeli."""
    email = "signup_test@test.com"
    password = "testpass123"

    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "full_name": "Signup Test"},
    )
    assert signup_res.status_code == 200

    login_res = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


async def test_login_wrong_password_fails(client, test_user):
    """Yanlış şifreyle giriş denemesi reddedilmeli."""
    res = await client.post(
        "/api/v1/auth/login",
        data={"username": test_user["email"], "password": "yanlis_sifre"},
    )
    assert res.status_code in (400, 401)


async def test_signup_duplicate_email_fails(client):
    """Aynı e-posta ile iki kez kayıt olunamamalı."""
    payload = {
        "email": "duplicate_test@test.com",
        "password": "testpass123",
        "full_name": "Duplicate Test",
    }

    # İlk kayıt — başarılı olmalı
    first_res = await client.post("/api/v1/auth/signup", json=payload)
    assert first_res.status_code == 200

    # Aynı bilgilerle ikinci kayıt denemesi — reddedilmeli
    second_res = await client.post("/api/v1/auth/signup", json=payload)
    assert second_res.status_code == 400


async def test_forgot_password_same_response_for_nonexistent_email(client, test_user):
    """
    Kayıtlı bir e-posta ile hiç kayıtlı olmayan bir e-posta, /forgot-password'a
    AYNI cevabı (aynı durum kodu + aynı mesaj metni) almalı. Aksi halde
    saldırgan, cevaptaki farktan hangi e-postaların kayıtlı olduğunu
    anlayabilir (email enumeration saldırısı).
    """
    existing_res = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": test_user["email"]},
    )
    nonexistent_res = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "hic_kayitli_olmayan_biri@test.com"},
    )

    assert existing_res.status_code == 200
    assert nonexistent_res.status_code == 200
    # En kritik satır: mesaj metni de BİREBİR aynı olmalı
    assert existing_res.json() == nonexistent_res.json()


async def test_reset_password_is_rate_limited(client):
    """
    /auth/reset-password, aynı IP'den 5 istekten sonra 6.'da 429 (Too Many
    Requests) dönmeli. Bu test, bugün kapattığımız brute-force güvenlik
    açığının (6 haneli kodu deneme deneme bulma) bir daha açılmamasını
    garanti eder.
    """
    payload = {
        "email": "ratelimit_test@test.com",
        "code": "000000",
        "new_password": "yenisifre123",
    }

    for _ in range(5):
        res = await client.post("/api/v1/auth/reset-password", json=payload)
        assert res.status_code == 400  # yanlış kod — ama henüz rate limit'e takılmadı

    sixth = await client.post("/api/v1/auth/reset-password", json=payload)
    assert sixth.status_code == 429
