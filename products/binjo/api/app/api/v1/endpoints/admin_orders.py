"""
Admin order management endpoints — farmer manages orders, ships, cancels.

Admin auth required (uses get_current_admin_farmer). These extend the Phase 3 orders
endpoint with payment-aware operations: ship with tracking, cancel with
refund, and customer analytics.
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from core.payment.toss_provider import TossPaymentError, TossProvider
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin_farmer
from app.models.customer import Customer
from app.models.farmer import Farmer
from app.models.payment import Payment
from app.models.sales_order import SalesOrder
from app.models.shipping import Shipping
from app.modules.bookkeeping.order_flow import create_income_from_delivery
from app.modules.orders.customer_flow import (
    ensure_customer_identity,
    record_manual_order_delivery,
)
from app.modules.orders.payment_flow import cancel_payment
from app.schemas.customer import CustomerListResponse, CustomerResponse
from app.schemas.sales_order import (
    ManualOrderCreate,
)
from app.schemas.sales_order import (
    SalesOrderResponse as OrderResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_farm_id(farmer: Farmer) -> UUID:
    """Return the authenticated farmer's farm or deny unscoped access."""
    if farmer.farm_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FARM_NOT_ASSIGNED",
                "message": "관리자 계정에 농장이 연결되지 않았습니다",
            },
        )
    return farmer.farm_id


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_order(
    body: ManualOrderCreate,
    farmer: Farmer = Depends(get_current_admin_farmer),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    """Create a confirmed order agreed through Kakao, phone, or offline."""
    farm_id = _require_farm_id(farmer)
    order = SalesOrder(
        farm_id=farm_id,
        channel=body.channel,
        customer_name=body.customer_name,
        customer_phone=body.customer_phone,
        customer_address=body.customer_address,
        product_name=body.product_name,
        quantity=body.quantity,
        weight_option=body.weight_option,
        unit_price=body.unit_price,
        total_amount=body.total_amount,
        notes=body.notes,
        status="confirmed",
    )
    db.add(order)
    await ensure_customer_identity(db, order)
    await db.commit()
    await db.refresh(order)

    logger.info("Manual order created: order=%s, channel=%s", order.id, order.channel)
    return _order_to_response(order)


@router.get("", response_model=list[OrderResponse])
async def list_admin_orders(
    order_status: str | None = Query(None, alias="status"),
    channel: str | None = Query(None),
    farmer: Farmer = Depends(get_current_admin_farmer),
    db: AsyncSession = Depends(get_db),
) -> list[OrderResponse]:
    """List all orders with optional status and channel filters."""
    farm_id = _require_farm_id(farmer)

    query = (
        select(SalesOrder)
        .where(SalesOrder.farm_id == farm_id)
        .order_by(SalesOrder.created_at.desc())
    )
    if order_status:
        query = query.where(SalesOrder.status == order_status)
    if channel:
        query = query.where(SalesOrder.channel == channel)

    result = await db.execute(query)
    orders = result.scalars().all()

    return [_order_to_response(o) for o in orders]


@router.put("/{order_id}/confirm", response_model=OrderResponse)
async def confirm_order(
    order_id: str,
    farmer: Farmer = Depends(get_current_admin_farmer),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    """Farmer confirms a paid order — ready for shipping prep."""
    order = await _get_order(db, order_id, farmer, for_update=True)

    if order.status != "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_STATUS",
                "message": f"'paid' 상태의 주문만 확인할 수 있습니다 (현재: {order.status})",
            },
        )

    order.status = "confirmed"
    await db.commit()
    await db.refresh(order)

    return _order_to_response(order)


@router.put("/{order_id}/ship", response_model=OrderResponse)
async def ship_order(
    order_id: str,
    carrier: str = Query(..., description="Delivery carrier name"),
    tracking_number: str = Query(..., description="Tracking number"),
    farmer: Farmer = Depends(get_current_admin_farmer),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    """
    Mark order as shipped — updates tracking info and notifies customer.

    Accepts carrier name (우체국, CJ대한통운, etc.) and tracking number.
    Updates both the Shipping record and the SalesOrder.
    """
    order = await _get_order(db, order_id, farmer, for_update=True)

    if order.status not in ("paid", "confirmed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_STATUS",
                "message": (
                    "'paid' 또는 'confirmed' 상태의 주문만 발송할 수 있습니다 "
                    f"(현재: {order.status})"
                ),
            },
        )

    # Direct checkout creates Shipping up front. Manual orders create it here,
    # after the farmer has confirmed the order and is ready to dispatch it.
    ship_result = await db.execute(
        select(Shipping).where(Shipping.order_id == order.id)
    )
    shipping = ship_result.scalar_one_or_none()
    if shipping is None:
        if not (
            order.customer_name
            and order.customer_phone
            and order.customer_address
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "SHIPPING_INFO_REQUIRED",
                    "message": "수령인 이름, 연락처, 주소를 먼저 입력해주세요",
                },
            )
        shipping = Shipping(
            order_id=order.id,
            recipient_name=order.customer_name,
            recipient_phone=order.customer_phone,
            address=order.customer_address,
        )
        db.add(shipping)

    now = datetime.now(UTC)
    order.status = "shipped"
    order.tracking_number = tracking_number
    order.shipped_at = now
    shipping.carrier = carrier
    shipping.tracking_number = tracking_number
    shipping.shipped_at = now

    await db.commit()
    await db.refresh(order)

    logger.info(
        "Order shipped: order=%s, carrier=%s, tracking=%s",
        order.id,
        carrier,
        tracking_number,
    )
    return _order_to_response(order)


