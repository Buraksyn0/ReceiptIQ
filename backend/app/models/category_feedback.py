"""
CategoryFeedback — Kullanıcının ML kategori önerisini düzelttiği kayıtlar.

Amaç:
  - Model "market" önerdi, kullanıcı "transport" seçti → buraya kaydedilir
  - Haftalık retrain sırasında bu tablo gerçek eğitim verisi olarak kullanılır
  - Online learning hazırlığı: suggested vs selected delta'sı model kalitesini ölçer

Retrain komutu:
    python scripts/train_classifier.py --use-feedback
    (Faz 2 ikinci iterasyonunda eklenecek)
"""

import uuid
from datetime import datetime
from sqlalchemy import String, UUID, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base_class import Base


class CategoryFeedback(Base):
    __tablename__ = "category_feedback"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Upload ile ilişki (receipt henüz oluşmadan önce de kaydedilebilir)
    upload_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uploaded_files.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Receipt oluşturulduktan sonra set edilir
    receipt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("receipt.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ML tahmini vs kullanıcı seçimi
    suggested_category: Mapped[str | None] = mapped_column(String(50))
    selected_category: Mapped[str] = mapped_column(String(50), nullable=False)

    # Tahminde kullanılan OCR metni — retrain'de feature olarak kullanılır
    ocr_text: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
