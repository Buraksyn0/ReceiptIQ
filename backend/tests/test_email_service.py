"""
email_service.py (Resend e-posta) testleri — gerçek Resend'e hiç gidilmiyor.

httpx.AsyncClient'ı sahte bir sınıfla değiştiriyoruz: gönderilen istek (adres,
başlık, gövde) yakalanıyor, cevabı da biz belirliyoruz.
"""
from unittest.mock import patch

from app.core.config import settings
from app.services.email_service import (
    RESEND_SEND_URL,
    send_budget_exceeded_email,
    send_password_reset_email,
    send_verification_code_email,
)


class FakeResponse:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = body if body is not None else {"id": "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794"}

    def json(self):
        return self._body


def fake_client(response=None, error=None, calls=None):
    """httpx.AsyncClient yerine geçen sahte sınıf üretir."""
    calls = calls if calls is not None else []

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, json=None, headers=None):
            calls.append({"url": url, "json": json, "headers": headers})
            if error:
                raise error
            return response or FakeResponse()

    return FakeClient


async def test_send_email_skips_when_no_api_key():
    """RESEND_API_KEY tanımlı değilse, istek atılmadan False dönmeli."""
    calls = []
    with patch.object(settings, "RESEND_API_KEY", None):
        with patch("app.services.email_service.httpx.AsyncClient", fake_client(calls=calls)):
            result = await send_budget_exceeded_email("test@test.com", "Market", 150, 100)
    assert result is False
    assert calls == []


async def test_send_email_posts_expected_request_to_resend():
    """Doğru adrese, doğru başlık ve gövdeyle istek atılmalı; başarı → True."""
    calls = []
    with patch.object(settings, "RESEND_API_KEY", "sahte-anahtar"):
        with patch.object(settings, "EMAIL_FROM", "ReceiptIQ <no-reply@ornek.com>"):
            with patch("app.services.email_service.httpx.AsyncClient", fake_client(calls=calls)):
                result = await send_budget_exceeded_email("test@test.com", "Market", 150, 100)

    assert result is True
    assert len(calls) == 1
    call = calls[0]
    assert call["url"] == RESEND_SEND_URL
    assert call["headers"]["Authorization"] == "Bearer sahte-anahtar"
    assert call["json"]["from"] == "ReceiptIQ <no-reply@ornek.com>"
    assert call["json"]["to"] == ["test@test.com"]
    assert "Market" in call["json"]["subject"]
    assert "Market" in call["json"]["html"]


async def test_send_email_returns_false_when_response_has_no_id():
    """200 gelse bile gönderim kimliği (id) yoksa başarı sayılmamalı."""
    with patch.object(settings, "RESEND_API_KEY", "sahte-anahtar"):
        with patch(
            "app.services.email_service.httpx.AsyncClient",
            fake_client(response=FakeResponse(200, {"message": "bir sorun var"})),
        ):
            result = await send_budget_exceeded_email("test@test.com", "Market", 150, 100)
    assert result is False


async def test_send_email_returns_false_on_http_error():
    body = {"name": "validation_error", "message": "The from address is not verified."}
    with patch.object(settings, "RESEND_API_KEY", "sahte-anahtar"):
        with patch(
            "app.services.email_service.httpx.AsyncClient",
            fake_client(response=FakeResponse(403, body)),
        ):
            result = await send_budget_exceeded_email("test@test.com", "Market", 150, 100)
    assert result is False


async def test_send_email_never_raises_on_network_error():
    """Ağ hatası kayıt/şifre sıfırlama isteğini çökertmemeli; sadece False dönmeli."""
    with patch.object(settings, "RESEND_API_KEY", "sahte-anahtar"):
        with patch(
            "app.services.email_service.httpx.AsyncClient",
            fake_client(error=ConnectionError("ağ yok")),
        ):
            result = await send_budget_exceeded_email("test@test.com", "Market", 150, 100)
    assert result is False


async def test_verification_and_reset_emails_contain_the_code():
    calls = []
    with patch.object(settings, "RESEND_API_KEY", "sahte-anahtar"):
        with patch("app.services.email_service.httpx.AsyncClient", fake_client(calls=calls)):
            assert await send_verification_code_email("a@test.com", "123456") is True
            assert await send_password_reset_email("b@test.com", "654321") is True

    assert "123456" in calls[0]["json"]["html"]
    assert calls[0]["json"]["to"] == ["a@test.com"]
    assert "654321" in calls[1]["json"]["html"]
    assert calls[1]["json"]["to"] == ["b@test.com"]
