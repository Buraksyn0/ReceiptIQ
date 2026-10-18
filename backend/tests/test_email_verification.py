"""
E-posta doğrulama (kayıt OTP) testleri.

Kayıt sonrası kod e-postaya gider; doğrulanana kadar şifreyle giriş yapılamaz.
Bu sayede biri başkasının e-postasıyla hesap açıp, o kişinin hesabını
"önceden ele geçiremez" (kayıt önceden ele geçirme / pre-hijacking).

E-posta gönderimi conftest.py'de sahtelenmiş; gönderilen kodlar
`sent_verification_emails` listesinden okunur.
"""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import update

from app.models.email_verification import EmailVerificationCode

EMAIL = "yeni_kullanici@test.com"
PASSWORD = "testpass123"


async def _signup(client, email=EMAIL):
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": PASSWORD, "full_name": "Yeni Kullanıcı"},
    )
    assert res.status_code == 200
    return res


async def _login(client, email=EMAIL, password=PASSWORD):
    return await client.post(
        "/api/v1/auth/login", data={"username": email, "password": password}
    )


async def _verify(client, code, email=EMAIL):
    return await client.post(
        "/api/v1/auth/verify-email", json={"email": email, "code": code}
    )


async def test_signup_sends_six_digit_code(client, sent_verification_emails):
    await _signup(client)

    assert len(sent_verification_emails) == 1
    to_email, code = sent_verification_emails[0]
    assert to_email == EMAIL
    assert len(code) == 6 and code.isdigit()


async def test_unverified_user_cannot_login(client):
    """Doğru şifre bile olsa, e-posta doğrulanmadan giriş reddedilmeli (403)."""
    await _signup(client)
    res = await _login(client)
    assert res.status_code == 403


async def test_wrong_password_on_unverified_account_does_not_leak_existence(client):
    """Yanlış şifrede doğrulanmamış hesap da 'şifre hatalı' (400) demeli, 403 değil."""
    await _signup(client)
    res = await _login(client, password="yanlis_sifre")
    assert res.status_code == 400


async def test_correct_code_verifies_and_allows_login(client, sent_verification_emails):
    await _signup(client)
    _, code = sent_verification_emails[-1]

    assert (await _verify(client, code)).status_code == 200
    assert (await _login(client)).status_code == 200


async def test_wrong_code_is_rejected(client, sent_verification_emails):
    await _signup(client)
    _, code = sent_verification_emails[-1]
    wrong = "000000" if code != "000000" else "111111"

    assert (await _verify(client, wrong)).status_code == 400
    assert (await _login(client)).status_code == 403  # hâlâ doğrulanmamış


async def test_code_is_locked_after_too_many_wrong_attempts(client, sent_verification_emails):
    """5 yanlış denemeden sonra doğru kod bile kabul edilmemeli (kaba kuvvet koruması)."""
    await _signup(client)
    _, code = sent_verification_emails[-1]
    wrong = "000000" if code != "000000" else "111111"

    for _ in range(5):
        assert (await _verify(client, wrong)).status_code == 400

    assert (await _verify(client, code)).status_code == 400
    assert (await _login(client)).status_code == 403


async def test_expired_code_is_rejected(client, db_session, sent_verification_emails):
    await _signup(client)
    _, code = sent_verification_emails[-1]
    await db_session.execute(
        update(EmailVerificationCode).values(
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)
        )
    )
    await db_session.commit()

    assert (await _verify(client, code)).status_code == 400
    assert (await _login(client)).status_code == 403


async def test_code_is_bound_to_its_email(client, sent_verification_emails):
    """A'nın kodu B'nin e-postasını doğrulamamalı."""
    await _signup(client, "a@test.com")
    await _signup(client, "b@test.com")
    code_a = next(c for e, c in sent_verification_emails if e == "a@test.com")
    code_b = next(c for e, c in sent_verification_emails if e == "b@test.com")
    if code_a == code_b:  # 1/1.000.000 ihtimal — testi yanlış pozitif yapmasın
        pytest.skip("iki kod tesadüfen aynı çıktı")

    assert (await _verify(client, code_a, email="b@test.com")).status_code == 400
    assert (await _login(client, "b@test.com")).status_code == 403


