import uuid
from sqlalchemy import String, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base_class import Base

class Category(Base):
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
