"""Health check endpoint for monitoring."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter()


@router.get("/db-check")
async def db_check(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Verify database connectivity."""
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
