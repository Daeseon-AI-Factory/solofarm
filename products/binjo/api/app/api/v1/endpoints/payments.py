"""
Public payment endpoints — guest checkout, no auth required.

These endpoints power the brand page direct ordering flow:
1. Customer fills checkout form → POST /checkout
2. Frontend initializes Toss widget with toss_order_id + amount
3. Customer completes payment → Toss redirects → POST /confirm
4. Customer checks order status → GET /orders/{id}/status
5. Toss sends async events → POST /webhook

NO authentication — these are public-facing for customer use.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.database import get_db
from core.payment.toss_provider import TossPaymentError, TossProvider
from app.models.payment import Payment
from app.models.sales_order import SalesOrder
from app.models.shipping import Shipping
from app.modules.orders.checkout import create_checkout
from app.modules.orders.payment_flow import confirm_payment
from app.schemas.payment import (
    CheckoutRequest,
    CheckoutResponse,
    OrderStatusResponse,
    PaymentConfirmRequest,
    PaymentResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Single farm MVP — hardcoded farm_id for Binjo Farm
# TODO: Make this configurable or derive from URL/subdomain when multi-farm
_BINJO_FARM_ID: UUID | None = None


async def _get_farm_id(db: AsyncSession) -> UUID:
    """
    Get the single farm's ID.

    Cached after first call. For a single-farm MVP, querying the farm table
    is overkill, but it avoids hardcoding a UUID that changes per environment.
    """
    global _BINJO_FARM_ID
    if _BINJO_FARM_ID is None:
        from sqlalchemy import text
        result = await db.execute(text("SELECT id FROM farm LIMIT 1"))
        row = result.first()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "NO_FARM", "message": "농장 정보를 찾을 수 없습니다"},
            )
        _BINJO_FARM_ID = row[0]
    return _BINJO_FARM_ID


@router.post("/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
async def checkout(
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
) -> CheckoutResponse:
    """
    Create order records and return toss_order_id for payment widget.

    The frontend uses the returned toss_order_id and amount to initialize
    the TossPayments JavaScript SDK widget.
    """
    farm_id = await _get_farm_id(db)
    return await create_checkout(db, body, farm_id)


@router.post("/confirm", response_model=PaymentResponse)
async def confirm(
    body: PaymentConfirmRequest,
    db: AsyncSession = Depends(get_db),
) -> PaymentResponse:
    """
    Confirm payment after Toss widget completion.

    The frontend receives paymentKey, orderId, and amount from the Toss SDK
    redirect and forwards them here. We verify the amount server-side,
    then call Toss API to finalize the charge.

    Idempotent — calling this twice with the same paymentKey returns success.
    """
    toss = TossProvider()
    try:
        payment = await confirm_payment(db, body, toss)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PAYMENT_ERROR", "message": str(e)},
        )
    except TossPaymentError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": e.code, "message": e.message},
        )

    return _payment_to_response(payment)


@router.get("/orders/{order_id}/status", response_model=OrderStatusResponse)
async def order_status(
    order_id: str,
    db: AsyncSession = Depends(get_db),
) -> OrderStatusResponse:
    """
    Public order status lookup — no auth required.

    Customers use this to check their order after purchase.
    """
    result = await db.execute(
        select(SalesOrder).where(SalesOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "주문을 찾을 수 없습니다"},
        )

    # Get payment status
    pay_result = await db.execute(
        select(Payment).where(Payment.order_id == order.id)
    )
    payment = pay_result.scalar_one_or_none()

    # Get shipping info
    ship_result = await db.execute(
        select(Shipping).where(Shipping.order_id == order.id)
    )
    shipping = ship_result.scalar_one_or_none()

    return OrderStatusResponse(
        order_id=str(order.id),
        status=order.status,
        product_name=order.product_name,
        total_amount=int(order.total_amount) if order.total_amount else None,
        payment_status=payment.status if payment else None,
        tracking_number=shipping.tracking_number if shipping else order.tracking_number,
        carrier=shipping.carrier if shipping else None,
        created_at=order.created_at,
    )


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def toss_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    TossPayments webhook receiver.

    Handles async payment events (virtual account deposits, cancellations).
    Must return 200 quickly — Toss retries on non-200 responses.
    """
    body = await request.body()

    # Verify webhook signature
    toss = TossProvider()
    signature = request.headers.get("Toss-Signature", "")
    if not toss.verify_webhook(body, signature):
        logger.warning("Invalid Toss webhook signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    # Parse and log — detailed handling for virtual account deposits etc.
    import json
    event = json.loads(body)
    event_type = event.get("eventType", "unknown")
    logger.info("Toss webhook received: type=%s", event_type)

    # For now, log and acknowledge — expand handling as needed
    return {"status": "ok"}


def _payment_to_response(payment: Payment) -> PaymentResponse:
    """Convert Payment ORM object to response schema."""
    return PaymentResponse(
        id=str(payment.id),
        order_id=str(payment.order_id),
        toss_payment_key=payment.toss_payment_key,
        toss_order_id=payment.toss_order_id,
        method=payment.method,
        amount=int(payment.amount),
        fee=int(payment.fee) if payment.fee else None,
        net_amount=int(payment.net_amount) if payment.net_amount else None,
        status=payment.status,
        receipt_url=payment.receipt_url,
        confirmed_at=payment.confirmed_at,
        created_at=payment.created_at,
    )
