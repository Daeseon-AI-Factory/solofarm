"""
Core settings — env vars used by shared modules (ai, stt, auth, storage, payment).

# CORE_CANDIDATE — every product imports CoreSettings and extends it with
product-specific fields. Core modules import `from core.config import settings`
to get the singleton. Products define their own Settings subclass.

Design note: extra="ignore" lets pydantic-settings tolerate product-specific env
vars (database_url, debug, etc.) without complaining when CoreSettings reads
the shared .env file.
"""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# HS256 signs tokens with this string as the raw HMAC key. Below ~32 chars the
# key is brute-forceable offline; an empty key lets anyone forge a valid admin
# token. 32 is the conventional floor for a 256-bit HMAC secret.
MIN_JWT_SECRET_LENGTH = 32


class CoreSettings(BaseSettings):
    """Settings shared by all products that import core modules."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        # A failing validator (e.g. the JWT_SECRET guard below) would otherwise
        # embed a repr of every supplied setting — including api keys and the
        # signing secret — into the ValidationError and container logs. Core
        # holds the most sensitive fields, so it must hide inputs in its own
        # right, not rely on a subclass remembering to.
        hide_input_in_errors=True,
    )

    # Auth
    jwt_secret: str = ""
    kakao_client_id: str = ""
    kakao_client_secret: str = ""
    kakao_redirect_uri: str = ""

    # AI / STT
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Storage
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Queue
    redis_url: str = ""

    # Korean-context APIs (used by Korea-specific products only)
    kma_api_key: str = ""
    toss_client_key: str = ""
    toss_secret_key: str = ""
    toss_webhook_secret: str = ""

    @model_validator(mode="after")
    def _require_strong_jwt_secret(self) -> "CoreSettings":
        # A model_validator (not a field_validator) because pydantic does NOT
        # validate a field that falls back to its default. With `jwt_secret = ""`
        # as the default, a field_validator would be skipped exactly when
        # JWT_SECRET is unset — the one case we must reject. Model validators
        # always run, so an unset secret fails fast at startup instead of the
        # app booting with a forgeable, empty signing key.
        if len(self.jwt_secret) < MIN_JWT_SECRET_LENGTH:
            raise ValueError(
                f"JWT_SECRET must be at least {MIN_JWT_SECRET_LENGTH} characters. "
                "An empty or short signing key lets anyone forge valid tokens. "
                "Generate one with: openssl rand -hex 32"
            )
        return self


# Singleton — core modules import this directly.
# Products extend CoreSettings in their own app/config.py and have their own singleton.
settings = CoreSettings()
