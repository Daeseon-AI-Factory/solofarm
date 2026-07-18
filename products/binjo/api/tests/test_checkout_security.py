"""Security-focused tests for public checkout catalog authority."""

from collections.abc import AsyncIterator
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.api.v1.endpoints import payments as payments_endpoint
from app.models.payment import Payment
from app.models.sales_order import SalesOrder
from app.models.shipping import Shipping
from app.modules.orders.checkout import create_checkout
from app.schemas.payment import CheckoutRequest

PRODUCT_ID = UUID("11111111-1111-4111-8111-111111111111")
FARM_ID = UUID("22222222-2222-4222-8222-222222222222")


def _request(**overrides: object) -> CheckoutRequest:
    data: dict[str, object] = {
        "product_id": PRODUCT_ID,
        "quantity": 1,
        "weight_option": "5kg (16-18과)",
        "recipient_name": "테스트 고객",
        "recipient_phone": "010-1234-5678",
        "postal_code": "12345",
        "address": "경상남도 사천시 테스트길 1",
        "address_detail": "101호",
        "delivery_message": "문 앞에 놓아주세요",
    }
    data.update(overrides)
    return CheckoutRequest.model_validate(data)


def _product(
    *,
    is_available: bool = True,
    price_options: object | None = None,
) -> dict[str, object]:
    return {
        "id": PRODUCT_ID,
        "name": "부사",
        "is_available": is_available,
        "price_options": price_options
        if price_options is not None
        else [
            {"weight": "5kg (16-18과)", "price": 35_000},
            {"weight": "10kg (32-36과)", "price": 60_000},
        ],
    }


def _db_with_product(
    product: dict[str, object] | None,
) -> tuple[SimpleNamespace, list[object], UUID]:
    mapping_result = MagicMock()
    mapping_result.one_or_none.return_value = product
    query_result = MagicMock()
    query_result.mappings.return_value = mapping_result

    added: list[object] = []
    order_id = uuid4()

    def add(instance: object) -> None:
        # SQLAlchemy assigns UUID defaults during a real flush. Assign one here
        # so the unit test can inspect the dependent shipping/payment records.
        if isinstance(instance, SalesOrder):
            instance.id = order_id
        added.append(instance)

    db = SimpleNamespace(
        execute=AsyncMock(return_value=query_result),
        add=MagicMock(side_effect=add),
        flush=AsyncMock(),
        commit=AsyncMock(),
    )
    return db, added, order_id


def test_checkout_request_rejects_client_controlled_name_and_prices() -> None:
    """Legacy price fields fail validation instead of influencing checkout."""
    with pytest.raises(ValidationError) as exc_info:
        _request(
            product_name="공격자가 바꾼 상품명",
            unit_price=1,
            total_amount=1,
        )

    rejected_fields = {error["loc"][-1] for error in exc_info.value.errors()}
    assert rejected_fields == {"product_name", "unit_price", "total_amount"}
    assert all(error["type"] == "extra_forbidden" for error in exc_info.value.errors())


@pytest.mark.parametrize("product_id", [None, "not-a-uuid"])
def test_checkout_request_requires_a_product_uuid(product_id: object) -> None:
    with pytest.raises(ValidationError):
        _request(product_id=product_id)


@pytest.mark.parametrize("quantity", [0, 21])
def test_checkout_request_rejects_unreasonable_quantity(quantity: int) -> None:
    with pytest.raises(ValidationError):
        _request(quantity=quantity)


