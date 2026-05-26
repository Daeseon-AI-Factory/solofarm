"""
Payment confirmation flow — verifies and finalizes payments after Toss widget completion.

Flow:
1. Frontend sends paymentKey + orderId + amount from Toss SDK redirect
2. We verify amount matches our server-side record (prevents tampering)
3. Call Toss API to confirm the payment
4. Update Payment status to 'confirmed'
5. Update SalesOrder status to 'paid'
6. Upsert Customer record for analytics

This endpoint MUST be idempotent — Toss SDK can redirect multiple times,
and the webhook may fire concurrently. If the payment is already confirmed,
return success without re-processing.
"""

import logging
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.payment.toss_provider import TossPaymentError, TossProvider
from app.models.customer import Customer
from app.models.financial_transaction import FinancialTransaction
from app.models.payment import Payment
from app.models.sales_order import SalesOrder
from app.schemas.payment import PaymentConfirmRequest

logger = logging.getLogger(__name__)


async def confirm_payment(
    db: AsyncSession,
    body: PaymentConfirmRequest,
    toss: TossProvider,
) -> Payment:
    """
    Verify and finalize a payment from the Toss SDK callback.

    Raises ValueError if the payment is not found or amount doesn't match.
    Raises TossPaymentError if Toss rejects the confirmation.
    """
    # 1. Find our payment record by toss_order_id
    result = await db.execute(
        select(Payment).where(Payment.toss_order_id == body.order_id)
    )
    payment = result.scalar_one_or_none()

    if payment is None:
        raise ValueError(f"Payment not found for toss_order_id: {body.order_id}")

    # Idempotency: if already confirmed, return the existing payment
    if payment.status == "confirmed":
        logger.info("Payment %s already confirmed, returning existing", payment.id)
        return payment

    # 2. Amount verification — reject if client amount doesn't match server
    # This prevents price tampering in the frontend
    if int(payment.amount) != body.amount:
        logger.error(
            "Amount mismatch: server=%d, client=%d, toss_order_id=%s",
            int(payment.amount), body.amount, body.order_id,
        )
        raise ValueError(
            f"Amount mismatch: expected {int(payment.amount)}, got {body.amount}"
        )

    # 3. Call Toss API to confirm the charge
    toss_response = await toss.confirm_payment(
        payment_key=body.payment_key,
        order_id=body.order_id,
        amount=body.amount,
    )

    # 4. Update payment record with Toss response
    payment.toss_payment_key = body.payment_key
    payment.method = toss_response.get("method")
    payment.status = "confirmed"
    payment.confirmed_at = datetime.now(UTC)
    payment.receipt_url = toss_response.get("receipt", {}).get("url")

    # Card details (if card payment)
    card = toss_response.get("card")
    if card:
        payment.card_company = card.get("company")
        payment.card_number_masked = card.get("number")

    # 5. Update order status to 'paid'
    order_result = await db.execute(
        select(SalesOrder).where(SalesOrder.id == payment.order_id)
    )
    order = order_result.scalar_one_or_none()
    if order:
        order.status = "paid"

        # 6. Upsert customer record for analytics
        await _upsert_customer(db, order)

    await db.commit()
    await db.refresh(payment)

    logger.info(
        "Payment confirmed: payment=%s, order=%s, amount=%d, method=%s",
        payment.id, payment.order_id, body.amount, payment.method,
    )

    return payment


async def cancel_payment(
    db: AsyncSession,
    payment: Payment,
    reason: str,
    toss: TossProvider,
) -> Payment:
    """
    Cancel a payment and trigger refund via Toss.

    Only confirmed payments can be cancelled. Updates both Payment and SalesOrder.
    """
    if payment.status != "confirmed":
        raise ValueError(f"Cannot cancel payment in status: {payment.status}")

    if not payment.toss_payment_key:
        raise ValueError("No Toss payment key — cannot process refund")

    # Call Toss to process refund
    await toss.cancel_payment(payment.toss_payment_key, reason)

    payment.status = "refunded"
    payment.cancelled_at = datetime.now(UTC)

    # Update order status
    order_result = await db.execute(
        select(SalesOrder).where(SalesOrder.id == payment.order_id)
    )
    order = order_result.scalar_one_or_none()
    if order:
        order.status = "cancelled"

    await db.commit()
    await db.refresh(payment)

    logger.info("Payment cancelled: payment=%s, reason=%s", payment.id, reason)
    return payment


async def _upsert_customer(db: AsyncSession, order: SalesOrder) -> None:
    """
    Create or update customer record after payment confirmation.

    Uses (farm_id, phone) as the unique key. Updates analytics counters
    and last-used address for returning customers.
    """
    if not order.customer_phone:
        return

    result = await db.execute(
        select(Customer).where(
            Customer.farm_id == order.farm_id,
            Customer.phone == order.customer_phone,
        )
    )
    customer = result.scalar_one_or_none()

    now = datetime.now(UTC)

    if customer is None:
        # New customer
        customer = Customer(
            farm_id=order.farm_id,
            phone=order.customer_phone,
            name=order.customer_name,
            address=order.customer_address,
            total_orders=1,
            total_spent=order.total_amount or Decimal("0"),
            first_order_at=now,
            last_order_at=now,
            preferred_products=[order.product_name] if order.product_name else [],
        )
        db.add(customer)
    else:
        # Returning customer — update analytics
        customer.total_orders += 1
        customer.total_spent += order.total_amount or Decimal("0")
        customer.last_order_at = now
        if order.customer_name:
            customer.name = order.customer_name
        if order.customer_address:
            customer.address = order.customer_address

        # Add product to preferred list if not already there
        if order.product_name and customer.preferred_products:
            if order.product_name not in customer.preferred_products:
                customer.preferred_products = customer.preferred_products + [order.product_name]
        elif order.product_name:
            customer.preferred_products = [order.product_name]

    logger.info(
        "Customer upserted: phone=%s, total_orders=%d",
        order.customer_phone, customer.total_orders,
    )
