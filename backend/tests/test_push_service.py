"""
push_service.py (Expo push bildirimi) testleri — gerçek Expo sunucusuna
hiç gidilmiyor.
"""
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.push_service import send_push


async def test_send_push_skips_when_token_is_none():
    """Token yoksa hiçbir ağ isteği atılmamalı."""
    with patch("httpx.AsyncClient") as mock_client_class:
        await send_push(token=None, title="Test", body="Test mesajı")
        mock_client_class.assert_not_called()


async def test_send_push_skips_invalid_token_format():
    """'ExponentPushToken' ile başlamayan tokenler geçersiz sayılıp atlanmalı."""
    with patch("httpx.AsyncClient") as mock_client_class:
        await send_push(token="gecersiz-token-123", title="Test", body="Test mesajı")
        mock_client_class.assert_not_called()


async def test_send_push_calls_expo_api_with_valid_token():
    """Geçerli formatlı token ile gerçekten bir POST isteği atılmalı."""
    mock_response = MagicMock()
    mock_response.status_code = 200

    mock_client_instance = AsyncMock()
    mock_client_instance.post = AsyncMock(return_value=mock_response)
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("httpx.AsyncClient", return_value=mock_client_instance):
        await send_push(token="ExponentPushToken[abc123]", title="Test", body="Test mesajı")

    mock_client_instance.post.assert_called_once()
    call_args = mock_client_instance.post.call_args
    assert call_args[0][0] == "https://exp.host/--/api/v2/push/send"
    assert call_args[1]["json"]["to"] == "ExponentPushToken[abc123]"
