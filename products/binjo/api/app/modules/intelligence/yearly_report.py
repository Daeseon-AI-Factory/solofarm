"""
AI-powered yearly farm report generator.

Gathers a full year of farm data (logs, transactions, orders, weather, customers),
pre-computes statistics deterministically, then sends to Claude for narrative
analysis and actionable insights.

This is the Deterministic Backbone principle in action:
- Statistics computation → code (same input, same output)
- Narrative generation → AI (judgment needed)
"""

import logging
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.ai.claude_provider import ClaudeProvider
from app.models.customer import Customer
from app.models.farm_log import FarmLog
from app.models.financial_transaction import FinancialTransaction
from app.models.sales_order import SalesOrder

logger = logging.getLogger(__name__)


async def compute_yearly_stats(
    db: AsyncSession,
    farm_id: UUID,
    year: int,
) -> dict:
    """
    Pre-compute all yearly statistics from the database.

    This is the deterministic part — same data always produces the same stats.
    The AI layer receives these stats and generates narrative/insights.
    """
    year_start = date(year, 1, 1)
    year_end = date(year + 1, 1, 1)

    # Financial summary
    income_query = (
        select(
            FinancialTransaction.category,
            func.sum(FinancialTransaction.amount).label("total"),
            func.count(FinancialTransaction.id).label("count"),
        )
        .where(
            FinancialTransaction.farm_id == farm_id,
            FinancialTransaction.type == "income",
            FinancialTransaction.status == "confirmed",
            FinancialTransaction.transaction_date >= year_start,
            FinancialTransaction.transaction_date < year_end,
        )
        .group_by(FinancialTransaction.category)
    )
    income_rows = (await db.execute(income_query)).all()

    expense_query = (
        select(
            FinancialTransaction.category,
            func.sum(FinancialTransaction.amount).label("total"),
            func.count(FinancialTransaction.id).label("count"),
        )
        .where(
            FinancialTransaction.farm_id == farm_id,
            FinancialTransaction.type == "expense",
            FinancialTransaction.status == "confirmed",
            FinancialTransaction.transaction_date >= year_start,
            FinancialTransaction.transaction_date < year_end,
        )
        .group_by(FinancialTransaction.category)
    )
    expense_rows = (await db.execute(expense_query)).all()

    income_by_category = {row[0]: int(row[1]) for row in income_rows}
    expense_by_category = {row[0]: int(row[1]) for row in expense_rows}
    total_income = sum(income_by_category.values())
    total_expense = sum(expense_by_category.values())

    # Farm log summary
    log_count = (await db.execute(
        select(func.count(FarmLog.id)).where(
            FarmLog.farm_id == farm_id,
            FarmLog.work_date >= year_start,
            FarmLog.work_date < year_end,
        )
    )).scalar() or 0

    # Order summary
    order_count = (await db.execute(
        select(func.count(SalesOrder.id)).where(
            SalesOrder.farm_id == farm_id,
            SalesOrder.created_at >= year_start.isoformat(),
            SalesOrder.status.in_(["paid", "shipped", "delivered"]),
        )
    )).scalar() or 0

    # Channel breakdown
    channel_query = (
        select(
            SalesOrder.channel,
            func.count(SalesOrder.id).label("count"),
            func.sum(SalesOrder.total_amount).label("total"),
        )
        .where(
            SalesOrder.farm_id == farm_id,
            SalesOrder.status.in_(["paid", "shipped", "delivered"]),
            SalesOrder.created_at >= year_start.isoformat(),
        )
        .group_by(SalesOrder.channel)
    )
    channel_rows = (await db.execute(channel_query)).all()
    sales_by_channel = {row[0]: {"count": row[1], "total": int(row[2] or 0)} for row in channel_rows}

    # Customer analytics
    customer_count = (await db.execute(
        select(func.count(Customer.id)).where(Customer.farm_id == farm_id)
    )).scalar() or 0

    repeat_customers = (await db.execute(
        select(func.count(Customer.id)).where(
            Customer.farm_id == farm_id,
            Customer.total_orders >= 2,
        )
    )).scalar() or 0

    return {
        "year": year,
        "total_income": total_income,
        "total_expense": total_expense,
        "net_profit": total_income - total_expense,
        "income_by_category": income_by_category,
        "expense_by_category": expense_by_category,
        "work_days": log_count,
        "total_orders": order_count,
        "sales_by_channel": sales_by_channel,
        "customer_count": customer_count,
        "repeat_customers": repeat_customers,
        "repeat_rate": round(repeat_customers / customer_count * 100, 1) if customer_count > 0 else 0,
    }


async def generate_yearly_narrative(stats: dict) -> str:
    """
    Send yearly stats to Claude for AI-powered narrative and insights.

    This is the AI judgment part — Claude analyzes the stats and produces
    actionable recommendations the farmer can act on.
    """
    claude = ClaudeProvider()

    system_prompt = """너는 한국 농업 경영 컨설턴트 AI야.
농장의 연간 데이터를 분석해서 경영 리포트를 작성해줘.

## 작성 규칙
- 농민이 이해하기 쉬운 한국어로 작성
- 숫자는 천 단위 콤마 포함 (예: 32,500,000원)
- 전년 대비 분석은 데이터가 있을 때만
- 실행 가능한 제안만 포함 (추상적 조언 X)
- 이모지 적절히 사용

## 출력 형식 (마크다운)

### 📊 경영 요약
총 수입, 지출, 순이익 요약

### 🍎 판매 분석
채널별 판매 현황, 주요 트렌드

### 💰 비용 분석
카테고리별 지출 현황, 주목할 항목

### 👥 고객 분석
고객 수, 재구매율, 채널 특성

### 🔮 AI 제안 (3-5개)
데이터 기반 실행 가능한 제안
"""

    user_message = f"""다음은 빈조농장 {stats['year']}년 연간 데이터입니다:

## 재무 요약
- 총 수입: {stats['total_income']:,}원
- 총 지출: {stats['total_expense']:,}원
- 순 이익: {stats['net_profit']:,}원

## 수입 카테고리별
{_format_dict(stats['income_by_category'])}

## 지출 카테고리별
{_format_dict(stats['expense_by_category'])}

## 운영 현황
- 총 작업일수: {stats['work_days']}일
- 총 주문: {stats['total_orders']}건

## 판매 채널별
{_format_channel(stats['sales_by_channel'])}

## 고객 현황
- 전체 고객: {stats['customer_count']}명
- 재구매 고객: {stats['repeat_customers']}명 ({stats['repeat_rate']}%)

이 데이터를 기반으로 연간 경영 리포트를 작성해줘."""

    return await claude.complete(system_prompt, user_message, max_tokens=4000)


def _format_dict(d: dict) -> str:
    if not d:
        return "- (데이터 없음)"
    return "\n".join(f"- {k}: {v:,}원" for k, v in d.items())


def _format_channel(d: dict) -> str:
    if not d:
        return "- (데이터 없음)"
    return "\n".join(
        f"- {k}: {v['count']}건, {v['total']:,}원"
        for k, v in d.items()
    )
