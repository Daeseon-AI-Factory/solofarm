"""
Scheduled monthly report generation — runs on 1st of each month via Celery Beat.

Generates the previous month's report for all farms that have transactions.
Produces the P&L PDF and uploads it to Supabase Storage.

Schedule: 1st of each month at 06:00 UTC (15:00 KST).
"""

import asyncio
import logging

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async function from synchronous Celery worker context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    name="workers.tasks.generate_monthly_report.generate_all_monthly_reports",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def generate_all_monthly_reports(self):
    """
    Generate monthly reports for all farms with transactions.

    Runs on the 1st of each month — generates the PREVIOUS month's report.
    For example: runs on April 1st, generates March report.
    """

    async def _generate():
        from datetime import date

        from sqlalchemy import distinct, select

        from app.database import async_session
        from app.models.financial_transaction import FinancialTransaction
        from app.modules.bookkeeping.chart_generator import generate_trend_chart
        from app.modules.bookkeeping.report_generator import (
            generate_monthly_summary,
            get_monthly_trend,
        )
        from app.modules.bookkeeping.report_pdf import generate_monthly_report_pdf

        today = date.today()
        # Generate report for the previous month
        report_month = today.month - 1
        report_year = today.year
        if report_month == 0:
            report_month = 12
            report_year -= 1

        # Previous-previous month for comparison
        prev_month = report_month - 1
        prev_year = report_year
        if prev_month == 0:
            prev_month = 12
            prev_year -= 1

        async with async_session() as db:
            # Find all farms with transactions
            result = await db.execute(
                select(distinct(FinancialTransaction.farm_id))
            )
            farm_ids = [row[0] for row in result.all()]

            logger.info(
                "Generating monthly reports for %d farms (%d/%d)",
                len(farm_ids), report_year, report_month,
            )

            for farm_id in farm_ids:
                try:
                    # Generate summary
                    summary = await generate_monthly_summary(
                        db, farm_id, report_year, report_month
                    )
                    prev_summary = await generate_monthly_summary(
                        db, farm_id, prev_year, prev_month
                    )

                    # Generate trend chart
                    trend = await get_monthly_trend(db, farm_id, months=6)
                    trend_chart = generate_trend_chart(trend) if trend else None

                    # Generate PDF
                    pdf_bytes = generate_monthly_report_pdf(
                        summary=summary,
                        prev_summary=prev_summary,
                        trend_chart_png=trend_chart,
                    )

                    # Upload PDF to storage
                    from core.storage.file_manager import upload_image

                    pdf_url = await upload_image(pdf_bytes, "application/pdf")

                    # Update MonthlyReport record with PDF URL
                    from app.models.monthly_report import MonthlyReport

                    report_result = await db.execute(
                        select(MonthlyReport).where(
                            MonthlyReport.farm_id == farm_id,
                            MonthlyReport.year == report_year,
                            MonthlyReport.month == report_month,
                        )
                    )
                    report = report_result.scalar_one_or_none()
                    if report:
                        report.report_pdf_url = pdf_url
                        report.status = "finalized"
                        await db.commit()

                    logger.info(
                        "Generated monthly report for farm %s (%d/%d)",
                        farm_id, report_year, report_month,
                    )

                except Exception as e:
                    logger.error(
                        "Failed to generate report for farm %s: %s",
                        farm_id, e,
                    )
                    # Continue with other farms — don't let one failure block all

    try:
        _run_async(_generate())
    except Exception as e:
        logger.error("Monthly report generation failed: %s", e)
        raise self.retry(exc=e)
