"""
Sign in with Apple testleri.

Gerçek Apple'a istek atmıyoruz. Bunun yerine kendi RSA anahtar çiftimizi
üretip token'ları kendimiz imzalıyoruz, Apple'ın anahtar listesi (JWKS) yerine
bizim açık anahtarımızı döndürüyoruz. Böylece doğrulama kodu birebir aynı
çalışır, sadece "Apple" rolünü testteki anahtar oynar.
"""
import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwk, jwt

from app.core.config import settings
from app.services import apple_auth

KID = "test-key-1"


def _make_keypair():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public_pem = key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem


APPLE_PRIVATE, APPLE_PUBLIC = _make_keypair()
OTHER_PRIVATE, _ = _make_keypair()  # Apple'ın olmayan, saldırganın anahtarı


def make_token(
    sub="apple-user-001",
    email="apple_user@test.com",
    email_verified="true",
    aud=None,
    iss=apple_auth.APPLE_ISSUER,
    exp_offset=3600,
    private_pem=APPLE_PRIVATE,
    kid=KID,
):
    claims = {
        "iss": iss,
        "aud": aud or settings.APPLE_BUNDLE_ID,
        "sub": sub,
        "iat": int(time.time()),
        "exp": int(time.time()) + exp_offset,
    }
    if email is not None:
        claims["email"] = email
        claims["email_verified"] = email_verified
    return jwt.encode(claims, private_pem, algorithm="RS256", headers={"kid": kid})


@pytest.fixture(autouse=True)
def fake_apple_keys(monkeypatch):
    """Apple'ın anahtar sunucusu yerine testteki açık anahtarı döndür."""
    public_jwk = jwk.construct(APPLE_PUBLIC, "RS256").to_dict()
    public_jwk["kid"] = KID

    async def _fake_keys(force=False):
        return [public_jwk]

    monkeypatch.setattr(apple_auth, "_get_apple_keys", _fake_keys)


async def _apple_login(client, token, full_name=None):
    body = {"identity_token": token}
    if full_name:
        body["full_name"] = full_name
    return await client.post("/api/v1/auth/apple", json=body)


async def _me(client, access_token):
    res = await client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert res.status_code == 200
    return res.json()


async def test_new_apple_user_is_created(client):
    """Hesabı olmayan biri Apple ile girince yeni hesap açılmalı."""
    res = await _apple_login(client, make_token(), full_name="Burak Sayan")
    assert res.status_code == 200

    me = await _me(client, res.json()["access_token"])
    assert me["email"] == "apple_user@test.com"
    assert me["full_name"] == "Burak Sayan"


async def test_existing_email_account_is_linked(client, test_user):
    """Aynı (doğrulanmış) e-postayla kayıtlı hesap varsa yenisi açılmamalı, bağlanmalı."""
    token = make_token(sub="apple-link-001", email=test_user["email"])
    res = await _apple_login(client, token)
    assert res.status_code == 200

    # Aynı kullanıcıya girdi (yeni hesap değil)
    me = await _me(client, res.json()["access_token"])
    original = await _me(client, test_user["token"])
    assert me["id"] == original["id"]

    # Eski şifreyle girişi bozulmadı
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": test_user["email"], "password": test_user["password"]},
    )
    assert login.status_code == 200


async def test_preregistered_unverified_account_is_taken_over_by_real_owner(client):
    """
    Kayıt önceden ele geçirme senaryosu: saldırgan kurbanın e-postasıyla kendi
    şifresiyle hesap açar. Kurban sonra Apple ile girince hesap kurbana geçmeli
    ve saldırganın şifresi çalışmaz hale gelmeli.
    """
    victim = "kurban@test.com"
    await client.post(
        "/api/v1/auth/signup",
        json={"email": victim, "password": "saldirgan123", "full_name": "Saldırgan"},
    )

    res = await _apple_login(client, make_token(sub="apple-victim-001", email=victim))
    assert res.status_code == 200

    # Saldırganın bildiği şifre artık işe yaramaz
    attacker_login = await client.post(
        "/api/v1/auth/login", data={"username": victim, "password": "saldirgan123"}
    )
    assert attacker_login.status_code == 400

    # Gerçek sahip (Apple) hesabına giriyor
    again = await _apple_login(client, make_token(sub="apple-victim-001", email=None))
    assert again.status_code == 200


