"""
Sales order CRUD endpoints — manage orders from inquiry to delivery.

When an order is marked as shipped or delivered, the system can auto-create
an income transaction. The full state machine logic lives in
app/modules/bookkeeping/order_flow.py (Sprint 4).
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_farmer
from app.models.farmer import Farmer
from app.models.sales_order import SalesOrder
from app.schemas.sales_order import (
    SalesOrderCreate,
    SalesOrderListResponse,
    SalesOrderResponse,
    SalesOrderUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Valid status transitions — enforced to prevent invalid state jumps
VALID_TRANSITIONS: dict[str, set[str]] = {
    "inquiry": {"confirmed", "cancelled"},
    "confirmed": {"paid", "cancelled"},
    "paid": {"shipped", "cancelled"},
    "shipped": {"delivered", "cancelled"},
    "delivered": set(),  # Terminal state
    "cancelled": set(),  # Terminal state
}


def _order_to_response(order: SalesOrder) -> SalesOrderResponse:
    """Convert a SalesOrder ORM object to a Pydantic response."""
    return SalesOrderResponse(
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


@router.get("", response_model=SalesOrderListResponse)
async def list_orders(
    order_status: str | None = Query(None, alias="status"),
    channel: str | None = Query(None),
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> SalesOrderListResponse:
    """List orders with optional status/channel filter."""
    farm_id = farmer.farm_id or farmer.id

    query = (
        select(SalesOrder)
        .where(SalesOrder.farm_id == farm_id)
        .order_by(SalesOrder.created_at.desc())
    )
    count_query = (
        select(func.count(SalesOrder.id))
        .where(SalesOrder.farm_id == farm_id)
    )

    if order_status:
        query = query.where(SalesOrder.status == order_status)
        count_query = count_query.where(SalesOrder.status == order_status)
    if channel:
        query = query.where(SalesOrder.channel == channel)
        count_query = count_query.where(SalesOrder.channel == channel)

    result = await db.execute(query)
    orders = result.scalars().all()
    total = (await db.execute(count_query)).scalar() or 0

    return SalesOrderListResponse(
        orders=[_order_to_response(o) for o in orders],
        total=total,
    )


@router.post("", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: SalesOrderCreate,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> SalesOrderResponse:
    """Create a new sales order — typically from a KakaoTalk inquiry."""
    from uuid import UUID

    order = SalesOrder(
        farm_id=farmer.farm_id or farmer.id,
        channel=body.channel,
        customer_name=body.customer_name,
        customer_phone=body.customer_phone,
        customer_address=body.customer_address,
        product_id=UUID(body.product_id) if body.product_id else None,
        product_name=body.product_name,
        quantity=body.quantity,
        weight_option=body.weight_option,
        unit_price=body.unit_price,
        total_amount=body.total_amount,
        notes=body.notes,
        status="inquiry",
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    return _order_to_response(order)


@router.get("/{order_id}", response_model=SalesOrderResponse)
async def get_order(
    order_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> SalesOrderResponse:
    """Get a single order by ID."""
    farm_id = farmer.farm_id or farmer.id
    result = await db.execute(
        select(SalesOrder).where(
            SalesOrder.id == order_id,
            SalesOrder.farm_id == farm_id,
        )
    )
    order = result.scalar_one_or_none()

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "주문을 찾을 수 없습니다"},
        )

    return _order_to_response(order)


@router.put("/{order_id}", response_model=SalesOrderResponse)
async def update_order(
    order_id: str,
    body: SalesOrderUpdate,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> SalesOrderResponse:
    """Update an order — edit details or advance status."""
    farm_id = farmer.farm_id or farmer.id
    result = await db.execute(
        select(SalesOrder).where(
            SalesOrder.id == order_id,
            SalesOrder.farm_id == farm_id,
        )
    )
    order = result.scalar_one_or_none()

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "주문을 찾을 수 없습니다"},
        )

    # Validate status transition if status is being changed
    if body.status is not None and body.status != order.status:
        allowed = VALID_TRANSITIONS.get(order.status, set())
        if body.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_STATUS_TRANSITION",
                    "message": f"'{order.status}'에서 '{body.status}'(으)로 변경할 수 없습니다",
                },
            )
        order.status = body.status

    # Update provided fields
    if body.customer_name is not None:
        order.customer_name = body.customer_name
    if body.customer_phone is not None:
        order.customer_phone = body.customer_phone
    if body.customer_address is not None:
        order.customer_address = body.customer_address
    if body.product_name is not None:
        order.product_name = body.product_name
    if body.quantity is not None:
        order.quantity = body.quantity
    if body.weight_option is not None:
        order.weight_option = body.weight_option
    if body.unit_price is not None:
        order.unit_price = body.unit_price
    if body.total_amount is not None:
        order.total_amount = body.total_amount
    if body.tracking_number is not None:
        order.tracking_number = body.tracking_number
    if body.notes is not None:
        order.notes = body.notes

    await db.commit()
    await db.refresh(order)

    return _order_to_response(order)


@router.put("/{order_id}/ship", response_model=SalesOrderResponse)
async def ship_order(
    order_id: str,
    tracking_number: str | None = Query(None),
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> SalesOrderResponse:
    """Mark an order as shipped — requires 'paid' status."""
    farm_id = farmer.farm_id or farmer.id
    result = await db.execute(
        select(SalesOrder).where(
            SalesOrder.id == order_id,
            SalesOrder.farm_id == farm_id,
        )
    )
    order = result.scalar_one_or_none()

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "주문을 찾을 수 없습니다"},
        )

    if order.status != "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_STATUS", "message": "결제 완료된 주문만 발송할 수 있습니다"},
        )

    order.status = "shipped"
    order.shipped_at = datetime.now(timezone.utc)
    if tracking_number:
        order.tracking_number = tracking_number

    await db.commit()
    await db.refresh(order)

    return _order_to_response(order)


@router.put("/{order_id}/deliver", response_model=SalesOrderResponse)
async def deliver_order(
    order_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> SalesOrderResponse:
    """
    Mark an order as delivered — requires 'shipped' status.

    In Sprint 4, this will also auto-create an income transaction
    via the order_flow module. For now, just updates the status.
    """
    farm_id = farmer.farm_id or farmer.id
    result = await db.execute(
        select(SalesOrder).where(
            SalesOrder.id == order_id,
            SalesOrder.farm_id == farm_id,
        )
    )
    order = result.scalar_one_or_none()

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "주문을 찾을 수 없습니다"},
        )

    if order.status != "shipped":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_STATUS", "message": "발송된 주문만 배송완료 처리할 수 있습니다"},
        )

    order.status = "delivered"
    order.delivered_at = datetime.now(timezone.utc)

    # Auto-create income transaction — revenue recorded automatically
    from app.modules.bookkeeping.order_flow import create_income_from_delivery
    await create_income_from_delivery(db, order, farmer.id)

    await db.commit()
    await db.refresh(order)

    return _order_to_response(order)
