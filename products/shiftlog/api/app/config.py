"""
ShiftLog-specific settings — extends CoreSettings with product-only fields.

Core modules (core/ai, core/stt, etc.) read shared API keys via CoreSettings.
This product class adds CORS + app-level config for the FastAPI surface.
"""

from core.config import CoreSettings


class Settings(CoreSettings):
    """ShiftLog app settings — inherits all core env vars and adds product-specific ones."""

    debug: bool = False

    # CORS — Next.js dev on 3002 by default to avoid binjo (3000) conflict.
    # Override via env var for prod.
    allowed_origins: str = "http://localhost:3002,http://127.0.0.1:3002"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


settings = Settings()
