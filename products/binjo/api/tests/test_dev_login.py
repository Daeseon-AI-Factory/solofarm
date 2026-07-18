"""Unit tests for the temporary app-level farmer access gate."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request

from app.api.v1.endpoints import auth as auth_endpoint
from app.config import settings
from app.schemas.auth import DevLoginRequest


def _request(client: str = "127.0.0.1", forwarded_for: str | None = None) -> Request:
    headers = []
    if forwarded_for:
        headers.append((b"x-forwarded-for", forwarded_for.encode("ascii")))
    return Request({"type": "http", "client": (client, 12345), "headers": headers})


@pytest.fixture(autouse=True)
def _reset_dev_login_failures() -> None:
    auth_endpoint._dev_login_failures.clear()


@pytest.mark.asyncio
async def test_dev_login_is_hidden_when_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "enable_dev_login", False)
    db = SimpleNamespace(execute=AsyncMock())

    with pytest.raises(HTTPException) as exc_info:
        await auth_endpoint.dev_login(
            DevLoginRequest(access_code="anything-long-enough"),
            _request(),
            db,
        )

    assert exc_info.value.status_code == 404
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_dev_login_rejects_an_invalid_access_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "enable_dev_login", True)
    monkeypatch.setattr(settings, "dev_login_access_code", "correct-code-123456")
    db = SimpleNamespace(execute=AsyncMock())

    with pytest.raises(HTTPException) as exc_info:
        await auth_endpoint.dev_login(
            DevLoginRequest(access_code="wrong-code-1234567"),
            _request(),
            db,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "INVALID_ACCESS_CODE"
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_dev_login_rejects_a_non_ascii_access_code_without_server_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "enable_dev_login", True)
    monkeypatch.setattr(settings, "dev_login_access_code", "correct-code-123456")
    db = SimpleNamespace(execute=AsyncMock())

    with pytest.raises(HTTPException) as exc_info:
        await auth_endpoint.dev_login(
            DevLoginRequest(access_code="잘못된-접근-코드-테스트-입니다"),
            _request(),
            db,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "INVALID_ACCESS_CODE"
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_dev_login_accepts_the_configured_access_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "enable_dev_login", True)
    monkeypatch.setattr(settings, "dev_login_access_code", "correct-code-123456")
    farmer = SimpleNamespace(
        id=uuid4(),
        farm_id=uuid4(),
        role="farmer",
        nickname="빈조농장",
    )
    result = MagicMock()
    result.scalar_one_or_none.return_value = farmer
    db = SimpleNamespace(execute=AsyncMock(return_value=result))
    monkeypatch.setattr(auth_endpoint, "create_access_token", lambda **_: "test-token")

    response = await auth_endpoint.dev_login(
        DevLoginRequest(access_code="correct-code-123456", nickname="빈조농장"),
        _request(),
        db,
    )

    assert response.access_token == "test-token"
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_dev_login_rate_limits_repeated_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "enable_dev_login", True)
    monkeypatch.setattr(settings, "dev_login_access_code", "correct-code-123456")
    db = SimpleNamespace(execute=AsyncMock())
    request = _request("192.0.2.10")

    for _ in range(auth_endpoint.DEV_LOGIN_ATTEMPT_LIMIT):
        with pytest.raises(HTTPException) as exc_info:
            await auth_endpoint.dev_login(
                DevLoginRequest(access_code="wrong-code-1234567"),
                request,
                db,
            )
        assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException) as exc_info:
        await auth_endpoint.dev_login(
            DevLoginRequest(access_code="wrong-code-1234567"),
            request,
            db,
        )

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers == {"Retry-After": "300"}
    db.execute.assert_not_awaited()


def test_dev_login_rate_limit_uses_the_caddy_forwarded_client_address() -> None:
    request = _request("172.18.0.5", forwarded_for="203.0.113.7")

    assert auth_endpoint._dev_login_client_key(request) == "203.0.113.7"


@pytest.mark.asyncio
async def test_dev_login_http_boundary_validates_and_rejects_wrong_codes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "enable_dev_login", True)
    monkeypatch.setattr(settings, "dev_login_access_code", "correct-code-123456")
    app = FastAPI()
    app.include_router(auth_endpoint.router, prefix="/auth")

    async def override_db():
        yield SimpleNamespace(execute=AsyncMock())

    app.dependency_overrides[auth_endpoint.get_db] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        invalid_shape = await client.post(
            "/auth/dev-login",
            json={"access_code": "short"},
        )
        wrong_code = await client.post(
            "/auth/dev-login",
            json={"access_code": "wrong-code-1234567"},
        )

    assert invalid_shape.status_code == 422
    assert wrong_code.status_code == 401
    assert wrong_code.json()["detail"]["code"] == "INVALID_ACCESS_CODE"


@pytest.mark.asyncio
async def test_dev_login_forces_the_dedicated_account_back_to_farmer_role(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "enable_dev_login", True)
    monkeypatch.setattr(settings, "dev_login_access_code", "correct-code-123456")
    farmer = SimpleNamespace(
        id=uuid4(),
        farm_id=uuid4(),
        role="admin",
        nickname="old test name",
    )
    result = MagicMock()
    result.scalar_one_or_none.return_value = farmer
    db = SimpleNamespace(
        execute=AsyncMock(return_value=result),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )
    issued_roles: list[str] = []
    monkeypatch.setattr(
        auth_endpoint,
        "create_access_token",
        lambda *, subject, role: issued_roles.append(role) or f"token-for-{subject}",
    )

    await auth_endpoint.dev_login(
        DevLoginRequest(access_code="correct-code-123456", nickname="빈조농장"),
        _request(),
        db,
    )

    assert farmer.role == "farmer"
    assert farmer.nickname == "빈조농장"
    assert issued_roles == ["farmer"]
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(farmer)
