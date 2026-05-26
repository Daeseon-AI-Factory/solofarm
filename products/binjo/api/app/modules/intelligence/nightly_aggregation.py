"""
Nightly analytics aggregation — pre-computes dashboard data for fast reads.

# CORE_CANDIDATE — nightly batch analytics pattern reusable across products.

Run by Celery Beat at midnight. Computes daily/customer/channel stats and
stores them as AnalyticsSnapshot records. Dashboards read from snapshots
instead of running expensive real-time aggregation queries.
"""

import logging
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics_snapshot import AnalyticsSnapshot
from app.models.customer import Customer
from app.models.financial_transaction import FinancialTransaction
from app.models.sales_order import SalesOrder

logger = logging.getLogger(__name__)


async def run_nightly_aggregation(
    db: AsyncSession,
    farm_id: UUID,
    snapshot_date: date | None = None,
) -> dict:
    """
    Compute and store all analytics snapshots for a given date.

    Generates three snapshot types:
    1. daily_summary: income/expense/profit for the day
    2. customer_stats: customer count, LTV, repeat rate
    3. channel_stats: revenue by sales channel
    """
    target_date = snapshot_date or date.today() - timedelta(days=1)

    daily = await _compute_daily_summary(db, farm_id, target_date)
    customers = await _compute_customer_stats(db, farm_id)
    channels = await _compute_channel_stats(db, farm_id, target_date)

    # Upsert snapshots
    for snap_type, data in [
        ("daily_summary", daily),
        ("customer_stats", customers),
        ("channel_stats", channels),
    ]:
        existing = await db.execute(
            select(AnalyticsSnapshot).where(
                AnalyticsSnapshot.farm_id == farm_id,
                AnalyticsSnapshot.snapshot_date == target_date,
                AnalyticsSnapshot.type == snap_type,
            )
        )
        snapshot = existing.scalar_one_or_none()

        if snapshot:
            snapshot.data = data
        else:
            snapshot = AnalyticsSnapshot(
                farm_id=farm_id,
                snapshot_date=target_date,
                type=snap_type,
                data=data,
            )
            db.add(snapshot)

    await db.commit()

    logger.info("Nightly aggregation completed for %s (farm=%s)", target_date, farm_id)
    return {"daily": daily, "customers": customers, "channels": channels}


async def _compute_daily_summary(
    db: AsyncSession, farm_id: UUID, target_date: date
) -> dict:
    """Compute income/expense/profit for a single day."""
    next_day = target_date + timedelta(days=1)

    query = (
        select(
            FinancialTransaction.type,
            func.sum(FinancialTransaction.amount).label("total"),
        )
        .where(
            FinancialTransaction.farm_id == farm_id,
            FinancialTransaction.status == "confirmed",
            FinancialTransaction.transaction_date >= target_date,
            FinancialTransaction.transaction_date < next_day,
        )
        .group_by(FinancialTransaction.type)
    )
    rows = (await db.execute(query)).all()

    income = 0
    expense = 0
    for txn_type, total in rows:
        if txn_type == "income":
            income = int(total or 0)
        elif txn_type == "expense":
            expense = int(total or 0)

    return {
        "date": target_date.isoformat(),
        "income": income,
        "expense": expense,
        "profit": income - expense,
    }


async def _compute_customer_stats(db: AsyncSession, farm_id: UUID) -> dict:
    """Compute customer analytics snapshot."""
    total = (await db.execute(
        select(func.count(Customer.id)).where(Customer.farm_id == farm_id)
    )).scalar() or 0

    repeat = (await db.execute(
        select(func.count(Customer.id)).where(
            Customer.farm_id == farm_id,
            Customer.total_orders >= 2,
        )
    )).scalar() or 0

    vip = (await db.execute(
        select(func.count(Customer.id)).where(
            Customer.farm_id == farm_id,
            Customer.total_orders >= 3,
        )
    )).scalar() or 0

    avg_spent = (await db.execute(
        select(func.avg(Customer.total_spent)).where(Customer.farm_id == farm_id)
    )).scalar()

    return {
        "total_customers": total,
        "repeat_customers": repeat,
        "vip_customers": vip,
        "repeat_rate": round(repeat / total * 100, 1) if total > 0 else 0,
        "avg_lifetime_value": int(avg_spent or 0),
    }


async def _compute_channel_stats(
    db: AsyncSession, farm_id: UUID, target_date: date
) -> dict:
    """Compute sales by channel for the current month."""
    month_start = target_date.replace(day=1)
    if target_date.month == 12:
        month_end = date(target_date.year + 1, 1, 1)
    else:
        month_end = date(target_date.year, target_date.month + 1, 1)

    query = (
        select(
            SalesOrder.channel,
            func.count(SalesOrder.id).label("count"),
            func.sum(SalesOrder.total_amount).label("total"),
        )
        .where(
            SalesOrder.farm_id == farm_id,
            SalesOrder.status.in_(["paid", "shipped", "delivered"]),
            SalesOrder.created_at >= month_start.isoformat(),
            SalesOrder.created_at < month_end.isoformat(),
        )
        .group_by(SalesOrder.channel)
    )
    rows = (await db.execute(query)).all()

    return {
        row[0]: {"orders": row[1], "revenue": int(row[2] or 0)}
        for row in rows
    }
