"""Pydantic schemas for customer analytics endpoints."""

from datetime import datetime

from pydantic import BaseModel


class CustomerResponse(BaseModel):
    """Customer detail with pre-computed analytics."""

    id: str
    phone: str
    name: str | None = None
    address: str | None = None
    total_orders: int
    total_spent: int
    first_order_at: datetime | None = None
    last_order_at: datetime | None = None
    preferred_products: list[str] = []
    notes: str | None = None
    created_at: datetime


class CustomerListResponse(BaseModel):
    """Paginated customer list."""

    customers: list[CustomerResponse]
    total: int


class InsightResponse(BaseModel):
    """AI-generated insight for the farmer."""

    id: str
    type: str
    title: str
    content: str
    data: dict | None = None
    priority: str
    status: str
    generated_at: datetime
    read_at: datetime | None = None


class InsightListResponse(BaseModel):
    """List of AI insights."""

    insights: list[InsightResponse]
    total: int
