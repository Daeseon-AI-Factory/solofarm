"""Customer identity and analytics updates shared by non-payment order flows."""

import logging
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.sales_order import SalesOrder

logger = logging.getLogger(__name__)

MANUAL_ORDER_CHANNELS = frozenset({"kakao", "phone", "offline"})


async def ensure_customer_identity(
    db: AsyncSession,
    order: SalesOrder,
    *,
    lock: bool = False,
) -> Customer | None:
    """Create or refresh a customer identity without changing sales analytics."""
    if not order.customer_phone:
        return None

    query = select(Customer).where(
        Customer.farm_id == order.farm_id,
        Customer.phone == order.customer_phone,
    )
    if lock:
        query = query.with_for_update()

    result = await db.execute(query)
    customer = result.scalar_one_or_none()

    if customer is None:
        customer = Customer(
            farm_id=order.farm_id,
            phone=order.customer_phone,
            name=order.customer_name,
            address=order.customer_address,
            total_orders=0,
            total_spent=Decimal("0"),
            preferred_products=[],
        )
        db.add(customer)
        return customer

    if order.customer_name:
        customer.name = order.customer_name
    if order.customer_address:
        customer.address = order.customer_address
    return customer


async def record_manual_order_delivery(
    db: AsyncSession,
    order: SalesOrder,
    *,
    completed_at: datetime | None = None,
) -> Customer | None:
    """Count a delivered manual order once its locked order changes state."""
    if order.status != "delivered" or order.channel not in MANUAL_ORDER_CHANNELS:
        return None

    customer = await ensure_customer_identity(db, order, lock=True)
    if customer is None:
        return None

    completed_at = completed_at or datetime.now(UTC)
    customer.total_orders = (customer.total_orders or 0) + 1
    customer.total_spent = (customer.total_spent or Decimal("0")) + (
        order.total_amount or Decimal("0")
    )
    if customer.first_order_at is None:
        customer.first_order_at = completed_at
    customer.last_order_at = completed_at

    products = list(customer.preferred_products or [])
    if order.product_name and order.product_name not in products:
        products.append(order.product_name)
    customer.preferred_products = products

    logger.info(
        "Manual order counted for customer: order=%s, customer=%s, total_orders=%d",
        order.id,
        customer.id,
        customer.total_orders,
    )
    return customer
