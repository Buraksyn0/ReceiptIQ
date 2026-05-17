import uuid
from datetime import datetime
from sqlalchemy import String, UUID, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Tag(Base):
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#00A878", nullable=False)  # hex renk
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        server_default="now()",
        nullable=False,
    )

    receipts: Mapped[list["ReceiptTag"]] = relationship(
        "ReceiptTag", back_populates="tag", cascade="all, delete-orphan"
    )


class ReceiptTag(Base):
    __tablename__ = "receipt_tag"

    receipt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("receipt.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tag.id", ondelete="CASCADE"),
        primary_key=True,
    )

    receipt: Mapped["Receipt"] = relationship("Receipt", back_populates="tags")
    tag: Mapped["Tag"] = relationship("Tag", back_populates="receipts")