async def test_resend_is_throttled_then_replaces_old_code(
    client, db_session, sent_verification_emails
):
    await _signup(client)
    old_code = sent_verification_emails[-1][1]

    # Hemen tekrar istenirse (60 sn dolmadan) yeni e-posta gitmemeli
    res = await client.post("/api/v1/auth/resend-verification", json={"email": EMAIL})
    assert res.status_code == 200
    assert len(sent_verification_emails) == 1

    # 60 saniye geçmiş gibi yap
    await db_session.execute(
        update(EmailVerificationCode).values(
            created_at=datetime.now(timezone.utc) - timedelta(minutes=2)
        )
    )
    await db_session.commit()

    await client.post("/api/v1/auth/resend-verification", json={"email": EMAIL})
    assert len(sent_verification_emails) == 2
    new_code = sent_verification_emails[-1][1]

    if new_code != old_code:  # eski kod artık geçersiz olmalı
        assert (await _verify(client, old_code)).status_code == 400
    assert (await _verify(client, new_code)).status_code == 200


async def test_resend_for_unknown_email_gives_same_answer_and_sends_nothing(
    client, sent_verification_emails
):
    res = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "yok@test.com"}
    )
    assert res.status_code == 200
    assert sent_verification_emails == []


async def test_resend_for_already_verified_user_sends_nothing(
    client, test_user, sent_verification_emails
):
    before = len(sent_verification_emails)
    res = await client.post(
        "/api/v1/auth/resend-verification", json={"email": test_user["email"]}
    )
    assert res.status_code == 200
    assert len(sent_verification_emails) == before


async def test_password_reset_also_verifies_email(client, sent_reset_emails):
    """Şifre sıfırlama kodu da e-postaya gider; kullanan kişi e-postaya sahip demektir."""
    await _signup(client)
    assert (await _login(client)).status_code == 403

    await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    _, code = sent_reset_emails[-1]

    res = await client.post(
        "/api/v1/auth/reset-password",
        json={"email": EMAIL, "code": code, "new_password": "yenisifre123"},
    )
    assert res.status_code == 200
    assert (await _login(client, password="yenisifre123")).status_code == 200


async def test_resignup_on_unverified_email_takes_over_the_registration(
    client, sent_verification_emails
):
    """
    Saldırgan kurbanın e-postasıyla kendi şifresiyle kayıt açar (doğrulayamaz).
    Gerçek sahip aynı e-postayla kayıt olunca kayıt ona geçmeli:
    yeni şifre geçerli, saldırganın şifresi ve eski kodu geçersiz.
    """
    victim = "kurban@test.com"
    await client.post(
        "/api/v1/auth/signup",
        json={"email": victim, "password": "saldirgan123", "full_name": "Saldırgan"},
    )
    attacker_code = sent_verification_emails[-1][1]

    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": victim, "password": "gercek_sahip_1", "full_name": "Gerçek Sahip"},
    )
    assert res.status_code == 200
    assert res.json()["full_name"] == "Gerçek Sahip"
    assert len(sent_verification_emails) == 2  # yeni kod gönderildi
    new_code = sent_verification_emails[-1][1]

    if attacker_code != new_code:  # saldırganın eski kodu artık işe yaramamalı
        assert (await _verify(client, attacker_code, email=victim)).status_code == 400

    assert (await _verify(client, new_code, email=victim)).status_code == 200
    assert (await _login(client, victim, "gercek_sahip_1")).status_code == 200
    # Saldırganın şifresi hiçbir zaman çalışmamalı
    assert (await _login(client, victim, "saldirgan123")).status_code == 400


async def test_resignup_on_unverified_email_does_not_create_duplicate_user(
    client, db_session
):
    from sqlalchemy import func, select
    from app.models.user import User

    for password in ("ilk_sifre_1", "ikinci_sifre_2"):
        await client.post(
            "/api/v1/auth/signup",
            json={"email": EMAIL, "password": password, "full_name": "X"},
        )

    count = (
        await db_session.execute(select(func.count()).select_from(User))
    ).scalar_one()
    assert count == 1


async def test_signup_on_verified_email_is_still_rejected_and_password_unchanged(
    client, test_user, sent_verification_emails
):
    """Doğrulanmış hesap ezilemez: 'zaten kayıtlı' denmeli, şifre değişmemeli, kod gitmemeli."""
    before = len(sent_verification_emails)
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": test_user["email"], "password": "saldirgan123", "full_name": "S"},
    )
    assert res.status_code == 400
    assert len(sent_verification_emails) == before

    assert (await _login(client, test_user["email"], test_user["password"])).status_code == 200
    assert (await _login(client, test_user["email"], "saldirgan123")).status_code == 400


async def test_signup_email_match_is_case_insensitive(client, test_user):
    """Büyük/küçük harf farkıyla aynı doğrulanmış e-posta tekrar kaydedilememeli."""
    res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": test_user["email"].upper(),
            "password": "saldirgan123",
            "full_name": "S",
        },
    )
    assert res.status_code == 400
