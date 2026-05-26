"""
Kakao OAuth client — handles the OAuth flow for farmer login.

# CORE_CANDIDATE — reusable for any Korean B2C product.

Flow:
1. Frontend redirects user to Kakao login URL
2. Kakao redirects back with authorization code
3. This module exchanges code → access token → user profile
4. App creates/updates farmer record and issues our own JWT
"""

import httpx

from core.config import settings

KAKAO_AUTH_URL = "https://kauth.kakao.com/oauth/authorize"
KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
KAKAO_USER_URL = "https://kapi.kakao.com/v2/user/me"


def get_kakao_login_url() -> str:
    """Generate the Kakao OAuth login URL for the frontend to redirect to."""
    return (
        f"{KAKAO_AUTH_URL}"
        f"?client_id={settings.kakao_client_id}"
        f"&redirect_uri={settings.kakao_redirect_uri}"
        f"&response_type=code"
    )


async def exchange_code_for_token(code: str) -> dict:
    """
    Exchange Kakao authorization code for access token.
    Returns the full token response (access_token, refresh_token, etc).
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            KAKAO_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "client_id": settings.kakao_client_id,
                "client_secret": settings.kakao_client_secret,
                "redirect_uri": settings.kakao_redirect_uri,
                "code": code,
            },
        )
        response.raise_for_status()
        return response.json()


async def get_kakao_user_profile(access_token: str) -> dict:
    """
    Fetch the Kakao user profile using the access token.
    Returns: kakao_id, nickname, profile_image_url
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            KAKAO_USER_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        data = response.json()

    kakao_account = data.get("kakao_account", {})
    profile = kakao_account.get("profile", {})

    return {
        "kakao_id": str(data["id"]),
        "nickname": profile.get("nickname", ""),
        "profile_image_url": profile.get("profile_image_url", ""),
    }
