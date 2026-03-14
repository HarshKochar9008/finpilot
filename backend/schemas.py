"""
Pydantic schemas for request/response validation in FinPilot AI.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TransactionCreate(BaseModel):
    """Schema for creating a new transaction."""

    category: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    type: str = Field(..., pattern="^(income|expense)$")
    description: Optional[str] = Field(default="", max_length=500)


class TransactionResponse(BaseModel):
    """Schema for transaction in API responses."""

    id: int
    category: str
    amount: float
    type: str
    description: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SummaryResponse(BaseModel):
    """Schema for financial summary (income, expenses, balance)."""

    total_income: float
    total_expenses: float
    balance: float


class AIAdviceResponse(BaseModel):
    """Schema for AI-generated financial advice."""

    advice: str


class UserBase(BaseModel):
    """Shared user fields."""

    name: str = Field(..., min_length=1, max_length=100)
    email: str
    role: str = Field(default="Investor", min_length=1, max_length=100)


class UserUpdate(UserBase):
    """Payload for creating or updating the single dashboard user."""

    pass


class UserResponse(UserBase):
    """User data returned to the frontend."""

    id: int

    class Config:
        from_attributes = True
