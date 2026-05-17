"""
ReceiptIQ — Bildirim Modeli

Bildirim tipleri:
  - anomaly:          Anormal harcama tespit edildi
  - budget_exceeded:  Bütçe aşıldı
  - info:             Genel bilgi

Her bildirim kullanıcıya özel, okundu/okunmadı takibi var.
"""

import uuid
from datetime import datetime
from sqlalchemy import String, UUID, ForeignKey, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base_class import Base


class Notification(Base):
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Bildirim tipi: anomaly | budget_exceeded | info
    notification_type: Mapped[str] = mapped_column(String, nullable=False)

    title: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # İlgili fiş (opsiyonel — anomali bildirimlerinde dolu)
    receipt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("receipt.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_read: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User")
