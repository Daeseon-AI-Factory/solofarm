"""Launch-gate tests for intentionally disabled unsafe surfaces."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DIRECT_URL", "postgresql://test:test@localhost/test")

from app.api.v1.router import api_router


def test_pesticide_routes_are_not_registered() -> None:
    """Do not expose pesticide guidance until its regulatory data is verified."""
    registered_paths = [route.path for route in api_router.routes]
    assert not any(path.startswith("/pesticides") for path in registered_paths)
