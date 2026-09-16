"""
email_service.py (SendGrid e-posta) testleri — gerçek SendGrid'e hiç gidilmiyor.
"""
from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.services.email_service import send_budget_exceeded_email


async def test_send_email_skips_when_no_api_key():
    """SENDGRID_API_KEY tanımlı değilse, göndermeye çalışılmadan False dönmeli."""
    with patch.object(settings, "SENDGRID_API_KEY", None):
        result = await send_budget_exceeded_email("test@test.com", "Market", 150, 100)
    assert result is False


async def test_send_email_succeeds_with_mocked_sendgrid():
    """API key varsa ve SendGrid çağrısı (mock) başarılı olursa True dönmeli."""
    fake_sg_response = MagicMock()
    fake_sg_response.status_code = 202

    fake_sg_client = MagicMock()
    fake_sg_client.send.return_value = fake_sg_response

    with patch.object(settings, "SENDGRID_API_KEY", "sahte-anahtar"):
        with patch("sendgrid.SendGridAPIClient", return_value=fake_sg_client):
            result = await send_budget_exceeded_email("test@test.com", "Market", 150, 100)

    assert result is True
    fake_sg_client.send.assert_called_once()
