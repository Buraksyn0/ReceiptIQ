import uuid
from datetime import datetime
from sqlalchemy import String, UUID, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class User(Base):
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String)

    # 2.1.1 — Profil: isim, şehir, telefon, avatar, üyelik tarihi
    city: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(30))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    theme_preference: Mapped[str] = mapped_column(
        String(10), default="light", server_default="light", nullable=False
    )
    language_preference: Mapped[str] = mapped_column(
        String(5), default="tr", server_default="tr", nullable=False
    )
    currency_preference: Mapped[str] = mapped_column(
        String(3), default="TRY", server_default="TRY", nullable=False
    )
    date_format_preference: Mapped[str] = mapped_column(
        String(20), default="DD/MM/YYYY", server_default="DD/MM/YYYY", nullable=False
    )

    # Expo Push Notification token
    push_token: Mapped[str | None] = mapped_column(String(200), nullable=True)

    receipts: Mapped[list["Receipt"]] = relationship(
        "Receipt", back_populates="user", cascade="all, delete-orphan"
    )
