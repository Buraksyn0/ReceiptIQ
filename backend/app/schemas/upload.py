"""UploadedFile için Pydantic şemaları."""

from datetime import datetime
from typing import Any, Optional, Literal
from uuid import UUID
from pydantic import BaseModel


class UploadedFileBase(BaseModel):
    id: UUID
    user_id: UUID
    original_filename: Optional[str] = None
    mime_type: str
    size_bytes: int
    sha256: str
    status: Literal["pending", "processing", "done", "failed"]
    error_message: Optional[str] = None
    ocr_provider: Optional[str] = None
    ocr_confidence: Optional[float] = None
    parsed_data: Optional[dict[str, Any]] = None
    receipt_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UploadedFileResponse(UploadedFileBase):
    """Upload sonrası dönen yanıt — text_content içermez (büyük olabilir)."""
    pass


class UploadedFileDetail(UploadedFileBase):
    """Tek kayıt detay endpoint'i — ham OCR metnini de içerir."""
    text_content: Optional[str] = None


class ConfirmReceiptFromUpload(BaseModel):
    """Kullanıcı OCR sonucunu onaylayıp Receipt oluştururken yollar."""
    merchant_name: Optional[str] = None
    total_amount: Optional[float] = None
    receipt_type: str = "expense"
    receipt_date: Optional[datetime] = None
    category: str = "other"
    text_content: Optional[str] = None
