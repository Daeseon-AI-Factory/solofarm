"""Pydantic schemas for payment and checkout endpoints."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CheckoutRequest(BaseModel):
    """
    Public checkout — customer creates an order before payment.

    Collects product selection + shipping info in one step. Product names and
    prices are deliberately absent because the server resolves them from the
    shared product catalog before creating an order.
    """

    # Reject legacy price fields instead of silently accepting a request that
    # could make the caller believe its client-calculated amount was trusted.
    model_config = ConfigDict(extra="forbid")

    # Product
    product_id: UUID
    quantity: int = Field(default=1, ge=1, le=20)
    weight_option: str = Field(min_length=1, max_length=50)

    # Shipping
    recipient_name: str = Field(min_length=1, max_length=100)
    recipient_phone: str = Field(min_length=1, max_length=20)
    postal_code: str | None = Field(default=None, max_length=10)
    address: str = Field(min_length=1, max_length=500)
    address_detail: str | None = Field(default=None, max_length=200)
    delivery_message: str | None = Field(default=None, max_length=500)


class CheckoutResponse(BaseModel):
    """Returned after checkout — frontend uses these to initialize Toss SDK."""

    order_id: str
    toss_order_id: str
    amount: int
    product_name: str


class PaymentConfirmRequest(BaseModel):
    """
    Toss SDK callback — sent after customer completes payment widget.

    The frontend receives these three values from Toss and forwards them
    to our server for server-side verification.
    """

    payment_key: str  # Toss payment identifier
    order_id: str  # toss_order_id we generated
    amount: int  # Must match our server-side amount (prevents tampering)


class PaymentResponse(BaseModel):
    """Payment record detail."""

    id: str
    order_id: str
    toss_payment_key: str | None = None
    toss_order_id: str
    method: str | None = None
    amount: int
    fee: int | None = None
    net_amount: int | None = None
    status: str
    receipt_url: str | None = None
    confirmed_at: datetime | None = None
    created_at: datetime


class OrderStatusResponse(BaseModel):
    """
    Public order status lookup — no auth required.

    Customers check their order status using order_id from confirmation page.
    """

    order_id: str
    status: str
    product_name: str | None = None
    total_amount: int | None = None
    payment_status: str | None = None
    tracking_number: str | None = None
    carrier: str | None = None
    created_at: datetime
