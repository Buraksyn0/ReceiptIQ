"""
ReceiptIQ — Expo Push Bildirim Servisi

Tek kullanıcıya veya toplu kullanıcılara push bildirim gönderir.
Token yoksa ya da geçersizse sessizce atlar.
"""
from __future__ import annotations
import logging
import httpx

log = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push(
    token: str | None,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """Tek bir Expo push token'ına bildirim gönder."""
    if not token or not token.startswith("ExponentPushToken"):
        return

    message = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
        "data": data or {},
    }

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=message,
                headers={"Content-Type": "application/json"},
            )
            log.info("Push gönderildi: '%s' → %s (status=%s)", title, token[:30], resp.status_code)
    except Exception as e:
        log.warning("Push gönderilemedi: %s", e)
