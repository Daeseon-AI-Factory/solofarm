"""
Auth endpoints — Kakao OAuth login + profile.

Flow:
1. GET /auth/kakao/login → returns Kakao login URL
2. POST /auth/kakao → frontend sends authorization code → returns JWT
3. GET /auth/me → returns current farmer profile (requires JWT)
"""

import logging
from collections import defaultdict, deque
from ipaddress import ip_address
from secrets import compare_digest
from time import monotonic
from uuid import UUID

from core.auth.jwt_handler import create_access_token, create_download_token
from core.auth.kakao_auth import (
    exchange_code_for_token,
    get_kakao_login_url,
    get_kakao_user_profile,
)
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_farmer
from app.models.farmer import Farmer
from app.schemas.auth import (
    DevLoginRequest,
    FarmerProfile,
    KakaoCallbackRequest,
    TokenResponse,
)
from app.services.farm_identity import (
    SingleFarmResolutionError,
    resolve_single_farm_id,
)

router = APIRouter()
logger = logging.getLogger(__name__)

DEV_LOGIN_ATTEMPT_LIMIT = 10
DEV_LOGIN_ATTEMPT_WINDOW_SECONDS = 300
_dev_login_failures: dict[str, deque[float]] = defaultdict(deque)


def _dev_login_client_key(request: Request) -> str:
    """Prefer the client address supplied by the trusted Caddy edge."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        candidate = forwarded_for.split(",", maxsplit=1)[0].strip()
        try:
            return str(ip_address(candidate))
        except ValueError:
            pass
    return request.client.host if request.client else "unknown"


def _active_dev_login_failures(client_key: str) -> deque[float]:
    attempts = _dev_login_failures[client_key]
    cutoff = monotonic() - DEV_LOGIN_ATTEMPT_WINDOW_SECONDS
    while attempts and attempts[0] <= cutoff:
        attempts.popleft()
    return attempts


def _enforce_dev_login_rate_limit(client_key: str) -> None:
    if len(_active_dev_login_failures(client_key)) < DEV_LOGIN_ATTEMPT_LIMIT:
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "TOO_MANY_ATTEMPTS",
            "message": "로그인 시도가 너무 많습니다. 5분 후 다시 시도해주세요",
        },
        headers={"Retry-After": str(DEV_LOGIN_ATTEMPT_WINDOW_SECONDS)},
    )


async def _resolve_farm_for_login(db: AsyncSession) -> UUID:
    """Resolve the single deployment farm or expose a configuration failure."""
    try:
        return await resolve_single_farm_id(db)
    except SingleFarmResolutionError as exc:
        logger.error("Cannot assign farmer: expected one farm, found %d", exc.farm_count)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "FARM_CONFIGURATION_ERROR",
                "message": "농장 연결 설정을 확인해주세요",
            },
        ) from exc


@router.get("/kakao/login")
async def kakao_login_url() -> dict[str, str]:
    """Return the Kakao OAuth login URL for the frontend to redirect to."""
    return {"login_url": get_kakao_login_url()}


@router.post("/kakao", response_model=TokenResponse)
async def kakao_callback(
    body: KakaoCallbackRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Exchange Kakao authorization code for our JWT.
    Creates the farmer account on first login (upsert pattern).
    """
    try:
        # Step 1: Exchange code for Kakao access token
        token_data = await exchange_code_for_token(body.code)
        kakao_access_token = token_data["access_token"]

        # Step 2: Fetch user profile from Kakao
        profile = await get_kakao_user_profile(kakao_access_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "KAKAO_AUTH_FAILED", "message": "카카오 인증에 실패했습니다"},
        )

    # Step 3: Upsert farmer — create on first login, update on subsequent logins
    result = await db.execute(select(Farmer).where(Farmer.kakao_id == profile["kakao_id"]))
    farmer = result.scalar_one_or_none()

    if farmer is None:
        # First login — create new farmer
        farmer = Farmer(
            farm_id=await _resolve_farm_for_login(db),
            kakao_id=profile["kakao_id"],
            nickname=profile["nickname"],
            profile_image_url=profile["profile_image_url"],
        )
        db.add(farmer)
        await db.commit()
        await db.refresh(farmer)
    else:
        # Returning user — update profile in case it changed on Kakao
        farmer.nickname = profile["nickname"]
        farmer.profile_image_url = profile["profile_image_url"]
        if farmer.farm_id is None:
            farmer.farm_id = await _resolve_farm_for_login(db)
        await db.commit()

    # Step 4: Issue our own JWT with farmer's ID as subject
    access_token = create_access_token(subject=str(farmer.id), role=farmer.role)
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=FarmerProfile)
async def get_me(farmer: Farmer = Depends(get_current_farmer)) -> FarmerProfile:
    """Return the current farmer's profile."""
    return FarmerProfile(
        id=str(farmer.id),
        kakao_id=farmer.kakao_id,
        nickname=farmer.nickname,
        profile_image_url=farmer.profile_image_url,
        role=farmer.role,
    )


@router.post("/download-token", response_model=TokenResponse)
async def issue_download_token(
    farmer: Farmer = Depends(get_current_farmer),
) -> TokenResponse:
    """
    Issue a short-lived, download-scoped token for browser PDF/export links.

    Requires a valid session (header auth). The browser fetches this right
    before opening a PDF URL, so the full 24h session token never lands in a
    query string. get_current_farmer rejects download-scoped tokens, so this
    token cannot be used to mint another — it must come from a real session.
    """
    token = create_download_token(str(farmer.id), farmer.role)
    return TokenResponse(access_token=token)


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(
    body: DevLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Dev-only login — bypasses Kakao OAuth for local testing.
    Creates or reuses a test farmer account and returns a JWT.
    Only available when ENABLE_DEV_LOGIN=true and protected by an app-level
    access code. The code is deliberately independent from browser Basic Auth
    so users remain inside the product login flow.
    """
    from app.config import settings

    if not settings.enable_dev_login:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )

    client_key = _dev_login_client_key(request)
    _enforce_dev_login_rate_limit(client_key)

    expected_code = settings.dev_login_access_code
    code_matches = compare_digest(
        body.access_code.encode("utf-8"),
        (expected_code or "disabled-test-login").encode("utf-8"),
    )
    if not expected_code or not code_matches:
        _active_dev_login_failures(client_key).append(monotonic())
        logger.warning("Rejected farmer access-code login from client=%s", client_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_ACCESS_CODE",
                "message": "접근 코드를 확인해주세요",
            },
        )

    nickname = body.nickname
    dev_kakao_id = "dev-test-farmer"

    result = await db.execute(select(Farmer).where(Farmer.kakao_id == dev_kakao_id))
    farmer = result.scalar_one_or_none()

    if farmer is None:
        farmer = Farmer(
            farm_id=await _resolve_farm_for_login(db),
            kakao_id=dev_kakao_id,
            nickname=nickname,
            role="farmer",
        )
        db.add(farmer)
        await db.commit()
        await db.refresh(farmer)
    else:
        profile_changed = False
        if farmer.farm_id is None:
            farmer.farm_id = await _resolve_farm_for_login(db)
            profile_changed = True
        if farmer.role != "farmer":
            farmer.role = "farmer"
            profile_changed = True
        if farmer.nickname != nickname:
            farmer.nickname = nickname
            profile_changed = True
        if profile_changed:
            await db.commit()
            await db.refresh(farmer)

    _dev_login_failures.pop(client_key, None)
    logger.info("Farmer access-code login succeeded for client=%s", client_key)
    access_token = create_access_token(subject=str(farmer.id), role="farmer")
    return TokenResponse(access_token=access_token)
