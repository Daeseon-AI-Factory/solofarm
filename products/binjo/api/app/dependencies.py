"""
Shared FastAPI dependencies — injected into endpoints via Depends().

This is the Dependency Injection pattern — FastAPI resolves these per request,
keeping endpoint code clean and testable.
"""

from typing import Optional

from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth.jwt_handler import verify_token
from app.database import get_db
from app.models.farmer import Farmer

# HTTPBearer extracts the token from "Authorization: Bearer <token>" header
security = HTTPBearer()
# auto_error=False so we can fall back to query param token
security_optional = HTTPBearer(auto_error=False)


async def get_current_farmer(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Farmer:
    """
    Verify JWT and return the current Farmer.
    Raises 401 if token is invalid or farmer not found.
    """
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "인증이 만료되었습니다"},
        )

    farmer_id = payload.get("sub")
    if not farmer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "잘못된 토큰입니다"},
        )

    result = await db.execute(select(Farmer).where(Farmer.id == farmer_id))
    farmer = result.scalar_one_or_none()

    if farmer is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "사용자를 찾을 수 없습니다"},
        )

    return farmer


async def get_current_farmer_or_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    token: Optional[str] = Query(None, description="JWT token as query param (for PDF downloads via browser)"),
    db: AsyncSession = Depends(get_db),
) -> Farmer:
    """
    Resolve farmer from Bearer header OR query param ?token=.

    PDF downloads open in a new tab via window.open(url) — browsers can't
    send Authorization headers on a GET navigation, so we accept the token
    as a query parameter as fallback.
    """
    raw_token = None
    if credentials:
        raw_token = credentials.credentials
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_TOKEN", "message": "인증이 필요합니다"},
        )

    payload = verify_token(raw_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "인증이 만료되었습니다"},
        )

    farmer_id = payload.get("sub")
    if not farmer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "잘못된 토큰입니다"},
        )

    result = await db.execute(select(Farmer).where(Farmer.id == farmer_id))
    farmer = result.scalar_one_or_none()

    if farmer is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "사용자를 찾을 수 없습니다"},
        )

    return farmer
