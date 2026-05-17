from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class SavingsGoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    target_amount: float = Field(gt=0)
    deadline: Optional[datetime] = None


class SavingsGoalUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    target_amount: Optional[float] = Field(default=None, gt=0)
    deadline: Optional[datetime] = None
    is_active: Optional[bool] = None


class SavingsGoalOut(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    target_amount: float
    deadline: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
