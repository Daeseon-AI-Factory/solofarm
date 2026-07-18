"""
Shared FastAPI dependencies — injected into endpoints via Depends().

This is the Dependency Injection pattern — FastAPI resolves these per request,
keeping endpoint code clean and testable.
"""

from core.auth.jwt_handler import DOWNLOAD_SCOPE, verify_token
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.farmer import Farmer

# HTTPBearer extracts the token from "Authorization: Bearer <token>" header
security = HTTPBearer()
# auto_error=False so we can fall back to query param token
security_optional = HTTPBearer(auto_error=False)


def _validated_token_payload(raw_token: str, *, allow_download_scope: bool = False) -> dict:
    """
    Decode a JWT and validate the identity claims shared by auth dependencies.

    A download-scoped token (scope="download") is a restricted, short-lived
    credential meant only for the PDF query-param path. Every session dependency
    passes allow_download_scope=False so such a token can never act as a full
    session credential — it is accepted only where a caller explicitly opts in.
    """
    payload = verify_token(raw_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "인증이 만료되었습니다"},
        )

    if not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "잘못된 토큰입니다"},
        )

    if payload.get("scope") == DOWNLOAD_SCOPE and not allow_download_scope:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "잘못된 토큰입니다"},
        )

    return payload


async def _load_farmer_from_payload(payload: dict, db: AsyncSession) -> Farmer:
    """Load the database identity referenced by a validated JWT payload."""
    result = await db.execute(select(Farmer).where(Farmer.id == payload["sub"]))
    farmer = result.scalar_one_or_none()

    if farmer is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "사용자를 찾을 수 없습니다"},
        )

    return farmer


async def get_current_farmer(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Farmer:
    """
    Verify JWT and return the current Farmer.
    Raises 401 if token is invalid or farmer not found.
    """
    payload = _validated_token_payload(credentials.credentials)
    return await _load_farmer_from_payload(payload, db)


async def get_current_admin_farmer(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Farmer:
    """Return the JWT subject only when the signed token grants admin access."""
    payload = _validated_token_payload(credentials.credentials)
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ADMIN_REQUIRED",
                "message": "관리자 권한이 필요합니다",
            },
        )

    return await _load_farmer_from_payload(payload, db)


async def get_current_farmer_or_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
    token: str | None = Query(
        None,
        description="Short-lived download-scoped token (for PDF downloads via browser)",
    ),
    db: AsyncSession = Depends(get_db),
) -> Farmer:
    """
    Resolve farmer from Bearer header OR query param ?token=.

    PDF downloads open in a new tab via window.open(url) — browsers can't send
    Authorization headers on a GET navigation, so we accept a token in the URL.
    But a URL is logged and kept in history, so the query-param branch accepts
    ONLY a download-scoped token (mint one via POST /auth/download-token); a full
    session token is rejected there. The header branch keeps its normal session
    semantics and rejects download-scoped tokens.
    """
    if credentials:
        payload = _validated_token_payload(credentials.credentials)
    elif token:
        payload = _validated_token_payload(token, allow_download_scope=True)
        if payload.get("scope") != DOWNLOAD_SCOPE:
            # A plain session token must never travel in a URL. Force callers
            # onto the short-lived download token instead.
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_TOKEN", "message": "잘못된 토큰입니다"},
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_TOKEN", "message": "인증이 필요합니다"},
        )

    return await _load_farmer_from_payload(payload, db)
