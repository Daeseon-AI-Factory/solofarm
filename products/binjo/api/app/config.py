"""
BINJO-specific settings — extends CoreSettings with product-only fields.

Core modules (core/ai, core/stt, etc.) read shared API keys via CoreSettings.
This product class adds DB URLs, CORS, and other BINJO-specific fields, and
overrides any defaults if BINJO needs different behavior.
"""

from core.config import CoreSettings


class Settings(CoreSettings):
    """BINJO app settings — inherits all core env vars and adds product-specific ones."""

    # Database — Supabase Postgres (BINJO-specific)
    database_url: str  # Pooler URL (port 6543) for app runtime
    direct_url: str  # Direct URL (port 5432) for migrations only

    # App-level
    debug: bool = False
    allowed_origins: str = "http://localhost:3000,http://localhost:3001"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


# Singleton — created once at import time, reused everywhere
settings = Settings()
