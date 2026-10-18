import logging
import secrets
import string
from datetime import timedelta, datetime, timezone
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.api import deps
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.models.password_reset import PasswordResetCode
from app.models.email_verification import EmailVerificationCode
from app.services.email_service import (
    send_password_reset_email,
    send_verification_code_email,
)
from app.services import apple_auth
from app.schemas.token import Token
from app.schemas.user import UserCreate, User as UserSchema

log = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# OTP (6 haneli kod) ayarları — e-posta doğrulama ve şifre sıfırlama ortak kullanır
VERIFICATION_CODE_TTL_MINUTES = 15
VERIFICATION_MAX_ATTEMPTS = 5
VERIFICATION_RESEND_COOLDOWN_SECONDS = 60


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login_access_token(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Token:
    """OAuth2 uyumlu token girişi."""
    result = await db.execute(select(User).filter(User.email == form_data.username))
    user = result.scalars().first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="E-posta veya şifre hatalı.")
    # Şifre doğru ama e-posta sahipliği kanıtlanmamış: önce doğrulama gerekir.
    # (Kontrolü şifreden SONRA yapıyoruz, yoksa hesabın var olduğunu sızdırırız.)
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="E-posta adresiniz doğrulanmamış.")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )
    return Token(access_token=access_token, token_type="bearer")


class AppleLoginRequest(BaseModel):
    identity_token: str
    # Apple adı yalnızca ilk girişte telefona verir, token'ın içinde yoktur
    full_name: str | None = None


