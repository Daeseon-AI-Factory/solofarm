"""
Database engine and session factory.

Uses asyncpg for async PostgreSQL connections.
Same Supabase database as Phase 1 — Prisma (Node.js) and SQLAlchemy (Python) coexist.
"""

import ssl
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Use DIRECT_URL for development (no pgbouncer = no prepared statement issues).
# In production, use DATABASE_URL (pooler) with prepared_statement_name_func workaround.
_raw_url = settings.direct_url if settings.debug else settings.database_url

# Convert postgres:// to postgresql+asyncpg:// for SQLAlchemy async driver
# Strip pgbouncer params that asyncpg doesn't understand
_db_url = (
    _raw_url
    .replace("postgresql://", "postgresql+asyncpg://", 1)
    .replace("postgres://", "postgresql+asyncpg://", 1)
    .replace("?pgbouncer=true", "")
    .replace("&pgbouncer=true", "")
)

# Supabase requires SSL but asyncpg on Windows has issues with default cert loading.
# Create a permissive SSL context that doesn't require client certificates.
_ssl_context = ssl.create_default_context()
_ssl_context.check_hostname = False
_ssl_context.verify_mode = ssl.CERT_NONE

# pool_pre_ping=True — checks connection health before checkout,
# prevents "connection closed" errors after DB restarts or idle timeouts
engine = create_async_engine(
    _db_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"ssl": _ssl_context},
)

# expire_on_commit=False — lets us access attributes after commit
# without triggering a lazy load (which would fail outside the session)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency Injection — FastAPI injects a fresh session per request.
    The session is automatically closed after the request completes,
    even if an error occurs. This prevents connection leaks.
    """
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
