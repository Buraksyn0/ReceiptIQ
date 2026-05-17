from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal


class RecurringCreate(BaseModel):
    merchant_name: str
    amount: float
    category: Optional[str] = "other"
    receipt_type: Optional[str] = "expense"
    frequency: Optional[str] = "monthly"  # daily | weekly | monthly | yearly
    next_date: datetime


class RecurringUpdate(BaseModel):
    merchant_name: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    receipt_type: Optional[str] = None
    frequency: Optional[str] = None
    next_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class RecurringOut(BaseModel):
    id: UUID
    user_id: UUID
    merchant_name: str
    amount: float
    category: str
    receipt_type: str
    frequency: str
    next_date: datetime
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
