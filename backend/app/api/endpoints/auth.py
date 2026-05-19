import random
import string
from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.api import deps
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.models.password_reset import PasswordResetCode
from app.schemas.token import Token
from app.schemas.user import UserCreate, User as UserSchema

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


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

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
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
    result = await db.execute(select(User).filter(User.email == body.email))
    user = result.scalars().first()
    # Kullanıcı bulunamasa bile aynı yanıtı döndür (güvenlik)
    if not user:
        return {"message": "Eğer bu e-posta kayıtlıysa, kod gönderildi."}

    # Mevcut kodları temizle
    await db.execute(
        delete(PasswordResetCode).where(PasswordResetCode.email == body.email)
    )

    # 6 haneli OTP üret ve DB'ye kaydet
    otp = "".join(random.choices(string.digits, k=6))
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    reset_entry = PasswordResetCode(
        email=body.email,
        code=otp,
        expires_at=expires,
    )
    db.add(reset_entry)
    await db.commit()

    # SendGrid ile e-posta gönder
    if settings.SENDGRID_API_KEY:
        try:
            message = Mail(
                from_email=settings.SENDGRID_FROM_EMAIL,
                to_emails=body.email,
                subject="ReceiptIQ - Şifre Sıfırlama Kodu",
                html_content=f"""
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f7f8ff; border-radius: 16px;">
                    <h2 style="color: #6C63FF; margin-bottom: 8px;">ReceiptIQ</h2>
                    <p style="color: #1A1D1E; font-size: 16px;">Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:</p>
                    <div style="background: #fff; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; border: 2px solid #6C63FF;">
                        <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #6C63FF;">{otp}</span>
                    </div>
                    <p style="color: #6B7280; font-size: 13px;">Bu kod 15 dakika geçerlidir. Eğer bu isteği siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
                </div>
                """
            )
            sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
            sg.send(message)
        except Exception as e:
            print(f"E-posta gönderilemedi: {e}")

    return {"message": "Eğer bu e-posta kayıtlıysa, sıfırlama kodu gönderildi."}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(deps.get_db),
):
    # DB'den geçerli kodu bul
    result = await db.execute(
        select(PasswordResetCode).where(
            PasswordResetCode.email == body.email,
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

    if entry.code != body.code:
        raise HTTPException(status_code=400, detail="Hatalı kod.")

    # Kullanıcının şifresini güncelle
    user_result = await db.execute(select(User).filter(User.email == body.email))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    user.hashed_password = security.get_password_hash(body.new_password)
    # Kodu kullanıldı olarak işaretle ve sil
    await db.delete(entry)
    await db.commit()

    return {"message": "Şifre başarıyla güncellendi."}


@router.post("/signup", response_model=UserSchema)
@limiter.limit("5/minute")
async def create_user(
    request: Request,
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> User:
    """Yeni kullanıcı oluştur."""
    result = await db.execute(select(User).filter(User.email == user_in.email))
    user = result.scalars().first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="Bu e-posta adresi zaten kayıtlı.",
        )
    user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
