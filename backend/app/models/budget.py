import uuid
from datetime import datetime
from sqlalchemy import String, Float, ForeignKey, DateTime, UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base_class import Base

class Budget(Base):
    # Eğer Base otomatik tablo adı veriyorsa "budget" olacaktır. İşi şansa bırakmayıp biz belirtebiliriz
    # ama senin mimarinde Base otomatik çalışıyor gibi görünüyor.
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    category: Mapped[str] = mapped_column(String, index=True, nullable=False)
    limit_amount: Mapped[float] = mapped_column(Float, nullable=False)
    period: Mapped[str] = mapped_column(String, default="monthly")
    
    # İŞTE KRİTİK NOKTA: Artık Integer değil, UUID! Ve tablo adı "users.id" değil, "user.id"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())