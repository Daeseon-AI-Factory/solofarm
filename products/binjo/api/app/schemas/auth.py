"""Pydantic schemas for auth endpoints."""

from pydantic import BaseModel, Field


class KakaoCallbackRequest(BaseModel):
    code: str  # Authorization code from Kakao redirect


class DevLoginRequest(BaseModel):
    """Temporary farmer login while the real OAuth integration is unavailable."""

    access_code: str = Field(min_length=16, max_length=128, pattern=r"^\S(?:.*\S)?$")
    nickname: str = Field(default="빈조농장", min_length=1, max_length=50)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class FarmerProfile(BaseModel):
    id: str
    kakao_id: str
    nickname: str | None
    profile_image_url: str | None
    role: str
