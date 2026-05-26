"""
Monthly P&L report PDF generator — ReportLab-based financial report.

Generates a Korean-language monthly financial report matching the layout
from the Phase 3 spec (section 10). Includes:
- Summary (total income, expense, net profit)
- Income breakdown by category
- Expense breakdown by category
- Month-over-month comparison
- 6-month trend chart (embedded PNG from chart_generator)

Uses ReportLab (not WeasyPrint) because WeasyPrint requires GTK/Cairo
native libraries that are painful on Windows. ReportLab is already
a dependency from Phase 2's farm diary PDF exporter.
"""

import io
from datetime import date
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

from app.schemas.report import MonthlySummary, MonthlyTrend

# Register Korean CID font — same as Phase 2 PDF exporter
pdfmetrics.registerFont(UnicodeCIDFont("HYSMyeongJo-Medium"))
KOREAN_FONT = "HYSMyeongJo-Medium"

# Styles
TITLE_STYLE = ParagraphStyle(
    "Title", fontName=KOREAN_FONT, fontSize=16, leading=20,
    alignment=1, spaceAfter=10,
)
SUBTITLE_STYLE = ParagraphStyle(
    "Subtitle", fontName=KOREAN_FONT, fontSize=12, leading=14,
    alignment=1, spaceAfter=6, textColor=colors.grey,
)
SECTION_STYLE = ParagraphStyle(
    "Section", fontName=KOREAN_FONT, fontSize=12, leading=14,
    spaceBefore=12, spaceAfter=6,
)
BODY_STYLE = ParagraphStyle(
    "Body", fontName=KOREAN_FONT, fontSize=10, leading=12,
)


def _format_won(amount: Decimal | int) -> str:
    """Format Korean won with comma separators."""
    return f"{int(amount):,}원"


def _pct(part: Decimal | int, total: Decimal | int) -> str:
    """Calculate percentage string."""
    if total == 0:
        return "0%"
    return f"{int(part) * 100 // int(total)}%"


def generate_monthly_report_pdf(
    summary: MonthlySummary,
    prev_summary: MonthlySummary | None,
    trend_chart_png: bytes | None,
    farm_name: str = "빈조농장",
) -> bytes:
    """
    Generate a monthly P&L report PDF.

    Args:
        summary: Current month's financial summary.
        prev_summary: Previous month's summary (for comparison). None if first month.
        trend_chart_png: PNG bytes of the 6-month trend chart. None to skip.
        farm_name: Farm name for the header.

    Returns:
        PDF bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=25 * mm,
        bottomMargin=20 * mm,
    )

    elements = []

    # --- Header ---
    elements.append(Paragraph(f"{farm_name} 월간 경영 리포트", TITLE_STYLE))
    elements.append(Paragraph(f"{summary.year}년 {summary.month}월", SUBTITLE_STYLE))
    elements.append(Spacer(1, 10 * mm))

    # --- Summary table ---
    elements.append(Paragraph("■ 요약", SECTION_STYLE))

    summary_data = [
        ["항목", "금액"],
        ["총 수입", _format_won(summary.total_income)],
        ["총 지출", _format_won(summary.total_expense)],
        ["순 이익", _format_won(summary.net_profit)],
    ]
    summary_table = Table(summary_data, colWidths=[60 * mm, 80 * mm])
    summary_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), KOREAN_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.2, 0.4, 0.2)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.95)]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 8 * mm))

    # --- Income breakdown ---
    if summary.income_by_category:
        elements.append(Paragraph("■ 수입 내역", SECTION_STYLE))
        income_data = [["카테고리", "금액", "비율"]]
        for cat, amount in sorted(summary.income_by_category.items(), key=lambda x: -x[1]):
            income_data.append([
                cat,
                _format_won(amount),
                _pct(amount, summary.total_income),
            ])
        income_table = Table(income_data, colWidths=[50 * mm, 60 * mm, 30 * mm])
        income_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), KOREAN_FONT),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.2, 0.5, 0.2)),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(income_table)
        elements.append(Spacer(1, 6 * mm))

    # --- Expense breakdown ---
    if summary.expense_by_category:
        elements.append(Paragraph("■ 지출 내역", SECTION_STYLE))
        expense_data = [["카테고리", "금액", "비율"]]
        for cat, amount in sorted(summary.expense_by_category.items(), key=lambda x: -x[1]):
            expense_data.append([
                cat,
                _format_won(amount),
                _pct(amount, summary.total_expense),
            ])
        expense_table = Table(expense_data, colWidths=[50 * mm, 60 * mm, 30 * mm])
        expense_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), KOREAN_FONT),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.6, 0.2, 0.2)),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(expense_table)
        elements.append(Spacer(1, 6 * mm))

    # --- Month-over-month comparison ---
    if prev_summary:
        elements.append(Paragraph("■ 전월 대비", SECTION_STYLE))
        comp_data = [["항목", "이번 달", "지난 달", "변동"]]

        for label, curr, prev_val in [
            ("수입", summary.total_income, prev_summary.total_income),
            ("지출", summary.total_expense, prev_summary.total_expense),
            ("순이익", summary.net_profit, prev_summary.net_profit),
        ]:
            if prev_val != 0:
                change_pct = (int(curr) - int(prev_val)) * 100 // int(prev_val)
                arrow = "↑" if change_pct > 0 else "↓" if change_pct < 0 else "→"
                change_str = f"{change_pct:+d}% {arrow}"
            else:
                change_str = "-"
            comp_data.append([label, _format_won(curr), _format_won(prev_val), change_str])

        comp_table = Table(comp_data, colWidths=[35 * mm, 45 * mm, 45 * mm, 30 * mm])
        comp_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), KOREAN_FONT),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.3, 0.3, 0.5)),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(comp_table)
        elements.append(Spacer(1, 6 * mm))

    # --- Trend chart ---
    if trend_chart_png:
        elements.append(Paragraph("■ 6개월 추이", SECTION_STYLE))
        img = Image(ImageReader(io.BytesIO(trend_chart_png)), width=160 * mm, height=80 * mm)
        elements.append(img)
        elements.append(Spacer(1, 6 * mm))

    # --- Footer ---
    today = date.today()
    elements.append(Spacer(1, 10 * mm))
    elements.append(Paragraph(
        f"작성일: {today.strftime('%Y.%m.%d')}",
        ParagraphStyle("Footer", fontName=KOREAN_FONT, fontSize=9, textColor=colors.grey, alignment=2),
    ))
    elements.append(Paragraph(
        f"{farm_name} 경영관리시스템",
        ParagraphStyle("Footer2", fontName=KOREAN_FONT, fontSize=9, textColor=colors.grey, alignment=2),
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
