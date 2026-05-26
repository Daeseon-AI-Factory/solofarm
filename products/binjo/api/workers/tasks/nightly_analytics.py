"""
Celery task: nightly analytics aggregation.

Scheduled via Celery Beat to run at midnight. Pre-computes daily/customer/channel
statistics and stores them as AnalyticsSnapshot records for fast dashboard reads.
"""

import asyncio
import logging

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="nightly_analytics", bind=True, max_retries=2)
def nightly_analytics_task(self):
    """
    Run nightly analytics aggregation for all farms.

    For the single-farm MVP, this queries the one farm. Multi-farm would
    iterate over all active farms.
    """
    try:
        asyncio.run(_run_aggregation())
    except Exception as exc:
        logger.error("Nightly analytics failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=300)  # Retry in 5 minutes


async def _run_aggregation():
    """Async wrapper — Celery tasks are synchronous, but our DB is async."""
    from app.database import async_session
    from app.modules.intelligence.nightly_aggregation import run_nightly_aggregation
    from sqlalchemy import text

    async with async_session() as db:
        # Get the single farm's ID
        result = await db.execute(text("SELECT id FROM farm LIMIT 1"))
        row = result.first()
        if row is None:
            logger.warning("No farm found — skipping nightly aggregation")
            return

        farm_id = row[0]
        stats = await run_nightly_aggregation(db, farm_id)
        logger.info("Nightly aggregation complete: %s", stats)
