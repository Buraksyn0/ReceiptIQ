import random
import string
from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from app.api import deps
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import UserCreate, User as UserSchema

# Geçici bellek içi OTP deposu: {email: (otp, expires_at)}
_reset_codes: dict = {}

router = APIRouter()

@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    result = await db.execute(select(User).filter(User.email == form_data.username))
    user = result.scalars().first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )
    return Token(
        access_token=access_token, token_type="bearer"
    )

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(deps.get_db),
):
    result = await db.execute(select(User).filter(User.email == body.email))
    user = result.scalars().first()
    # Kullanıcı bulunamasa bile aynı yanıtı döndür (güvenlik)
    if not user:
        return {"message": "Eğer bu e-posta kayıtlıysa, kod gönderildi."}

    # 6 haneli OTP üret
    otp = "".join(random.choices(string.digits, k=6))
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    _reset_codes[body.email] = (otp, expires)

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
    entry = _reset_codes.get(body.email)
    if not entry:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş kod.")

    otp, expires = entry
    if datetime.now(timezone.utc) > expires:
        del _reset_codes[body.email]
        raise HTTPException(status_code=400, detail="Kodun süresi dolmuş. Lütfen tekrar isteyin.")

    if otp != body.code:
        raise HTTPException(status_code=400, detail="Hatalı kod.")

    result = await db.execute(select(User).filter(User.email == body.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    user.hashed_password = security.get_password_hash(body.new_password)
    await db.commit()
    del _reset_codes[body.email]

    return {"message": "Şifre başarıyla güncellendi."}


@router.post("/signup", response_model=UserSchema)
async def create_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> User:
    """
    Create new user.
    """
    result = await db.execute(select(User).filter(User.email == user_in.email))
    user = result.scalars().first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
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
