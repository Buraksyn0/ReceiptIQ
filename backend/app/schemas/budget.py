from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID


class BudgetCreate(BaseModel):
    category: str
    limit_amount: float
    period: Optional[str] = "monthly"


class BudgetUpdate(BaseModel):
    category: Optional[str] = None
    limit_amount: Optional[float] = None
    period: Optional[str] = None


class Budget(BaseModel):
    id: int
    category: str
    limit_amount: float
    period: str
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class BudgetWithSpent(Budget):
    spent_amount: float = 0.0
