import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import String, UUID, ForeignKey, Numeric, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class RecurringTransaction(Base):
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
    )
    merchant_name: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    category: Mapped[str] = mapped_column(String, default="other", nullable=False)
    receipt_type: Mapped[str] = mapped_column(String, default="expense", nullable=False)

    # Sıklık: daily | weekly | monthly | yearly
    frequency: Mapped[str] = mapped_column(String, nullable=False, default="monthly")

    # Sonraki otomatik işlem tarihi
    next_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        server_default="now()",
        nullable=False,
    )

    user: Mapped["User"] = relationship("User")