@router.put("/{order_id}/deliver", response_model=OrderResponse)
async def deliver_order(
    order_id: str,
    farmer: Farmer = Depends(get_current_admin_farmer),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    """
    Mark order as delivered — auto-creates income transaction in the financial ledger.

    This is the Phase 3 ↔ Phase 4 integration point: delivery triggers
    automatic income recording so the farmer's P&L stays up to date.
    """
    order = await _get_order(db, order_id, farmer, for_update=True)

    if order.status != "shipped":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_STATUS",
                "message": (
                    "'shipped' 상태의 주문만 배송완료할 수 있습니다 "
                    f"(현재: {order.status})"
                ),
            },
        )

    now = datetime.now(UTC)
    order.status = "delivered"
    order.delivered_at = now

    # Update Shipping record
    ship_result = await db.execute(
        select(Shipping).where(Shipping.order_id == order.id)
    )
    shipping = ship_result.scalar_one_or_none()
    if shipping:
        shipping.delivered_at = now

    # Auto-create income transaction (Phase 3 integration)
    await create_income_from_delivery(db, order, farmer.id)
    # Direct checkout customers are already counted at payment confirmation.
    # Manual phone/Kakao/offline orders are counted only after fulfilment.
    await record_manual_order_delivery(db, order, completed_at=now)

    await db.commit()
    await db.refresh(order)

    logger.info("Order delivered: order=%s, income transaction auto-created", order.id)
    return _order_to_response(order)


@router.put("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: str,
    reason: str = Query("고객 요청에 의한 취소", description="Cancellation reason"),
    farmer: Farmer = Depends(get_current_admin_farmer),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    """
    Cancel order and trigger refund if payment was confirmed.

    Calls TossPayments cancel API for paid orders. Unpaid orders
    are cancelled without refund processing.
    """
    order = await _get_order(db, order_id, farmer, for_update=True)

    if order.status in ("delivered", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_STATUS",
                "message": f"'{order.status}' 상태의 주문은 취소할 수 없습니다",
            },
        )

    # Check for associated payment
    pay_result = await db.execute(
        select(Payment).where(Payment.order_id == order.id)
    )
    payment = pay_result.scalar_one_or_none()

    if payment and payment.status == "confirmed":
        # Refund via Toss
        toss = TossProvider()
        try:
            await cancel_payment(db, payment, reason, toss)
        except TossPaymentError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": e.code, "message": f"환불 처리 실패: {e.message}"},
            )
    else:
        # No payment or not confirmed — just cancel the order
        order.status = "cancelled"
        await db.commit()
        await db.refresh(order)

    return _order_to_response(order)


# --- Customer Analytics ---


@router.get("/customers", response_model=CustomerListResponse)
async def list_customers(
    farmer: Farmer = Depends(get_current_admin_farmer),
    db: AsyncSession = Depends(get_db),
) -> CustomerListResponse:
    """Customer list with pre-computed analytics — sorted by total spent."""
    farm_id = _require_farm_id(farmer)

    result = await db.execute(
        select(Customer)
        .where(Customer.farm_id == farm_id)
        .order_by(Customer.total_spent.desc())
    )
    customers = result.scalars().all()

    total = await db.execute(
        select(func.count(Customer.id)).where(Customer.farm_id == farm_id)
    )

    return CustomerListResponse(
        customers=[_customer_to_response(c) for c in customers],
        total=total.scalar() or 0,
    )


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    farmer: Farmer = Depends(get_current_admin_farmer),
    db: AsyncSession = Depends(get_db),
) -> CustomerResponse:
    """Customer detail with order history stats."""
    farm_id = _require_farm_id(farmer)

    result = await db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.farm_id == farm_id,
        )
    )
    customer = result.scalar_one_or_none()

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "고객 정보를 찾을 수 없습니다"},
        )

    return _customer_to_response(customer)


# --- Helpers ---


async def _get_order(
    db: AsyncSession,
    order_id: str,
    farmer: Farmer,
    *,
    for_update: bool = False,
) -> SalesOrder:
    """Fetch an order by ID, scoped to the farmer's farm."""
    farm_id = _require_farm_id(farmer)
    query = select(SalesOrder).where(
        SalesOrder.id == order_id,
        SalesOrder.farm_id == farm_id,
    )
    if for_update:
        query = query.with_for_update()
    result = await db.execute(query)
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "주문을 찾을 수 없습니다"},
        )
    return order


def _order_to_response(order: SalesOrder) -> OrderResponse:
    """Convert SalesOrder ORM object to response schema."""
    return OrderResponse(
        id=str(order.id),
        channel=order.channel,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        customer_address=order.customer_address,
        product_id=str(order.product_id) if order.product_id else None,
        product_name=order.product_name,
        quantity=order.quantity,
        weight_option=order.weight_option,
        unit_price=order.unit_price,
        total_amount=order.total_amount,
        status=order.status,
        tracking_number=order.tracking_number,
        shipped_at=order.shipped_at,
        delivered_at=order.delivered_at,
        transaction_id=str(order.transaction_id) if order.transaction_id else None,
        notes=order.notes,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


def _customer_to_response(customer: Customer) -> CustomerResponse:
    """Convert Customer ORM object to response schema."""
    return CustomerResponse(
        id=str(customer.id),
        phone=customer.phone,
        name=customer.name,
        address=customer.address,
        total_orders=customer.total_orders,
        total_spent=int(customer.total_spent),
        first_order_at=customer.first_order_at,
        last_order_at=customer.last_order_at,
        preferred_products=customer.preferred_products or [],
        notes=customer.notes,
        created_at=customer.created_at,
    )
