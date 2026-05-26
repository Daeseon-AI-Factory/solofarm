"""
Sales order state machine — manages order lifecycle and financial side effects.

When an order reaches 'delivered', an income transaction is auto-created.
This connects the sales pipeline to the financial ledger automatically —
the farmer marks delivery, the money shows up in reports.

# CORE_CANDIDATE — order lifecycle management reusable across products.
"""

import logging
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.financial_transaction import FinancialTransaction
from app.models.sales_order import SalesOrder

logger = logging.getLogger(__name__)

# Map order channel to income category for auto-created transactions
CHANNEL_TO_CATEGORY = {
    "kakao": "직거래",
    "phone": "직거래",
    "naver": "스마트스토어",
    "wholesale": "도매/경매",
    "offline": "직거래",
}


async def create_income_from_delivery(
    db: AsyncSession,
    order: SalesOrder,
    farmer_id,
) -> FinancialTransaction:
    """
    Auto-create an income transaction when an order is delivered.

    Called by the deliver endpoint after status is set to 'delivered'.
    The transaction is auto-confirmed (confidence=1.0) because it's
    system-generated from a known order, not AI-parsed.
    """
    category = CHANNEL_TO_CATEGORY.get(order.channel, "기타수입")
    amount = order.total_amount or Decimal("0")

    # Build a readable description
    desc_parts = []
    if order.product_name:
        desc_parts.append(order.product_name)
    if order.quantity and order.quantity > 1:
        desc_parts.append(f"{order.quantity}건")
    if order.weight_option:
        desc_parts.append(order.weight_option)
    description = " ".join(desc_parts) if desc_parts else "주문 배송완료"

    txn = FinancialTransaction(
        farm_id=order.farm_id,
        farmer_id=farmer_id,
        type="income",
        category=category,
        amount=amount,
        description=description,
        counterparty=order.customer_name,
        transaction_date=date.today(),
        source="order",
        source_id=order.id,
        # Auto-confirmed — system-generated, no AI uncertainty
        status="confirmed",
        confidence=Decimal("1.00"),
    )
    db.add(txn)
    await db.flush()  # Get txn.id

    # Link the transaction back to the order
    order.transaction_id = txn.id

    logger.info(
        "Auto-created income transaction %s from order %s: %s원 (%s)",
        txn.id, order.id, amount, category,
    )

    return txn
