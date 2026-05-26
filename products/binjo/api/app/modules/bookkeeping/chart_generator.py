"""
Chart generator — Matplotlib server-side charts for P&L reports.

Generates PNG chart images as bytes for embedding in PDF reports
and serving to the dashboard. Uses Agg backend (no display needed).
"""

import io
import logging

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend — no GUI needed on server
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

from app.schemas.report import MonthlyTrend

logger = logging.getLogger(__name__)

# Korean month labels
MONTH_LABELS = {
    1: "1월", 2: "2월", 3: "3월", 4: "4월",
    5: "5월", 6: "6월", 7: "7월", 8: "8월",
    9: "9월", 10: "10월", 11: "11월", 12: "12월",
}

# Colors matching a clean financial report style
INCOME_COLOR = "#4CAF50"
EXPENSE_COLOR = "#F44336"
PROFIT_COLOR = "#2196F3"


def _setup_korean_font():
    """
    Try to use a Korean font for chart labels.
    Falls back to default if no Korean font is available.
    """
    korean_fonts = ["Malgun Gothic", "NanumGothic", "AppleGothic", "NanumBarunGothic"]
    for font_name in korean_fonts:
        if any(f.name == font_name for f in fm.fontManager.ttflist):
            plt.rcParams["font.family"] = font_name
            plt.rcParams["axes.unicode_minus"] = False
            return
    # Fallback — labels may not render Korean correctly
    logger.warning("No Korean font found for charts — labels may render incorrectly")


def generate_trend_chart(trends: list[MonthlyTrend]) -> bytes:
    """
    Generate a 6-month income vs expense bar chart.

    Returns PNG bytes suitable for embedding in PDF or serving via API.
    """
    _setup_korean_font()

    labels = [MONTH_LABELS.get(t.month, str(t.month)) for t in trends]
    income = [int(t.total_income) for t in trends]
    expense = [int(t.total_expense) for t in trends]

    fig, ax = plt.subplots(figsize=(8, 4))

    x = range(len(labels))
    bar_width = 0.35

    ax.bar([i - bar_width / 2 for i in x], income, bar_width,
           label="수입", color=INCOME_COLOR, alpha=0.85)
    ax.bar([i + bar_width / 2 for i in x], expense, bar_width,
           label="지출", color=EXPENSE_COLOR, alpha=0.85)

    ax.set_xticks(list(x))
    ax.set_xticklabels(labels)
    ax.set_ylabel("금액 (원)")
    ax.set_title("월별 수입/지출 추이")
    ax.legend()

    # Format y-axis with comma separators for Korean won
    ax.get_yaxis().set_major_formatter(
        plt.FuncFormatter(lambda val, pos: f"{int(val):,}")
    )

    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()


def generate_expense_pie_chart(expense_by_category: dict[str, int | float]) -> bytes:
    """
    Generate a pie chart of expense breakdown by category.

    Returns PNG bytes.
    """
    _setup_korean_font()

    if not expense_by_category:
        # Empty pie chart placeholder
        fig, ax = plt.subplots(figsize=(6, 6))
        ax.text(0.5, 0.5, "지출 내역 없음", ha="center", va="center", fontsize=14)
        ax.set_axis_off()
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=150)
        plt.close(fig)
        buf.seek(0)
        return buf.getvalue()

    labels = list(expense_by_category.keys())
    values = [int(v) for v in expense_by_category.values()]

    fig, ax = plt.subplots(figsize=(6, 6))

    wedges, texts, autotexts = ax.pie(
        values, labels=labels, autopct="%1.0f%%",
        startangle=90, pctdistance=0.75,
    )

    ax.set_title("지출 카테고리별 비율")
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()
