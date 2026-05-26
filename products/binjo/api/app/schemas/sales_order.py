"""Pydantic schemas for sales order endpoints."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


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
