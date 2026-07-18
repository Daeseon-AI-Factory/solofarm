"""Pydantic schemas for sales order endpoints."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

CustomerName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]
CustomerPhone = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=7, max_length=20),
]
CustomerAddress = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=1000),
]
ProductName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]
WeightOption = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=50),
]


class SalesOrderCreate(BaseModel):
    """Create a sales order — typically from a KakaoTalk inquiry."""

    channel: Literal["kakao", "phone", "naver", "wholesale", "offline"]
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_address: str | None = None
    product_id: str | None = None
    product_name: str | None = None
    quantity: int = 1
    weight_option: str | None = None
    unit_price: Decimal | None = Field(default=None, ge=0)
    total_amount: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None


class ManualOrderCreate(BaseModel):
    """Create an already-confirmed order paid or agreed outside the app."""

    model_config = ConfigDict(extra="forbid")

    channel: Literal["kakao", "phone", "offline"]
    customer_name: CustomerName
    customer_phone: CustomerPhone
    customer_address: CustomerAddress
    product_name: ProductName
    quantity: int = Field(gt=0, le=1000)
    weight_option: WeightOption
    unit_price: Decimal = Field(
        gt=0,
        le=Decimal("9999999999"),
        multiple_of=Decimal("1"),
    )
    total_amount: Decimal = Field(
        gt=0,
        le=Decimal("999999999999"),
        multiple_of=Decimal("1"),
    )
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None) -> str | None:
        """Store an empty notes field as null instead of meaningless whitespace."""
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SalesOrderUpdate(BaseModel):
    """Update an order — edit details or status."""

    customer_name: str | None = None
    customer_phone: str | None = None
    customer_address: str | None = None
    product_name: str | None = None
    quantity: int | None = None
    weight_option: str | None = None
    unit_price: Decimal | None = Field(default=None, ge=0)
    total_amount: Decimal | None = Field(default=None, ge=0)
    status: str | None = None
    tracking_number: str | None = None
    notes: str | None = None


class SalesOrderResponse(BaseModel):
    id: str
    channel: str
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_address: str | None = None
    product_id: str | None = None
    product_name: str | None = None
    quantity: int
    weight_option: str | None = None
    unit_price: Decimal | None = None
    total_amount: Decimal | None = None
    status: str
    tracking_number: str | None = None
    shipped_at: datetime | None = None
    delivered_at: datetime | None = None
    transaction_id: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class SalesOrderListResponse(BaseModel):
    orders: list[SalesOrderResponse]
    total: int
