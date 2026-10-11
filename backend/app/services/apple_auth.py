"""
ReceiptIQ — Sign in with Apple token doğrulama

Telefon, kullanıcı Apple ile giriş yapınca bize imzalı bir "identity token" (JWT)
gönderir. Bu token'a ancak imzasını Apple'ın herkese açık anahtarlarıyla
doğrularsak güveniriz. Doğrularken şunları kontrol ederiz:
  - İmza geçerli mi?               (token'ı gerçekten Apple üretti mi)
  - iss == https://appleid.apple.com (Apple'dan geldi mi)
  - aud == bizim bundle ID           (bu token BİZİM uygulama için mi üretildi)
  - exp geçmemiş mi                  (süresi dolmuş token'lar reddedilir)
"""

from __future__ import annotations

import logging
import time

import httpx
from jose import JWTError, jwt

from app.core.config import settings

log = logging.getLogger(__name__)

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
_KEYS_TTL_SECONDS = 3600

_keys_cache: dict = {"keys": None, "fetched_at": 0.0}


class AppleTokenError(Exception):
    """Token geçersiz, sahte ya da süresi dolmuş."""


async def _get_apple_keys(force: bool = False) -> list[dict]:
    """Apple'ın açık anahtarlarını (JWKS) getirir; 1 saat önbellekte tutar."""
    fresh = (time.time() - _keys_cache["fetched_at"]) < _KEYS_TTL_SECONDS
    if _keys_cache["keys"] and fresh and not force:
        return _keys_cache["keys"]

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(APPLE_KEYS_URL)
        resp.raise_for_status()
        keys = resp.json()["keys"]

    _keys_cache["keys"] = keys
    _keys_cache["fetched_at"] = time.time()
    return keys


async def verify_identity_token(identity_token: str) -> dict:
    """
    Apple identity token'ını doğrular, geçerliyse claim'leri (sub, email, ...) döner.

    Raises:
        AppleTokenError: token geçersizse.
        httpx.HTTPError: Apple'ın anahtar sunucusuna ulaşılamazsa.
    """
    try:
        header = jwt.get_unverified_header(identity_token)
    except JWTError as e:
        raise AppleTokenError("Token okunamadı") from e

    kid = header.get("kid")
    keys = await _get_apple_keys()
    key = next((k for k in keys if k.get("kid") == kid), None)
    if key is None:
        # Apple anahtarları değiştirmiş olabilir — önbelleği atlayıp bir kez daha dene
        keys = await _get_apple_keys(force=True)
        key = next((k for k in keys if k.get("kid") == kid), None)
    if key is None:
        raise AppleTokenError("Bilinmeyen anahtar kimliği")

    try:
        # algorithms sabit RS256: saldırganın "alg" başlığını değiştirerek
        # doğrulamayı atlatmasını (algorithm confusion) engeller.
        return jwt.decode(
            identity_token,
            key,
            algorithms=["RS256"],
            audience=settings.APPLE_BUNDLE_ID,
            issuer=APPLE_ISSUER,
        )
    except JWTError as e:
        raise AppleTokenError(str(e)) from e
