from pydantic import BaseModel, model_validator, field_validator
from datetime import datetime
from typing import Optional, List, Any
from uuid import UUID
from decimal import Decimal


class TagSummary(BaseModel):
    id: UUID
    name: str
    color: str

    model_config = {"from_attributes": True}


class ReceiptBase(BaseModel):
    merchant_name: Optional[str] = None
    total_amount: Optional[Decimal] = None
    receipt_type: Optional[str] = "expense"
    receipt_date: Optional[datetime] = None
    text_content: Optional[str] = None
    category: Optional[str] = "other"


class ReceiptCreate(ReceiptBase):
    pass


class ReceiptUpdate(BaseModel):
    """PATCH/PUT — yalnız gönderilen alanlar değişir."""
    merchant_name: Optional[str] = None
    total_amount: Optional[Decimal] = None
    receipt_type: Optional[str] = None
    receipt_date: Optional[datetime] = None
    text_content: Optional[str] = None
    category: Optional[str] = None


class Receipt(ReceiptBase):
    id: UUID
    user_id: UUID
    created_at: Optional[datetime] = None
    # Faz 4: anomali alanları
    is_anomaly: bool = False
    anomaly_score: Optional[float] = None
    # Fiş fotoğrafı — tarama ile oluşturulmuş fişlerde dolu olur
    source_file_id: Optional[UUID] = None
    has_photo: bool = False
    tags: List[TagSummary] = []

    @field_validator('tags', mode='before')
    @classmethod
    def convert_receipt_tags(cls, v: Any) -> List[dict]:
        """ReceiptTag ORM nesnelerini TagSummary dict'e çevir."""
        if not v:
            return []
        result = []
        for item in v:
            if hasattr(item, 'tag') and item.tag is not None:
                t = item.tag
                result.append({'id': t.id, 'name': t.name, 'color': t.color})
            elif isinstance(item, dict):
                result.append(item)
        return result

    @model_validator(mode='after')
    def compute_has_photo(self) -> 'Receipt':
        self.has_photo = self.source_file_id is not None
        return self

    class Config:
        from_attributes = True
