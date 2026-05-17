from typing import Optional, Literal
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

SUPPORTED_CURRENCIES = Literal[
    "TRY", "USD", "EUR", "GBP", "RUB",
    "JPY", "CNY", "CHF", "CAD", "AUD",
    "AED", "SAR", "INR", "BRL", "MXN",
]

SUPPORTED_DATE_FORMATS = Literal[
    "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD.MM.YYYY", "DD MMM YYYY",
]


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None
    theme_preference: Literal["light", "dark"] = "light"
    language_preference: Literal["tr", "en", "de", "fr", "ru"] = "tr"
    currency_preference: SUPPORTED_CURRENCIES = "TRY"
    date_format_preference: SUPPORTED_DATE_FORMATS = "DD/MM/YYYY"
    push_token: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: Optional[str] = None
    city: Optional[str] = None


class UserUpdate(BaseModel):
    """PATCH /users/me — yalnız gönderilen alanlar güncellenir."""
    full_name: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    theme_preference: Optional[Literal["light", "dark"]] = None
    language_preference: Optional[Literal["tr", "en", "de", "fr", "ru"]] = None
    currency_preference: Optional[SUPPORTED_CURRENCIES] = None
    date_format_preference: Optional[SUPPORTED_DATE_FORMATS] = None
    password: Optional[str] = Field(default=None, min_length=6)


class UserInDBBase(UserBase):
    id: UUID

    model_config = {"from_attributes": True}


class User(UserInDBBase):
    pass


class UserInDB(UserInDBBase):
    hashed_password: str
