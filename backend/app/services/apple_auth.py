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


# ---------------------------------------------------------------------------
# Token iptali (hesap silme) — Apple Guideline 5.1.1(v)
#
# Akış:
#   1. Girişte uygulama Apple'dan tek kullanımlık "authorizationCode" alır, bize yollar.
#   2. Biz bu kodu Apple'a verip "refresh token" alırız ve kullanıcıya kaydederiz.
#   3. Kullanıcı hesabını silince bu refresh token'ı Apple'a "iptal et" diye göndeririz.
#
# Apple'a "bu isteği gerçekten uygulama sahibi yapıyor" demek için kısa ömürlü bir
# "client secret" (ES256 ile imzalı JWT) üretiriz; imzalama anahtarı .p8 dosyasıdır.
# ---------------------------------------------------------------------------

APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token"
APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke"
_CLIENT_SECRET_TTL_SECONDS = 300  # Her istekte yeniden üretildiği için kısa tutuyoruz


def is_revocation_configured() -> bool:
    """Takım kimliği, anahtar kimliği ve özel anahtarın üçü de tanımlı mı?"""
    return bool(
        settings.APPLE_TEAM_ID and settings.APPLE_KEY_ID and settings.APPLE_PRIVATE_KEY
    )


def _client_secret() -> str:
    now = int(time.time())
    # Ortam değişkenlerinde satır sonları bazen "\n" yazısı olarak gelir
    private_key = settings.APPLE_PRIVATE_KEY.replace("\\n", "\n")
    return jwt.encode(
        {
            "iss": settings.APPLE_TEAM_ID,
            "iat": now,
            "exp": now + _CLIENT_SECRET_TTL_SECONDS,
            "aud": APPLE_ISSUER,
            "sub": settings.APPLE_BUNDLE_ID,
        },
        private_key,
        algorithm="ES256",
        headers={"kid": settings.APPLE_KEY_ID},
    )


async def exchange_authorization_code(code: str) -> str | None:
    """
    Apple'ın tek kullanımlık yetki kodunu refresh token'a çevirir.
    Yapılandırılmamışsa ya da Apple reddederse None döner (giriş akışı bozulmasın).
    """
    if not is_revocation_configured():
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                APPLE_TOKEN_URL,
                data={
                    "client_id": settings.APPLE_BUNDLE_ID,
                    "client_secret": _client_secret(),
                    "code": code,
                    "grant_type": "authorization_code",
                },
            )
        body = resp.json()
        if resp.status_code != 200 or not body.get("refresh_token"):
            log.warning("Apple yetki kodu değişimi başarısız: HTTP %s %s", resp.status_code, body.get("error"))
            return None
        return body["refresh_token"]
    except Exception as e:
        log.warning("Apple yetki kodu değişimi hatası: %s", e)
        return None


async def revoke_refresh_token(refresh_token: str) -> bool:
    """Kullanıcının Apple erişimini iptal eder. Başarılıysa True."""
    if not is_revocation_configured():
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                APPLE_REVOKE_URL,
                data={
                    "client_id": settings.APPLE_BUNDLE_ID,
                    "client_secret": _client_secret(),
                    "token": refresh_token,
                    "token_type_hint": "refresh_token",
                },
            )
        if resp.status_code != 200:
            log.error("Apple token iptali başarısız: HTTP %s", resp.status_code)
            return False
        return True
    except Exception as e:
        log.error("Apple token iptali hatası: %s", e)
        return False
