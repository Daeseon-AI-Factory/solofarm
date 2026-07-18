"""Focused tests for assigning and enforcing the single-farm identity."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.api.v1.endpoints import admin_orders
from app.api.v1.endpoints import auth as auth_endpoint
from app.config import settings
from app.schemas.auth import DevLoginRequest, KakaoCallbackRequest
from app.services.farm_identity import (
    SingleFarmResolutionError,
    resolve_single_farm_id,
)


def _query_result(values: list[object]) -> MagicMock:
    result = MagicMock()
    result.scalars.return_value.all.return_value = values
    return result


def _request() -> Request:
    return Request({"type": "http", "client": ("127.0.0.1", 12345), "headers": []})


@pytest.mark.asyncio
async def test_single_farm_resolver_returns_the_only_farm() -> None:
    farm_id = uuid4()
    db = SimpleNamespace(execute=AsyncMock(return_value=_query_result([farm_id])))

    assert await resolve_single_farm_id(db) == farm_id


@pytest.mark.asyncio
@pytest.mark.parametrize("farm_ids", [[], [uuid4(), uuid4()]])
async def test_single_farm_resolver_refuses_missing_or_ambiguous_farms(
    farm_ids: list[object],
) -> None:
    db = SimpleNamespace(execute=AsyncMock(return_value=_query_result(farm_ids)))

    with pytest.raises(SingleFarmResolutionError):
        await resolve_single_farm_id(db)


@pytest.mark.asyncio
async def test_new_dev_farmer_is_assigned_to_the_single_farm(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "enable_dev_login", True)
    monkeypatch.setattr(settings, "dev_login_access_code", "correct-code-123456")
    farm_id = uuid4()
    monkeypatch.setattr(
        auth_endpoint,
        "resolve_single_farm_id",
        AsyncMock(return_value=farm_id),
    )
    monkeypatch.setattr(auth_endpoint, "create_access_token", lambda **_: "test-token")
    db = SimpleNamespace(
        execute=AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None)),
        add=MagicMock(),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )

    response = await auth_endpoint.dev_login(
        DevLoginRequest(access_code="correct-code-123456"),
        _request(),
        db,
    )

    created_farmer = db.add.call_args.args[0]
    assert created_farmer.farm_id == farm_id
    assert response.access_token == "test-token"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_existing_unassigned_dev_farmer_is_repaired_before_login(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "enable_dev_login", True)
    monkeypatch.setattr(settings, "dev_login_access_code", "correct-code-123456")
    farm_id = uuid4()
    farmer = SimpleNamespace(
        id=uuid4(),
        farm_id=None,
        role="farmer",
        nickname="빈조농장",
    )
    result = MagicMock()
    result.scalar_one_or_none.return_value = farmer
    monkeypatch.setattr(
        auth_endpoint,
        "resolve_single_farm_id",
        AsyncMock(return_value=farm_id),
    )
    monkeypatch.setattr(auth_endpoint, "create_access_token", lambda **_: "test-token")
    db = SimpleNamespace(
        execute=AsyncMock(return_value=result),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )

    await auth_endpoint.dev_login(
        DevLoginRequest(access_code="correct-code-123456"),
        _request(),
        db,
    )

    assert farmer.farm_id == farm_id
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(farmer)


@pytest.mark.asyncio
async def test_new_kakao_farmer_is_assigned_to_the_single_farm(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    farm_id = uuid4()
    monkeypatch.setattr(
        auth_endpoint,
        "exchange_code_for_token",
        AsyncMock(return_value={"access_token": "kakao-token"}),
    )
    monkeypatch.setattr(
        auth_endpoint,
        "get_kakao_user_profile",
        AsyncMock(
            return_value={
                "kakao_id": "kakao-1",
                "nickname": "농장주",
                "profile_image_url": None,
            }
        ),
    )
    monkeypatch.setattr(
        auth_endpoint,
        "resolve_single_farm_id",
        AsyncMock(return_value=farm_id),
    )
    monkeypatch.setattr(auth_endpoint, "create_access_token", lambda **_: "test-token")
    db = SimpleNamespace(
        execute=AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None)),
        add=MagicMock(),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )

    await auth_endpoint.kakao_callback(KakaoCallbackRequest(code="callback-code"), db)

    created_farmer = db.add.call_args.args[0]
    assert created_farmer.farm_id == farm_id
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_dev_login_surfaces_ambiguous_farm_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "enable_dev_login", True)
    monkeypatch.setattr(settings, "dev_login_access_code", "correct-code-123456")
    monkeypatch.setattr(
        auth_endpoint,
        "resolve_single_farm_id",
        AsyncMock(side_effect=SingleFarmResolutionError(2)),
    )
    db = SimpleNamespace(
        execute=AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None)),
        add=MagicMock(),
        commit=AsyncMock(),
    )

    with pytest.raises(HTTPException) as exc_info:
        await auth_endpoint.dev_login(
            DevLoginRequest(access_code="correct-code-123456"),
            _request(),
            db,
        )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "FARM_CONFIGURATION_ERROR"
    db.add.assert_not_called()
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "operation",
    ["list_orders", "list_customers", "get_customer", "get_order"],
)
async def test_admin_order_and_customer_operations_reject_unscoped_farmer(
    operation: str,
) -> None:
    farmer = SimpleNamespace(id=uuid4(), farm_id=None)
    db = SimpleNamespace(execute=AsyncMock())

    with pytest.raises(HTTPException) as exc_info:
        if operation == "list_orders":
            await admin_orders.list_admin_orders(None, None, farmer, db)
        elif operation == "list_customers":
            await admin_orders.list_customers(farmer, db)
        elif operation == "get_customer":
            await admin_orders.get_customer(str(uuid4()), farmer, db)
        else:
            await admin_orders._get_order(db, str(uuid4()), farmer)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["code"] == "FARM_NOT_ASSIGNED"
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_admin_order_query_uses_farm_id_not_farmer_id() -> None:
    farmer = SimpleNamespace(id=uuid4(), farm_id=uuid4())
    db = SimpleNamespace(execute=AsyncMock(return_value=_query_result([])))

    assert await admin_orders.list_admin_orders(None, None, farmer, db) == []

    query = db.execute.await_args.args[0]
    parameter_values = set(query.compile().params.values())
    assert farmer.farm_id in parameter_values
    assert farmer.id not in parameter_values
