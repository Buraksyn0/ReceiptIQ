"""
Apple token iptali (hesap silme, Guideline 5.1.1(v)) testleri.

Gerçek Apple'a gidilmiyor: kendi EC anahtar çiftimizi üretip, Apple'a gönderilen
"client secret" JWT'sinin doğru üretildiğini kendi açık anahtarımızla doğruluyoruz;
HTTP istemcisini sahte bir sınıfla değiştirip isteklerin içeriğini yakalıyoruz.
"""
import time
from unittest.mock import patch

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from jose import jwt

from app.core.config import settings
from app.services import apple_auth

TEAM_ID = "TEAM123456"
KEY_ID = "KEY1234567"


def _make_ec_keypair():
    key = ec.generate_private_key(ec.SECP256R1())
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    public_pem = key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    return private_pem, public_pem


PRIVATE_PEM, PUBLIC_PEM = _make_ec_keypair()


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(settings, "APPLE_TEAM_ID", TEAM_ID)
    monkeypatch.setattr(settings, "APPLE_KEY_ID", KEY_ID)
    monkeypatch.setattr(settings, "APPLE_PRIVATE_KEY", PRIVATE_PEM)


class FakeResponse:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = body if body is not None else {}

    def json(self):
        return self._body


def fake_client(response=None, error=None, calls=None):
    calls = calls if calls is not None else []

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, data=None, **kwargs):
            calls.append({"url": url, "data": data})
            if error:
                raise error
            return response or FakeResponse()

    return FakeClient


def test_not_configured_by_default():
    with patch.object(settings, "APPLE_PRIVATE_KEY", None):
        assert apple_auth.is_revocation_configured() is False


def test_client_secret_is_a_valid_es256_jwt_with_expected_claims(configured):
    secret = apple_auth._client_secret()

    header = jwt.get_unverified_header(secret)
    assert header["alg"] == "ES256"
    assert header["kid"] == KEY_ID

    claims = jwt.decode(
        secret,
        PUBLIC_PEM,
        algorithms=["ES256"],
        audience=apple_auth.APPLE_ISSUER,
    )
    assert claims["iss"] == TEAM_ID
    assert claims["sub"] == settings.APPLE_BUNDLE_ID
    assert claims["aud"] == "https://appleid.apple.com"
    assert claims["exp"] - claims["iat"] <= 300
    assert abs(claims["iat"] - time.time()) < 10


def test_client_secret_accepts_escaped_newlines_in_env_value(monkeypatch, configured):
    """Ortam değişkeninde satır sonları '\\n' yazısı olarak gelirse de çalışmalı."""
    monkeypatch.setattr(settings, "APPLE_PRIVATE_KEY", PRIVATE_PEM.replace("\n", "\\n"))
    secret = apple_auth._client_secret()
    jwt.decode(secret, PUBLIC_PEM, algorithms=["ES256"], audience=apple_auth.APPLE_ISSUER)


async def test_exchange_posts_code_and_returns_refresh_token(configured):
    calls = []
    resp = FakeResponse(200, {"refresh_token": "r-abc", "access_token": "a", "id_token": "i"})
    with patch("app.services.apple_auth.httpx.AsyncClient", fake_client(resp, calls=calls)):
        token = await apple_auth.exchange_authorization_code("kod-123")

    assert token == "r-abc"
    call = calls[0]
    assert call["url"] == apple_auth.APPLE_TOKEN_URL
    assert call["data"]["grant_type"] == "authorization_code"
    assert call["data"]["code"] == "kod-123"
    assert call["data"]["client_id"] == settings.APPLE_BUNDLE_ID
    assert call["data"]["client_secret"]  # imzalı JWT


async def test_exchange_returns_none_when_apple_rejects(configured):
    resp = FakeResponse(400, {"error": "invalid_grant"})
    with patch("app.services.apple_auth.httpx.AsyncClient", fake_client(resp)):
        assert await apple_auth.exchange_authorization_code("eski-kod") is None


async def test_exchange_returns_none_without_refresh_token_in_response(configured):
    with patch("app.services.apple_auth.httpx.AsyncClient", fake_client(FakeResponse(200, {}))):
        assert await apple_auth.exchange_authorization_code("kod") is None


async def test_exchange_never_raises_on_network_error(configured):
    with patch("app.services.apple_auth.httpx.AsyncClient", fake_client(error=ConnectionError("ağ yok"))):
        assert await apple_auth.exchange_authorization_code("kod") is None


async def test_exchange_makes_no_request_when_not_configured():
    calls = []
    with patch.object(settings, "APPLE_PRIVATE_KEY", None):
        with patch("app.services.apple_auth.httpx.AsyncClient", fake_client(calls=calls)):
            assert await apple_auth.exchange_authorization_code("kod") is None
    assert calls == []


async def test_revoke_posts_refresh_token_with_hint(configured):
    calls = []
    with patch("app.services.apple_auth.httpx.AsyncClient", fake_client(FakeResponse(200), calls=calls)):
        assert await apple_auth.revoke_refresh_token("r-abc") is True

    call = calls[0]
    assert call["url"] == apple_auth.APPLE_REVOKE_URL
    assert call["data"]["token"] == "r-abc"
    assert call["data"]["token_type_hint"] == "refresh_token"
    assert call["data"]["client_id"] == settings.APPLE_BUNDLE_ID
    assert call["data"]["client_secret"]


async def test_revoke_returns_false_on_http_error(configured):
    with patch("app.services.apple_auth.httpx.AsyncClient", fake_client(FakeResponse(400, {"error": "invalid_request"}))):
        assert await apple_auth.revoke_refresh_token("r-abc") is False


async def test_revoke_never_raises_on_network_error(configured):
    with patch("app.services.apple_auth.httpx.AsyncClient", fake_client(error=ConnectionError("ağ yok"))):
        assert await apple_auth.revoke_refresh_token("r-abc") is False


async def test_revoke_makes_no_request_when_not_configured():
    calls = []
    with patch.object(settings, "APPLE_PRIVATE_KEY", None):
        with patch("app.services.apple_auth.httpx.AsyncClient", fake_client(calls=calls)):
            assert await apple_auth.revoke_refresh_token("r-abc") is False
    assert calls == []
