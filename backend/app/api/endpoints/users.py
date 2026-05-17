import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.api import deps
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.models.receipt import Receipt
from app.models.budget import Budget
from app.schemas.user import User as UserSchema, UserUpdate

AVATARS_DIR = os.path.join(os.path.dirname(__file__), "../../../../avatars")
os.makedirs(AVATARS_DIR, exist_ok=True)

router = APIRouter()


@router.get("/me", response_model=UserSchema)
async def read_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> User:
    """Giriş yapmış kullanıcının kendi bilgilerini döner."""
    return current_user


@router.patch("/me", response_model=UserSchema)
async def update_user_me(
    *,
    user_in: UserUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> User:
    """Profil güncelleme — yalnızca gönderilen alanlar değişir."""
    update_data = user_in.model_dump(exclude_unset=True)

    if "password" in update_data:
        password = update_data.pop("password")
        if password:
            current_user.hashed_password = security.get_password_hash(password)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserSchema)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> User:
    """Profil fotoğrafı yükleme — eski fotoğraf silinir, yeni kaydedilir."""
    # Sadece resim dosyalarına izin ver
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Sadece JPEG, PNG veya WebP yüklenebilir.")

    # Eski avatar'ı sil
    if current_user.avatar_url:
        old_filename = current_user.avatar_url.split("/avatars/")[-1]
        old_path = os.path.join(AVATARS_DIR, old_filename)
        if os.path.exists(old_path):
            os.remove(old_path)

    # Yeni dosyayı kaydet
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(AVATARS_DIR, filename)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # URL'yi DB'ye kaydet
    avatar_url = f"/avatars/{filename}"
    current_user.avatar_url = avatar_url
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_me(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """
    Hesap silme. Önce kullanıcının fişleri ve bütçeleri silinir,
    sonra kullanıcı kaydı silinir.
    """
    await db.execute(delete(Receipt).where(Receipt.user_id == current_user.id))
    await db.execute(delete(Budget).where(Budget.user_id == current_user.id))
    await db.delete(current_user)
    await db.commit()
    return None


@router.post("/me/push-token", status_code=status.HTTP_204_NO_CONTENT)
async def save_push_token(
    token_data: dict,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """Expo push token'ı kullanıcıya kaydet."""
    token = token_data.get("push_token", "").strip()
    if token:
        current_user.push_token = token
        db.add(current_user)
        await db.commit()
    return None
