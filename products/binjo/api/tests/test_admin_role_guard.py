"""Authorization tests for the FastAPI admin surface."""

from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from core.auth.jwt_handler import create_access_token
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1.endpoints import admin_orders
from app.database import get_db
from app.dependencies import get_current_admin_farmer


def _farmer_result(farmer: SimpleNamespace) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = farmer
    return result


def _orders_result() -> MagicMock:
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    return result


def _admin_app(db: SimpleNamespace) -> FastAPI:
    app = FastAPI()
    app.include_router(admin_orders.router, prefix="/admin/orders")

    async def override_db() -> AsyncIterator[SimpleNamespace]:
        yield db

    app.dependency_overrides[get_db] = override_db
    return app


def test_every_admin_order_route_uses_admin_role_dependency() -> None:
    for route in admin_orders.router.routes:
        dependency_calls = {
            dependency.call for dependency in route.dependant.dependencies
        }
        assert get_current_admin_farmer in dependency_calls, route.path


@pytest.mark.asyncio
async def test_farmer_jwt_cannot_access_admin_orders() -> None:
    farmer = SimpleNamespace(id=uuid4(), farm_id=uuid4(), role="farmer")
    db = SimpleNamespace(execute=AsyncMock(return_value=_farmer_result(farmer)))
    app = _admin_app(db)
    token = create_access_token(subject=str(farmer.id), role="farmer")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/admin/orders",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "ADMIN_REQUIRED"
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_admin_jwt_loads_subject_and_accesses_farm_scoped_orders() -> None:
    farmer = SimpleNamespace(id=uuid4(), farm_id=uuid4(), role="farmer")
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[_farmer_result(farmer), _orders_result()])
    )
    app = _admin_app(db)
    token = create_access_token(subject=str(farmer.id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/admin/orders",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json() == []
    assert db.execute.await_count == 2

    identity_query = db.execute.await_args_list[0].args[0]
    identity_values = set(identity_query.compile().params.values())
    assert str(farmer.id) in identity_values

    orders_query = db.execute.await_args_list[1].args[0]
    order_values = set(orders_query.compile().params.values())
    assert farmer.farm_id in order_values
    assert farmer.id not in order_values
