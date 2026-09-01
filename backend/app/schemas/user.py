from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Literal, Optional

class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=255)
    role: Literal["worker", "employer"]  # Public registration is restricted to worker and employer

class UserCreate(UserBase):
    phone_number: str = Field(..., pattern=r"^[0-9]{10}$")
    national_id_card: str = Field(..., min_length=5, max_length=30)
    password: str = Field(..., min_length=6, max_length=100)

    @validator("name", "email", "phone_number", "national_id_card", pre=True)
    def required_non_blank_text(cls, value):
        if not isinstance(value, str) or not value.strip():
            raise ValueError("This field is required")
        return value.strip()

    @validator("password")
    def password_cannot_be_blank(cls, value):
        if not value or not value.strip():
            raise ValueError("Password is required")
        return value

class UserLogin(BaseModel):
    email: str
    password: str
    role: Optional[Literal["worker", "employer", "admin"]] = None

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone_number: Optional[str] = None
    national_id_card: Optional[str] = None
    role: str
    created_at: datetime

    class Config:
        orm_mode = True
