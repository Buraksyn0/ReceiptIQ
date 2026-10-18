import uuid
from datetime import datetime
from sqlalchemy import String, UUID, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base_class import Base


class EmailVerificationCode(Base):
    """Kayıt sonrası e-posta doğrulama OTP kodları."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String, index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Yanlış deneme sayısı — 6 haneli kodun kaba kuvvetle (brute force) bulunmasını engeller
    attempts: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
