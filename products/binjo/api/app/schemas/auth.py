"""Pydantic schemas for auth endpoints."""

from pydantic import BaseModel


class KakaoCallbackRequest(BaseModel):
    code: str  # Authorization code from Kakao redirect


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class FarmerProfile(BaseModel):
    id: str
    kakao_id: str
    nickname: str | None
    profile_image_url: str | None
    role: str
