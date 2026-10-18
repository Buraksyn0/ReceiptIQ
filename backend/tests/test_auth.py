"""
Auth akışı testleri: kayıt, giriş ve şifre sıfırlama rate limiting.
"""


async def test_signup_and_login(client, sent_verification_emails):
    """Yeni kullanıcı kayıt olup e-postasını doğruladıktan sonra giriş yapabilmeli."""
    email = "signup_test@test.com"
    password = "testpass123"

    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "full_name": "Signup Test"},
    )
    assert signup_res.status_code == 200

    _, code = sent_verification_emails[-1]
    verify_res = await client.post(
        "/api/v1/auth/verify-email", json={"email": email, "code": code}
    )
    assert verify_res.status_code == 200

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


async def test_signup_duplicate_email_fails(client, verify_email):
    """
    Aynı e-posta ile iki kez kayıt olunamamalı — e-postası doğrulanmış hesapta.
    (Doğrulanmamış kayıt başkası tarafından devralınabilir, bkz. test_email_verification.py)
    """
    payload = {
        "email": "duplicate_test@test.com",
        "password": "testpass123",
        "full_name": "Duplicate Test",
    }

    # İlk kayıt — başarılı olmalı
    first_res = await client.post("/api/v1/auth/signup", json=payload)
    assert first_res.status_code == 200
    await verify_email(payload["email"])

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


async def test_forgot_password_sends_six_digit_code_only_for_existing_user(
    client, test_user, sent_reset_emails
):
    await client.post("/api/v1/auth/forgot-password", json={"email": "yok@test.com"})
    assert sent_reset_emails == []  # kayıtsız adrese kod gitmez (ama yanıt aynı)

    await client.post("/api/v1/auth/forgot-password", json={"email": test_user["email"]})
    assert len(sent_reset_emails) == 1
    to_email, code = sent_reset_emails[0]
    assert to_email == test_user["email"]
    assert len(code) == 6 and code.isdigit()


async def test_reset_password_with_correct_code_works(client, test_user, sent_reset_emails):
    await client.post("/api/v1/auth/forgot-password", json={"email": test_user["email"]})
    _, code = sent_reset_emails[-1]

    res = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": test_user["email"], "code": code, "new_password": "yenisifre123"},
    )
    assert res.status_code == 200

    login = await client.post(
        "/api/v1/auth/login",
        data={"username": test_user["email"], "password": "yenisifre123"},
    )
    assert login.status_code == 200


async def test_reset_code_is_locked_after_too_many_wrong_attempts(
    client, test_user, sent_reset_emails
):
    """5 yanlış denemeden sonra doğru kod bile kabul edilmemeli; şifre değişmemeli."""
    await client.post("/api/v1/auth/forgot-password", json={"email": test_user["email"]})
    _, code = sent_reset_emails[-1]
    wrong = "000000" if code != "000000" else "111111"

    def attempt(c):
        return client.post(
            "/api/v1/auth/reset-password",
            json={"email": test_user["email"], "code": c, "new_password": "yenisifre123"},
        )

    for _ in range(5):
        assert (await attempt(wrong)).status_code == 400

    # IP başına dakikalık sınır (429) ayrı bir koruma. Burada saldırganın başka IP'den
    # ya da sonra denemesini taklit edip, KODUN kendi kilidini sınıyoruz.
    from app.api.endpoints import auth as auth_endpoints
    from app.main import app
    app.state.limiter.reset()
    auth_endpoints.limiter.reset()

    assert (await attempt(code)).status_code == 400  # doğru kod ama kilitli

    # Şifre değişmedi: eski şifre hâlâ geçerli
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": test_user["email"], "password": test_user["password"]},
    )
    assert login.status_code == 200


async def test_reset_password_email_is_case_insensitive(client, test_user, sent_reset_emails):
    """Büyük harfle yazılmış e-postayla da kod isteyip sıfırlamak mümkün olmalı."""
    upper = test_user["email"].upper()
    await client.post("/api/v1/auth/forgot-password", json={"email": upper})
    assert len(sent_reset_emails) == 1
    _, code = sent_reset_emails[-1]

    res = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": upper, "code": code, "new_password": "yenisifre123"},
    )
    assert res.status_code == 200
