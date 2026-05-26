"""
Checkout flow — creates order + shipping + payment records for direct purchases.

# CORE_CANDIDATE — checkout pipeline reusable across products.

This module orchestrates the pre-payment setup:
1. Create SalesOrder (channel='direct', status='inquiry')
2. Create Shipping record with recipient details
3. Create Payment record (status='pending') with generated toss_order_id
4. Return the toss_order_id for the frontend Toss SDK

The payment is NOT charged here — that happens when the customer completes
the Toss widget and our /payments/confirm endpoint is called.
"""

import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.models.sales_order import SalesOrder
from app.models.shipping import Shipping
from app.schemas.payment import CheckoutRequest, CheckoutResponse

logger = logging.getLogger(__name__)


def _generate_toss_order_id() -> str:
    """
    Generate a unique order ID for TossPayments.

    Format: BJ{YYYYMMDD}{random8} — e.g., BJ20260324a3b5c7d9
    Toss requires order IDs to be unique and 6-64 characters.
    """
    now = datetime.now(UTC)
    date_part = now.strftime("%Y%m%d")
    random_part = uuid.uuid4().hex[:8]
    return f"BJ{date_part}{random_part}"


async def create_checkout(
    db: AsyncSession,
    body: CheckoutRequest,
    farm_id: uuid.UUID,
) -> CheckoutResponse:
    """
    Create all records needed before payment.

    Returns the toss_order_id that the frontend passes to the Toss SDK widget.
    After the customer completes payment, Toss redirects to our confirm endpoint.
    """
    toss_order_id = _generate_toss_order_id()

    # 1. Create the sales order
    order = SalesOrder(
        farm_id=farm_id,
        customer_name=body.recipient_name,
        customer_phone=body.recipient_phone,
        customer_address=body.address,
        channel="direct",  # Brand page direct purchase
        product_id=uuid.UUID(body.product_id) if body.product_id else None,
        product_name=body.product_name,
        quantity=body.quantity,
        weight_option=body.weight_option,
        unit_price=Decimal(str(body.unit_price)),
        total_amount=Decimal(str(body.total_amount)),
        status="inquiry",  # Pre-payment
    )
    db.add(order)
    await db.flush()  # Get order.id

    # 2. Create shipping record
    shipping = Shipping(
        order_id=order.id,
        recipient_name=body.recipient_name,
        recipient_phone=body.recipient_phone,
        postal_code=body.postal_code,
        address=body.address,
        address_detail=body.address_detail,
        delivery_message=body.delivery_message,
    )
    db.add(shipping)

    # 3. Create pending payment record
    payment = Payment(
        order_id=order.id,
        toss_order_id=toss_order_id,
        amount=Decimal(str(body.total_amount)),
        status="pending",
    )
    db.add(payment)

    await db.commit()

    logger.info(
        "Checkout created: order=%s, toss_order_id=%s, amount=%d",
        order.id, toss_order_id, body.total_amount,
    )

    return CheckoutResponse(
        order_id=str(order.id),
        toss_order_id=toss_order_id,
        amount=body.total_amount,
        product_name=body.product_name,
    )
