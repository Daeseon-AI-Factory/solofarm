"""Focused API tests for manually recording an admin order."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.api.v1.endpoints import admin_orders
from app.models.customer import Customer
from app.models.sales_order import SalesOrder
from app.models.shipping import Shipping
from app.modules.orders.customer_flow import (
    ensure_customer_identity,
    record_manual_order_delivery,
)
from app.schemas.sales_order import ManualOrderCreate


def _payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "channel": "phone",
        "customer_name": "김사과",
        "customer_phone": "010-1234-5678",
        "customer_address": "경상남도 사천시 테스트길 1",
        "product_name": "빈조농장 부사",
        "quantity": 2,
        "weight_option": "5kg",
        "unit_price": 30_000,
        # A manual discount makes this intentionally differ from quantity * unit_price.
        "total_amount": 55_000,
        "notes": "전화 주문, 경비실 보관",
    }
    payload.update(overrides)
    return payload


def _recording_db() -> tuple[SimpleNamespace, list[object]]:
    added: list[object] = []
    now = datetime(2026, 7, 14, tzinfo=UTC)

    def add(instance: object) -> None:
        if isinstance(instance, SalesOrder):
            # SQLAlchemy and PostgreSQL populate these during a real flush/refresh.
            instance.id = uuid4()
            instance.created_at = now
            instance.updated_at = now
        added.append(instance)

    return (
        SimpleNamespace(
            add=MagicMock(side_effect=add),
            execute=AsyncMock(return_value=_result(None)),
            commit=AsyncMock(),
            refresh=AsyncMock(),
        ),
        added,
    )


def _stored_order(order_status: str) -> SalesOrder:
    now = datetime(2026, 7, 14, tzinfo=UTC)
    order = SalesOrder(
        farm_id=uuid4(),
        channel="phone",
        customer_name="김사과",
        customer_phone="010-1234-5678",
        customer_address="경상남도 사천시 테스트길 1",
        product_name="빈조농장 부사",
        quantity=2,
        weight_option="5kg",
        unit_price=Decimal(30_000),
        total_amount=Decimal(55_000),
        notes="전화 주문",
        status=order_status,
    )
    order.id = uuid4()
    order.created_at = now
    order.updated_at = now
    order.transaction_id = None
    order.tracking_number = None
    order.shipped_at = None
    order.delivered_at = None
    return order


def _result(value: object | None) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


@pytest.mark.parametrize("channel", ["kakao", "phone", "offline"])
def test_manual_order_schema_accepts_supported_channels(channel: str) -> None:
    body = ManualOrderCreate.model_validate(_payload(channel=channel))

    assert body.channel == channel


@pytest.mark.parametrize(
    ("field", "invalid_value"),
    [
        ("channel", "naver"),
        ("customer_name", "   "),
        ("customer_phone", ""),
        ("customer_address", "\t"),
        ("product_name", " "),
        ("weight_option", ""),
        ("quantity", 0),
        ("unit_price", 0),
        ("total_amount", -1),
    ],
)
def test_manual_order_schema_rejects_invalid_operational_values(
    field: str,
    invalid_value: object,
) -> None:
    with pytest.raises(ValidationError) as exc_info:
        ManualOrderCreate.model_validate(_payload(**{field: invalid_value}))

    assert field in {str(error["loc"][-1]) for error in exc_info.value.errors()}


@pytest.mark.parametrize(
    ("field", "invalid_value"),
    [
        ("customer_name", "가" * 101),
        ("customer_phone", "1" * 21),
        ("product_name", "사" * 101),
        ("weight_option", "대" * 51),
    ],
)
def test_manual_order_schema_respects_sales_order_column_lengths(
    field: str,
    invalid_value: str,
) -> None:
    with pytest.raises(ValidationError) as exc_info:
        ManualOrderCreate.model_validate(_payload(**{field: invalid_value}))

    assert field in {str(error["loc"][-1]) for error in exc_info.value.errors()}


@pytest.mark.asyncio
async def test_post_manual_order_records_one_confirmed_order_for_admin_farm() -> None:
    db, added = _recording_db()
    farmer = SimpleNamespace(id=uuid4(), farm_id=uuid4(), role="admin")
    app = FastAPI()
    app.include_router(admin_orders.router, prefix="/admin/orders")

    async def override_db() -> AsyncIterator[SimpleNamespace]:
        yield db

    async def override_farmer() -> SimpleNamespace:
        return farmer

    app.dependency_overrides[admin_orders.get_db] = override_db
    app.dependency_overrides[admin_orders.get_current_admin_farmer] = override_farmer

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/admin/orders", json=_payload())

    assert response.status_code == 201
    assert len(added) == 2
    order = next(instance for instance in added if isinstance(instance, SalesOrder))
    customer = next(instance for instance in added if isinstance(instance, Customer))
    assert isinstance(order, SalesOrder)
    assert order.farm_id == farmer.farm_id
    assert order.farm_id != farmer.id
    assert order.status == "confirmed"
    assert order.channel == "phone"
    assert order.customer_name == "김사과"
    assert order.customer_phone == "010-1234-5678"
    assert order.customer_address == "경상남도 사천시 테스트길 1"
    assert order.product_name == "빈조농장 부사"
    assert order.quantity == 2
    assert order.weight_option == "5kg"
    assert order.unit_price == Decimal(30_000)
    # Preserve the operator-supplied total; manual discounts/shipping can differ.
    assert order.total_amount == Decimal(55_000)
    assert order.notes == "전화 주문, 경비실 보관"
    assert response.json()["customer_address"] == order.customer_address
    assert response.json()["status"] == "confirmed"
    assert customer.farm_id == farmer.farm_id
    assert customer.phone == order.customer_phone
    assert customer.name == order.customer_name
    assert customer.address == order.customer_address
    assert customer.total_orders == 0
    assert customer.total_spent == Decimal("0")
    assert customer.first_order_at is None
    assert customer.last_order_at is None
    assert customer.preferred_products == []
    # Decimal fields are encoded as strings by the existing response contract.
    assert Decimal(response.json()["total_amount"]) == Decimal(55_000)
    assert db.add.call_count == 2
    db.commit.assert_awaited_once_with()
    db.refresh.assert_awaited_once_with(order)


@pytest.mark.asyncio
async def test_manual_order_creation_rejects_unassigned_admin_before_db_write() -> None:
    db, added = _recording_db()
    farmer = SimpleNamespace(id=uuid4(), farm_id=None, role="admin")
    body = ManualOrderCreate.model_validate(_payload())

    with pytest.raises(HTTPException) as exc_info:
        await admin_orders.create_manual_order(body, farmer, db)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["code"] == "FARM_NOT_ASSIGNED"
    assert added == []
    db.add.assert_not_called()
    db.commit.assert_not_awaited()
    db.refresh.assert_not_awaited()


@pytest.mark.asyncio
async def test_confirmed_manual_order_can_ship_without_a_shipping_record() -> None:
    order = _stored_order("confirmed")
    farmer = SimpleNamespace(id=uuid4(), farm_id=order.farm_id, role="admin")
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[_result(order), _result(None)]),
        add=MagicMock(),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )

    response = await admin_orders.ship_order(
        str(order.id),
        carrier="우체국",
        tracking_number="1234567890",
        farmer=farmer,
        db=db,
    )

    assert response.status == "shipped"
    assert response.tracking_number == "1234567890"
    assert order.shipped_at is not None
    db.add.assert_called_once()
    shipping = db.add.call_args.args[0]
    assert isinstance(shipping, Shipping)
    assert shipping.order_id == order.id
    assert shipping.recipient_name == order.customer_name
    assert shipping.recipient_phone == order.customer_phone
    assert shipping.address == order.customer_address
    assert shipping.carrier == "우체국"
    assert shipping.tracking_number == "1234567890"
    assert shipping.shipped_at == order.shipped_at
    db.commit.assert_awaited_once_with()
    db.refresh.assert_awaited_once_with(order)


@pytest.mark.asyncio
async def test_shipped_manual_order_can_be_delivered(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    order = _stored_order("shipped")
    farmer = SimpleNamespace(id=uuid4(), farm_id=order.farm_id, role="admin")
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[_result(order), _result(None)]),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )
    record_income = AsyncMock()
    record_customer = AsyncMock()
    monkeypatch.setattr(admin_orders, "create_income_from_delivery", record_income)
    monkeypatch.setattr(
        admin_orders,
        "record_manual_order_delivery",
        record_customer,
    )

    response = await admin_orders.deliver_order(
        str(order.id),
        farmer=farmer,
        db=db,
    )

    assert response.status == "delivered"
    assert order.delivered_at is not None
    record_income.assert_awaited_once_with(db, order, farmer.id)
    record_customer.assert_awaited_once_with(
        db,
        order,
        completed_at=order.delivered_at,
    )
    db.commit.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_second_delivery_attempt_does_not_count_customer_twice(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    order = _stored_order("shipped")
    farmer = SimpleNamespace(id=uuid4(), farm_id=order.farm_id, role="admin")
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                _result(order),
                _result(None),
                _result(order),
            ]
        ),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )
    record_income = AsyncMock()
    record_customer = AsyncMock()
    monkeypatch.setattr(admin_orders, "create_income_from_delivery", record_income)
    monkeypatch.setattr(
        admin_orders,
        "record_manual_order_delivery",
        record_customer,
    )

    await admin_orders.deliver_order(str(order.id), farmer=farmer, db=db)

    with pytest.raises(HTTPException) as exc_info:
        await admin_orders.deliver_order(str(order.id), farmer=farmer, db=db)

    assert exc_info.value.status_code == 400
    assert order.status == "delivered"
    record_income.assert_awaited_once()
    record_customer.assert_awaited_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_cancelling_manual_order_does_not_claim_or_attempt_a_refund(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    order = _stored_order("confirmed")
    farmer = SimpleNamespace(id=uuid4(), farm_id=order.farm_id, role="admin")
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[_result(order), _result(None)]),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )
    toss_provider = MagicMock()
    refund = AsyncMock()
    monkeypatch.setattr(admin_orders, "TossProvider", toss_provider)
    monkeypatch.setattr(admin_orders, "cancel_payment", refund)

    response = await admin_orders.cancel_order(
        str(order.id),
        reason="전화 주문 취소",
        farmer=farmer,
        db=db,
    )

    assert response.status == "cancelled"
    toss_provider.assert_not_called()
    refund.assert_not_awaited()
    db.commit.assert_awaited_once_with()
    db.refresh.assert_awaited_once_with(order)


@pytest.mark.asyncio
async def test_existing_customer_identity_is_refreshed_without_inflating_stats() -> None:
    order = _stored_order("confirmed")
    customer = Customer(
        farm_id=order.farm_id,
        phone=order.customer_phone,
        name="이전 이름",
        address="이전 주소",
        total_orders=3,
        total_spent=Decimal(120_000),
        preferred_products=["홍로"],
    )
    db = SimpleNamespace(
        execute=AsyncMock(return_value=_result(customer)),
        add=MagicMock(),
    )

    resolved = await ensure_customer_identity(db, order)

    assert resolved is customer
    assert customer.name == order.customer_name
    assert customer.address == order.customer_address
    assert customer.total_orders == 3
    assert customer.total_spent == Decimal(120_000)
    assert customer.preferred_products == ["홍로"]
    db.add.assert_not_called()


@pytest.mark.parametrize("channel", ["phone", "kakao", "offline"])
@pytest.mark.asyncio
async def test_delivered_manual_order_updates_customer_analytics_once(
    channel: str,
) -> None:
    completed_at = datetime(2026, 7, 14, 18, 30, tzinfo=UTC)
    order = _stored_order("delivered")
    order.channel = channel
    customer = Customer(
        farm_id=order.farm_id,
        phone=order.customer_phone,
        name=order.customer_name,
        address=order.customer_address,
        total_orders=1,
        total_spent=Decimal(30_000),
        first_order_at=datetime(2026, 7, 1, tzinfo=UTC),
        last_order_at=datetime(2026, 7, 1, tzinfo=UTC),
        preferred_products=["홍로"],
    )
    db = SimpleNamespace(
        execute=AsyncMock(return_value=_result(customer)),
        add=MagicMock(),
    )

    resolved = await record_manual_order_delivery(
        db,
        order,
        completed_at=completed_at,
    )

    assert resolved is customer
    assert customer.total_orders == 2
    assert customer.total_spent == Decimal(85_000)
    assert customer.first_order_at == datetime(2026, 7, 1, tzinfo=UTC)
    assert customer.last_order_at == completed_at
    assert customer.preferred_products == ["홍로", "빈조농장 부사"]
    db.add.assert_not_called()


@pytest.mark.parametrize(
    ("channel", "order_status"),
    [
        ("direct", "delivered"),
        ("phone", "confirmed"),
        ("kakao", "cancelled"),
        ("offline", "shipped"),
    ],
)
@pytest.mark.asyncio
async def test_non_manual_or_not_delivered_order_does_not_inflate_customer_stats(
    channel: str,
    order_status: str,
) -> None:
    order = _stored_order(order_status)
    order.channel = channel
    db = SimpleNamespace(execute=AsyncMock(), add=MagicMock())

    resolved = await record_manual_order_delivery(db, order)

    assert resolved is None
    db.execute.assert_not_awaited()
    db.add.assert_not_called()
