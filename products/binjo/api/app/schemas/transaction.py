"""Pydantic schemas for financial transaction endpoints."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


# Valid categories for expenses and income
EXPENSE_CATEGORIES = ["농약", "비료", "자재", "인건비", "연료비", "포장비", "운송비", "시설투자", "기타지출"]
INCOME_CATEGORIES = ["직거래", "스마트스토어", "도매/경매", "보조금", "기타수입"]
ALL_CATEGORIES = EXPENSE_CATEGORIES + INCOME_CATEGORIES


class TransactionCreate(BaseModel):
    """Create a manual transaction — voice entry or form input."""

    type: Literal["income", "expense"]
    category: str
    amount: Decimal = Field(gt=0, description="Amount in Korean won")
    description: str | None = None
    counterparty: str | None = None
    transaction_date: date
    source: str = "manual"
    farm_log_id: str | None = None
    notes: str | None = None


class TransactionUpdate(BaseModel):
    """Update a transaction — farmer corrects AI-parsed or manual data."""

    type: Literal["income", "expense"] | None = None
    category: str | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    description: str | None = None
    counterparty: str | None = None
    transaction_date: date | None = None
    farm_log_id: str | None = None
    notes: str | None = None


class TransactionResponse(BaseModel):
    id: str
    type: str
    category: str
    # int, not Decimal — Korean won has no decimals, and Decimal serializes as "1.2E+5"
    amount: int
    description: str | None = None
    counterparty: str | None = None
    transaction_date: date
    source: str
    source_id: str | None = None
    farm_log_id: str | None = None
    status: str
    confidence: float | None = None
    receipt_image_url: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class TransactionListResponse(BaseModel):
    transactions: list[TransactionResponse]
    total: int
