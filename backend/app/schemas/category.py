from typing import Optional
from uuid import UUID
from pydantic import BaseModel

class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(CategoryBase):
    name: Optional[str] = None

class CategoryInDBBase(CategoryBase):
    id: UUID

    model_config = {"from_attributes": True}

class Category(CategoryInDBBase):
    pass
