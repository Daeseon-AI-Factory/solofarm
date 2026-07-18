"""
BINJO-specific settings — extends CoreSettings with product-only fields.

Core modules (core/ai, core/stt, etc.) read shared API keys via CoreSettings.
This product class adds DB URLs, CORS, and other BINJO-specific fields, and
overrides any defaults if BINJO needs different behavior.
"""

from core.config import CoreSettings
from pydantic import model_validator
from pydantic_settings import SettingsConfigDict


class Settings(CoreSettings):
    """BINJO app settings — inherits all core env vars and adds product-specific ones."""

    # Startup validation errors can otherwise include a repr of every supplied
    # setting, including credentials. Keep configuration failures actionable
    # without echoing their input values into container logs.
    model_config = SettingsConfigDict(hide_input_in_errors=True)

    # Database — Supabase Postgres (BINJO-specific)
    database_url: str  # Pooler URL (port 6543) for app runtime
    direct_url: str  # Direct URL (port 5432) for migrations only
    # Hosted Supabase requires SSL; an isolated local Docker PostgreSQL does not.
    database_ssl: bool = True

    # App-level
    debug: bool = False
    enable_dev_login: bool = False
    # External workflows stay closed until their provider credentials and
    # end-to-end callbacks have been verified in the target environment.
    enable_direct_checkout: bool = False
    enable_receipt_ocr: bool = False
    # Temporary app-level gate for the test farmer login. This replaces the
    # browser-native Basic Auth prompt while Kakao OAuth is not configured.
    dev_login_access_code: str = ""
    allowed_origins: str = "http://localhost:3000,http://localhost:3001"

    @model_validator(mode="after")
    def validate_test_login_gate(self) -> "Settings":
        """Fail at startup instead of exposing a test-login button that can never work."""
        if self.enable_dev_login and (
            len(self.dev_login_access_code) < 16
            or self.dev_login_access_code != self.dev_login_access_code.strip()
        ):
            raise ValueError(
                "DEV_LOGIN_ACCESS_CODE must contain at least 16 characters "
                "without leading or trailing whitespace when ENABLE_DEV_LOGIN=true"
            )
        return self

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


# Singleton — created once at import time, reused everywhere
settings = Settings()