async def test_signup_does_not_overwrite_account_owned_via_apple(client):
    """Apple kimliğine bağlı hesap (e-posta doğrulanmamış olsa bile) kayıtla ezilemez."""
    email = "apple_hesap@test.com"
    res = await _apple_login(
        client, make_token(sub="apple-own-001", email=email, email_verified="false")
    )
    assert res.status_code == 200

    signup = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "saldirgan123", "full_name": "S"},
    )
    assert signup.status_code == 400


async def test_returning_user_logs_in_without_email_in_token(client):
    """İkinci girişte token'da e-posta olmasa bile 'sub' ile tanınmalı."""
    first = await _apple_login(client, make_token(sub="apple-ret-001"))
    first_me = await _me(client, first.json()["access_token"])

    second = await _apple_login(client, make_token(sub="apple-ret-001", email=None))
    assert second.status_code == 200
    second_me = await _me(client, second.json()["access_token"])
    assert second_me["id"] == first_me["id"]


async def test_unverified_email_is_not_linked(client, test_user):
    """Doğrulanmamış e-postayla mevcut hesaba bağlanmamalı (hesap ele geçirme riski)."""
    token = make_token(sub="apple-evil-001", email=test_user["email"], email_verified="false")
    res = await _apple_login(client, token)
    assert res.status_code == 400


async def test_unknown_user_without_email_is_rejected(client):
    """Hem 'sub' tanınmıyor hem e-posta yoksa hesap açılamaz."""
    res = await _apple_login(client, make_token(sub="apple-new-002", email=None))
    assert res.status_code == 400


async def test_wrong_audience_is_rejected(client):
    """Başka bir uygulama için üretilmiş token kabul edilmemeli."""
    res = await _apple_login(client, make_token(aud="com.baska.uygulama"))
    assert res.status_code == 401


async def test_wrong_issuer_is_rejected(client):
    res = await _apple_login(client, make_token(iss="https://evil.example.com"))
    assert res.status_code == 401


async def test_expired_token_is_rejected(client):
    res = await _apple_login(client, make_token(exp_offset=-60))
    assert res.status_code == 401


async def test_token_signed_with_foreign_key_is_rejected(client):
    """Apple'ın değil, başkasının anahtarıyla imzalanmış sahte token reddedilmeli."""
    res = await _apple_login(client, make_token(private_pem=OTHER_PRIVATE))
    assert res.status_code == 401


async def test_unknown_key_id_is_rejected(client):
    res = await _apple_login(client, make_token(kid="bilinmeyen-anahtar"))
    assert res.status_code == 401


async def test_garbage_token_is_rejected(client):
    res = await _apple_login(client, "bu-bir-jwt-degil")
    assert res.status_code == 401


async def test_login_with_authorization_code_stores_refresh_token(client, db_session, monkeypatch):
    """Girişte yetki kodu gelirse refresh token Apple'dan alınıp kullanıcıya kaydedilmeli."""
    from sqlalchemy import select
    from app.models.user import User

    received = []

    async def fake_exchange(code):
        received.append(code)
        return "refresh-abc"

    monkeypatch.setattr(apple_auth, "exchange_authorization_code", fake_exchange)

    res = await client.post(
        "/api/v1/auth/apple",
        json={"identity_token": make_token(sub="apple-rev-001"), "authorization_code": "kod-1"},
    )
    assert res.status_code == 200
    assert received == ["kod-1"]

    user = (await db_session.execute(select(User).where(User.apple_sub == "apple-rev-001"))).scalars().first()
    assert user.apple_refresh_token == "refresh-abc"


async def test_login_still_works_when_code_exchange_fails(client, db_session, monkeypatch):
    """Apple yetki kodunu reddederse giriş yine de başarılı olmalı (iptal 'en iyi çaba')."""
    from sqlalchemy import select
    from app.models.user import User

    async def failing_exchange(code):
        return None

    monkeypatch.setattr(apple_auth, "exchange_authorization_code", failing_exchange)

    res = await client.post(
        "/api/v1/auth/apple",
        json={"identity_token": make_token(sub="apple-rev-002"), "authorization_code": "kod-2"},
    )
    assert res.status_code == 200

    user = (await db_session.execute(select(User).where(User.apple_sub == "apple-rev-002"))).scalars().first()
    assert user.apple_refresh_token is None


async def test_login_without_authorization_code_does_not_call_apple(client, monkeypatch):
    called = []

    async def fake_exchange(code):
        called.append(code)
        return "x"

    monkeypatch.setattr(apple_auth, "exchange_authorization_code", fake_exchange)

    res = await _apple_login(client, make_token(sub="apple-rev-003"))
    assert res.status_code == 200
    assert called == []