@router.post("/apple", response_model=Token)
@limiter.limit("10/minute")
async def apple_login(
    request: Request,
    body: AppleLoginRequest,
    db: AsyncSession = Depends(deps.get_db),
) -> Token:
    """Sign in with Apple: token'ı doğrula, kullanıcıyı bul/bağla/oluştur."""
    try:
        claims = await apple_auth.verify_identity_token(body.identity_token)
    except apple_auth.AppleTokenError as e:
        log.warning("Apple token reddedildi: %s", e)
        raise HTTPException(status_code=401, detail="Apple girişi doğrulanamadı.")
    except httpx.HTTPError as e:
        log.error("Apple anahtarları alınamadı: %s", e)
        raise HTTPException(status_code=503, detail="Apple servisine ulaşılamadı, tekrar deneyin.")

    apple_sub = claims["sub"]

    # 1) Bu Apple hesabı daha önce bağlanmış mı?
    result = await db.execute(select(User).where(User.apple_sub == apple_sub))
    user = result.scalars().first()

    if not user:
        email = (claims.get("email") or "").strip().lower()
        if not email:
            raise HTTPException(
                status_code=400,
                detail="Apple hesabından e-posta alınamadı. Lütfen e-posta ile kayıt olun.",
            )
        # Apple bazen "true" (string), bazen true (bool) gönderir
        email_verified = str(claims.get("email_verified")).lower() == "true"

        # 2) Aynı e-postayla kayıtlı hesap var mı? Varsa bağla.
        result = await db.execute(select(User).where(func.lower(User.email) == email))
        user = result.scalars().first()

        if user:
            # Doğrulanmamış e-postayla bağlarsak, başkasının e-postasını
            # taklit eden biri hesabı ele geçirebilir.
            if not email_verified:
                raise HTTPException(status_code=400, detail="Apple e-postası doğrulanmamış.")
            if user.apple_sub and user.apple_sub != apple_sub:
                raise HTTPException(status_code=409, detail="Bu hesap başka bir Apple hesabına bağlı.")
            user.apple_sub = apple_sub
            if not user.email_verified:
                # Bu hesabın e-postasını kimse kanıtlamamıştı: kaydı başka biri
                # kurbanın e-postasıyla, kendi şifresiyle açmış olabilir (kayıt
                # önceden ele geçirme). Apple e-postayı şimdi kanıtladığı için
                # hesap gerçek sahibinin olur; eski şifreyi geçersiz kıl.
                log.warning("Doğrulanmamış hesap Apple ile bağlandı, şifre sıfırlandı: %s", user.id)
                user.hashed_password = security.get_password_hash(secrets.token_urlsafe(32))
                user.email_verified = True
        else:
            # 3) Yeni kullanıcı. Şifre girişi olmadığı için tahmin edilemez rastgele
            # bir şifre atıyoruz (hashed_password boş bırakılamıyor).
            user = User(
                email=email,
                hashed_password=security.get_password_hash(secrets.token_urlsafe(32)),
                full_name=(body.full_name or "").strip() or None,
                apple_sub=apple_sub,
                email_verified=email_verified,
            )
            db.add(user)

        await db.commit()
        await db.refresh(user)

    access_token = security.create_access_token(
        user.id, expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return Token(access_token=access_token, token_type="bearer")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(deps.get_db),
):
    email = body.email.lower()
    result = await db.execute(select(User).where(func.lower(User.email) == email))
    user = result.scalars().first()
    # Kullanıcı bulunamasa bile aynı yanıtı döndür (güvenlik)
    if not user:
        return {"message": "Eğer bu e-posta kayıtlıysa, sıfırlama kodu gönderildi."}

    # Mevcut kodları temizle
    await db.execute(
        delete(PasswordResetCode).where(PasswordResetCode.email == email)
    )

    # 6 haneli OTP üret ve DB'ye kaydet (secrets: tahmin edilemez rastgelelik)
    otp = "".join(secrets.choice(string.digits) for _ in range(6))
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    reset_entry = PasswordResetCode(
        email=email,
        code=otp,
        expires_at=expires,
    )
    db.add(reset_entry)
    await db.commit()

    # E-postayı gönder (SendGrid yoksa/başarısızsa log'a düşer, istek yine de başarılı döner)
    sent = await send_password_reset_email(email, otp)
    if not sent and settings.ENVIRONMENT != "production":
        # Lokal geliştirmede SendGrid yoksa kodu log'dan okuyabilmek için
        log.info("DEV şifre sıfırlama kodu (%s): %s", email, otp)

    return {"message": "Eğer bu e-posta kayıtlıysa, sıfırlama kodu gönderildi."}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(deps.get_db),
):
    email = body.email.lower()
    # DB'den geçerli kodu bul
    result = await db.execute(
        select(PasswordResetCode).where(
            PasswordResetCode.email == email,
            PasswordResetCode.used == False,
        ).order_by(PasswordResetCode.created_at.desc())
    )
    entry = result.scalars().first()

    if not entry:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş kod.")

    if datetime.now(timezone.utc) > entry.expires_at.replace(tzinfo=timezone.utc):
        await db.delete(entry)
        await db.commit()
        raise HTTPException(status_code=400, detail="Kodun süresi dolmuş. Lütfen tekrar isteyin.")

    if entry.attempts >= VERIFICATION_MAX_ATTEMPTS:
        await db.delete(entry)
        await db.commit()
        raise HTTPException(status_code=400, detail="Çok fazla hatalı deneme. Lütfen yeni kod isteyin.")

    if not secrets.compare_digest(entry.code, body.code.strip()):
        entry.attempts += 1
        await db.commit()
        raise HTTPException(status_code=400, detail="Hatalı kod.")

    # Kullanıcının şifresini güncelle
    user_result = await db.execute(select(User).where(func.lower(User.email) == email))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    user.hashed_password = security.get_password_hash(body.new_password)
    # Kod o e-postaya gitti: sahipliği kanıtlandı
    user.email_verified = True
    # Kodu kullanıldı olarak işaretle ve sil
    await db.delete(entry)
    await db.commit()

    return {"message": "Şifre başarıyla güncellendi."}


async def _issue_verification_code(db: AsyncSession, email: str) -> None:
    """Eski kodları siler, yeni 6 haneli kod üretip DB'ye yazar ve e-postayla yollar."""
    email = email.lower()
    await db.execute(
        delete(EmailVerificationCode).where(EmailVerificationCode.email == email)
    )
    # secrets: tahmin edilemez (kriptografik) rastgelelik — random modülü bunun için uygun değil
    code = "".join(secrets.choice(string.digits) for _ in range(6))
    db.add(
        EmailVerificationCode(
            email=email,
            code=code,
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES),
        )
    )
    await db.commit()

    sent = await send_verification_code_email(email, code)
    if not sent and settings.ENVIRONMENT != "production":
        # Lokal geliştirmede SendGrid yoksa kodu log'dan okuyabilmek için
        log.info("DEV doğrulama kodu (%s): %s", email, code)


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


