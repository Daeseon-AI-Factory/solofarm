"""
Core settings — env vars used by shared modules (ai, stt, auth, storage, payment).

# CORE_CANDIDATE — every product imports CoreSettings and extends it with
product-specific fields. Core modules import `from core.config import settings`
to get the singleton. Products define their own Settings subclass.

Design note: extra="ignore" lets pydantic-settings tolerate product-specific env
vars (database_url, debug, etc.) without complaining when CoreSettings reads
the shared .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class CoreSettings(BaseSettings):
    """Settings shared by all products that import core modules."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
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


# Singleton — core modules import this directly.
# Products extend CoreSettings in their own app/config.py and have their own singleton.
settings = CoreSettings()
