"""
UploadedFile — kullanıcının yüklediği fiş/fatura dosyasını ve
arka planda yapılan OCR/parse sonucunu temsil eder.

İş akışı:
  1. POST /receipts/upload  → status='pending', dosya diske, BackgroundTask kuyrukta
  2. Worker tamamlanır       → status='done', text_content + parsed_data dolu
  3. Hata olursa            → status='failed', error_message dolu
  4. Kullanıcı confirm eder → POST /receipts ile Receipt yaratılır,
                              UploadedFile.receipt_id set edilir
"""

import uuid
from datetime import datetime
from sqlalchemy import String, UUID, ForeignKey, DateTime, Integer, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base_class import Base


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Dosya meta
    original_filename: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)

    # OCR / parse durumu
    status: Mapped[str] = mapped_column(
        String(20), default="pending", server_default="pending", nullable=False
    )  # pending | processing | done | failed
    error_message: Mapped[str | None] = mapped_column(Text)
    text_content: Mapped[str | None] = mapped_column(Text)
    ocr_provider: Mapped[str | None] = mapped_column(String(30))
    ocr_confidence: Mapped[float | None] = mapped_column()
    parsed_data: Mapped[dict | None] = mapped_column(JSON)

    # Onaylanıp Receipt'e dönüştürüldüğünde set edilir
    receipt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("receipt.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