@router.post("/verify-email")
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    body: VerifyEmailRequest,
    db: AsyncSession = Depends(deps.get_db),
):
    """Kayıt sonrası e-postaya gelen 6 haneli kodu doğrular."""
    email = body.email.lower()
    result = await db.execute(
        select(EmailVerificationCode)
        .where(EmailVerificationCode.email == email)
        .order_by(EmailVerificationCode.created_at.desc())
    )
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş kod.")

    if datetime.now(timezone.utc) > entry.expires_at:
        await db.delete(entry)
        await db.commit()
        raise HTTPException(status_code=400, detail="Kodun süresi dolmuş. Lütfen yeni kod isteyin.")

    if entry.attempts >= VERIFICATION_MAX_ATTEMPTS:
        await db.delete(entry)
        await db.commit()
        raise HTTPException(status_code=400, detail="Çok fazla hatalı deneme. Lütfen yeni kod isteyin.")

    if not secrets.compare_digest(entry.code, body.code.strip()):
        entry.attempts += 1
        await db.commit()
        raise HTTPException(status_code=400, detail="Hatalı kod.")

    user_result = await db.execute(select(User).where(func.lower(User.email) == email))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş kod.")

    user.email_verified = True
    await db.delete(entry)
    await db.commit()
    return {"message": "E-posta adresiniz doğrulandı."}


@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    body: ResendVerificationRequest,
    db: AsyncSession = Depends(deps.get_db),
):
    """Doğrulama kodunu yeniden gönderir. Hesap var mı/yok mu sızdırmamak için hep aynı yanıt."""
    message = {"message": "Eğer bu e-posta doğrulama bekliyorsa, yeni kod gönderildi."}
    email = body.email.lower()

    result = await db.execute(select(User).where(func.lower(User.email) == email))
    user = result.scalars().first()
    if not user or user.email_verified:
        return message

    # Aynı adrese kısa sürede tekrar tekrar mail atılmasın (e-posta bombardımanı)
    last = await db.execute(
        select(EmailVerificationCode)
        .where(EmailVerificationCode.email == email)
        .order_by(EmailVerificationCode.created_at.desc())
    )
    last_entry = last.scalars().first()
    if last_entry and (
        datetime.now(timezone.utc) - last_entry.created_at
    ).total_seconds() < VERIFICATION_RESEND_COOLDOWN_SECONDS:
        return message

    await _issue_verification_code(db, email)
    return message


@router.post("/signup", response_model=UserSchema)
@limiter.limit("5/minute")
async def create_user(
    request: Request,
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> User:
    """Yeni kullanıcı oluştur; e-posta doğrulama kodunu gönderir."""
    result = await db.execute(
        select(User).where(func.lower(User.email) == user_in.email.lower())
    )
    user = result.scalars().first()

    if user and (user.email_verified or user.apple_sub):
        raise HTTPException(
            status_code=400,
            detail="Bu e-posta adresi zaten kayıtlı.",
        )

    if user:
        # Bu e-postayı hiç kimse kanıtlamadı (doğrulanmamış kayıt, giriş de yapılamıyor):
        # "ilk gelen kazanır" olmasın. Kaydı yeni şifreyle ez, yeni kod gönder; kodu
        # girebilen e-postanın gerçek sahibi olur. Başka birinin önceden açtığı
        # kayıt (kayıt önceden ele geçirme) böylece etkisiz kalır.
        user.hashed_password = security.get_password_hash(user_in.password)
        user.full_name = user_in.full_name
    else:
        user = User(
            email=user_in.email,
            hashed_password=security.get_password_hash(user_in.password),
            full_name=user_in.full_name,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)
    await _issue_verification_code(db, user.email)
    return user
