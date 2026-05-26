"""Pydantic schemas for payment and checkout endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class CheckoutRequest(BaseModel):
    """
    Public checkout — customer creates an order before payment.

    Collects product selection + shipping info in one step.
    The brand page sends this, we create SalesOrder + Shipping + Payment records,
    then return the toss_order_id for the frontend SDK to initiate payment.
    """

    # Product
    product_id: str | None = None
    product_name: str
    quantity: int = Field(default=1, ge=1)
    weight_option: str | None = None
    unit_price: int = Field(ge=0)
    total_amount: int = Field(gt=0)

    # Shipping
    recipient_name: str
    recipient_phone: str
    postal_code: str | None = None
    address: str
    address_detail: str | None = None
    delivery_message: str | None = None


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
