import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import String, UUID, ForeignKey, Numeric, DateTime, Text, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Receipt(Base):
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
    )
    merchant_name: Mapped[str | None] = mapped_column(String)
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    receipt_type: Mapped[str] = mapped_column(
        String, default="expense", server_default="expense"
    )
    receipt_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    text_content: Mapped[str | None] = mapped_column(Text)

    category: Mapped[str] = mapped_column(
        String,
        default="other",
        server_default="other",
        nullable=False,
    )

    # Faz 1: bu fiş, hangi yüklenen dosyadan üretildi (opsiyonel)
    source_file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uploaded_files.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Faz 4: anomali tespiti
    is_anomaly: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    anomaly_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Kayıt oluşturma zamanı (sıralama için)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        server_default="now()",
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="receipts")
    tags: Mapped[list["ReceiptTag"]] = relationship(
        "ReceiptTag", back_populates="receipt", cascade="all, delete-orphan"
    )