@pytest.mark.asyncio
async def test_checkout_http_boundary_rejects_price_tampering() -> None:
    """The public endpoint returns 422 before any product or order DB work."""
    db, _, _ = _db_with_product(_product())
    app = FastAPI()
    app.include_router(payments_endpoint.router, prefix="/payments")

    async def override_db() -> AsyncIterator[SimpleNamespace]:
        yield db

    app.dependency_overrides[payments_endpoint.get_db] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/payments/checkout",
            json={
                "product_id": str(PRODUCT_ID),
                "product_name": "변조 상품",
                "quantity": 1,
                "weight_option": "5kg (16-18과)",
                "unit_price": 1,
                "total_amount": 1,
                "recipient_name": "테스트 고객",
                "recipient_phone": "010-1234-5678",
                "address": "경상남도 사천시 테스트길 1",
            },
        )

    assert response.status_code == 422
    rejected_fields = {error["loc"][-1] for error in response.json()["detail"]}
    assert rejected_fields == {"product_name", "unit_price", "total_amount"}
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_checkout_http_boundary_is_closed_when_feature_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The backend gate prevents direct callers from bypassing the hidden UI."""
    db, _, _ = _db_with_product(_product())
    app = FastAPI()
    app.include_router(payments_endpoint.router, prefix="/payments")

    async def override_db() -> AsyncIterator[SimpleNamespace]:
        yield db

    monkeypatch.setattr(payments_endpoint.settings, "enable_direct_checkout", False)
    app.dependency_overrides[payments_endpoint.get_db] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/payments/checkout",
            json=_request().model_dump(mode="json"),
        )

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "CHECKOUT_UNAVAILABLE"
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("path", "payload"),
    [
        (
            "/payments/confirm",
            {"payment_key": "test-key", "order_id": "test-order", "amount": 1},
        ),
        ("/payments/webhook", {"eventType": "PAYMENT_STATUS_CHANGED"}),
    ],
)
async def test_payment_mutations_are_closed_when_checkout_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    payload: dict[str, object],
) -> None:
    db, _, _ = _db_with_product(_product())
    app = FastAPI()
    app.include_router(payments_endpoint.router, prefix="/payments")

    async def override_db() -> AsyncIterator[SimpleNamespace]:
        yield db

    monkeypatch.setattr(payments_endpoint.settings, "enable_direct_checkout", False)
    app.dependency_overrides[payments_endpoint.get_db] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(path, json=payload)

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "CHECKOUT_UNAVAILABLE"
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_checkout_rejects_unknown_product_with_safe_error() -> None:
    db, added, _ = _db_with_product(None)

    with pytest.raises(HTTPException) as exc_info:
        await create_checkout(db, _request(), FARM_ID)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {
        "code": "PRODUCT_NOT_FOUND",
        "message": "상품을 찾을 수 없습니다",
    }
    assert added == []
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_checkout_rejects_unavailable_product() -> None:
    db, added, _ = _db_with_product(_product(is_available=False))

    with pytest.raises(HTTPException) as exc_info:
        await create_checkout(db, _request(), FARM_ID)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["code"] == "PRODUCT_UNAVAILABLE"
    assert added == []
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_checkout_requires_an_exact_catalog_option() -> None:
    db, added, _ = _db_with_product(_product())

    with pytest.raises(HTTPException) as exc_info:
        await create_checkout(
            db,
            _request(weight_option="5kg"),
            FARM_ID,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INVALID_WEIGHT_OPTION"
    assert added == []
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_checkout_calculates_and_stores_catalog_price_server_side() -> None:
    db, added, order_id = _db_with_product(_product())
    body = _request(quantity=3)

    response = await create_checkout(db, body, FARM_ID)

    order = next(instance for instance in added if isinstance(instance, SalesOrder))
    shipping = next(instance for instance in added if isinstance(instance, Shipping))
    payment = next(instance for instance in added if isinstance(instance, Payment))

    assert order.product_id == PRODUCT_ID
    assert order.product_name == "부사"
    assert order.unit_price == Decimal(35_000)
    assert order.total_amount == Decimal(105_000)
    assert payment.amount == Decimal(105_000)
    assert payment.order_id == order_id
    assert shipping.order_id == order_id
    assert response.amount == 105_000
    assert response.product_name == "부사"
    assert response.order_id == str(order_id)
    db.execute.assert_awaited_once()
    query_parameters = db.execute.await_args.args[1]
    assert query_parameters == {"product_id": PRODUCT_ID, "farm_id": FARM_ID}
    db.flush.assert_awaited_once_with()
    db.commit.assert_awaited_once_with()
