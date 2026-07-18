"""Scope enforcement for browser download tokens (?token= PDF path).

The vulnerability being closed: a full 24h session token was accepted in the
URL query string, where it lands in logs and browser history. The download
query-param path must accept ONLY a short-lived download-scoped token, and a
download-scoped token must never work as a general session credential.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.dependencies import get_current_farmer, get_current_farmer_or_token
from core.auth.jwt_handler import (
    DOWNLOAD_SCOPE,
    create_access_token,
    create_download_token,
)


def _db_returning(farmer: object) -> SimpleNamespace:
    result = MagicMock()
    result.scalar_one_or_none.return_value = farmer
    return SimpleNamespace(execute=AsyncMock(return_value=result))


def _bearer(token: str) -> SimpleNamespace:
    return SimpleNamespace(credentials=token)


def test_download_token_carries_the_download_scope() -> None:
    from jose import jwt

    from core.config import settings

    payload = jwt.decode(
        create_download_token("farmer-1"), settings.jwt_secret, algorithms=["HS256"]
    )
    assert payload["scope"] == DOWNLOAD_SCOPE


@pytest.mark.asyncio
async def test_query_path_rejects_a_full_session_token() -> None:
    # The exact hole: a session token in the URL. Must be refused.
    session_token = create_access_token(subject=str(uuid4()), role="farmer")
    with pytest.raises(HTTPException) as exc:
        await get_current_farmer_or_token(
            credentials=None, token=session_token, db=_db_returning(object())
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_query_path_accepts_a_download_token() -> None:
    farmer_id = uuid4()
    farmer = SimpleNamespace(id=farmer_id, role="farmer")
    token = create_download_token(str(farmer_id), "farmer")
    resolved = await get_current_farmer_or_token(
        credentials=None, token=token, db=_db_returning(farmer)
    )
    assert resolved is farmer


@pytest.mark.asyncio
async def test_header_path_still_accepts_a_session_token() -> None:
    farmer_id = uuid4()
    farmer = SimpleNamespace(id=farmer_id, role="farmer")
    token = create_access_token(subject=str(farmer_id), role="farmer")
    resolved = await get_current_farmer_or_token(
        credentials=_bearer(token), token=None, db=_db_returning(farmer)
    )
    assert resolved is farmer


@pytest.mark.asyncio
async def test_download_token_cannot_act_as_a_session_credential() -> None:
    # A leaked download token must not unlock normal session endpoints.
    token = create_download_token(str(uuid4()), "admin")
    with pytest.raises(HTTPException) as exc:
        await get_current_farmer(credentials=_bearer(token), db=_db_returning(object()))
    assert exc.value.status_code == 401
