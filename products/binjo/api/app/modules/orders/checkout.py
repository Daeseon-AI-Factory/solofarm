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
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.models.sales_order import SalesOrder
from app.models.shipping import Shipping
from app.schemas.payment import CheckoutRequest, CheckoutResponse

logger = logging.getLogger(__name__)


def _checkout_error(status_code: int, code: str, message: str) -> HTTPException:
    """Build the structured public error format used by payment endpoints."""
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def _resolve_unit_price(price_options: object, weight_option: str) -> int:
    """Return the configured price for an exact catalog weight-option match."""
    if not isinstance(price_options, list):
        raise _checkout_error(
            status.HTTP_409_CONFLICT,
            "PRODUCT_PRICE_UNAVAILABLE",
            "상품 가격 정보를 확인할 수 없습니다",
        )

    matching_option = next(
        (
            option
            for option in price_options
            if isinstance(option, dict) and option.get("weight") == weight_option
        ),
        None,
    )
    if matching_option is None:
        raise _checkout_error(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_WEIGHT_OPTION",
            "선택한 상품 옵션을 찾을 수 없습니다",
        )

    raw_price = matching_option.get("price")
    if isinstance(raw_price, bool):
        raw_price = None

    try:
        price = Decimal(str(raw_price))
    except (InvalidOperation, TypeError, ValueError):
        price = Decimal(0)

    # Korean won prices must be positive whole numbers. Invalid catalog data is
    # an operational configuration issue, never a value the client may repair.
    if not price.is_finite() or price <= 0 or price != price.to_integral_value():
        raise _checkout_error(
            status.HTTP_409_CONFLICT,
            "PRODUCT_PRICE_UNAVAILABLE",
            "상품 가격 정보를 확인할 수 없습니다",
        )

    return int(price)


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
    # Product is Prisma-managed Phase 1 data shared with this SQLAlchemy API.
    # A narrow read query avoids declaring a second ORM owner for that table.
    product_result = await db.execute(
        text(
            """
            SELECT id, name, is_available, price_options
            FROM product
            WHERE id = :product_id AND farm_id = :farm_id
            LIMIT 1
            """
        ),
        {"product_id": body.product_id, "farm_id": farm_id},
    )
    product = product_result.mappings().one_or_none()

    if product is None:
        raise _checkout_error(
            status.HTTP_404_NOT_FOUND,
            "PRODUCT_NOT_FOUND",
            "상품을 찾을 수 없습니다",
        )
    if not product["is_available"]:
        raise _checkout_error(
            status.HTTP_409_CONFLICT,
            "PRODUCT_UNAVAILABLE",
            "현재 판매 중인 상품이 아닙니다",
        )

    unit_price = _resolve_unit_price(product["price_options"], body.weight_option)
    total_amount = unit_price * body.quantity
    toss_order_id = _generate_toss_order_id()

    # 1. Create the sales order
    order = SalesOrder(
        farm_id=farm_id,
        customer_name=body.recipient_name,
        customer_phone=body.recipient_phone,
        customer_address=body.address,
        channel="direct",  # Brand page direct purchase
        product_id=body.product_id,
        product_name=product["name"],
        quantity=body.quantity,
        weight_option=body.weight_option,
        unit_price=Decimal(unit_price),
        total_amount=Decimal(total_amount),
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
        amount=Decimal(total_amount),
        status="pending",
    )
    db.add(payment)

    await db.commit()

    logger.info(
        "Checkout created: order=%s, toss_order_id=%s, amount=%d",
        order.id, toss_order_id, total_amount,
    )

    return CheckoutResponse(
        order_id=str(order.id),
        toss_order_id=toss_order_id,
        amount=total_amount,
        product_name=product["name"],
    )
