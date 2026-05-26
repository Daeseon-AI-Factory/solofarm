"""
영농일지 PDF exporter — government-compliant format.

Generates a PDF matching the official 영농일지 양식 structure:
- Farm header (name, owner, address, date range)
- Table with: 작업일, 필지, 작목, 작업단계, 세부작업, 농약/비료, 날씨

Uses ReportLab for PDF generation with Korean font support.
"""

import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.farm_log import FarmLog

# Korean font — ReportLab uses Helvetica by default which can't render Korean.
# We register a CID font for Korean (part of ReportLab's built-in CJK support).
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

pdfmetrics.registerFont(UnicodeCIDFont("HYSMyeongJo-Medium"))
KOREAN_FONT = "HYSMyeongJo-Medium"


def generate_farm_diary_pdf(
    logs: list[FarmLog],
    farm_name: str,
    farmer_name: str,
    address: str,
    date_from: date,
    date_to: date,
) -> bytes:
    """
    Generate a 영농일지 PDF from a list of confirmed farm log entries.
    Returns the PDF as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=15 * mm,
    )

    elements = []

    # Styles
    title_style = ParagraphStyle(
        "Title",
        fontName=KOREAN_FONT,
        fontSize=18,
        alignment=1,  # center
        spaceAfter=10 * mm,
    )
    header_style = ParagraphStyle(
        "Header",
        fontName=KOREAN_FONT,
        fontSize=10,
        spaceAfter=2 * mm,
    )
    cell_style = ParagraphStyle(
        "Cell",
        fontName=KOREAN_FONT,
        fontSize=8,
        leading=10,
    )

    # Title
    elements.append(Paragraph("영 농 일 지", title_style))

    # Farm info header
    elements.append(Paragraph(f"농장명: {farm_name}", header_style))
    elements.append(Paragraph(f"농장주: {farmer_name}", header_style))
    elements.append(Paragraph(f"주소: {address}", header_style))
    elements.append(
        Paragraph(
            f"기간: {date_from.strftime('%Y.%m.%d')} ~ {date_to.strftime('%Y.%m.%d')}",
            header_style,
        )
    )
    elements.append(Spacer(1, 5 * mm))

    # Table header
    table_data = [
        [
            Paragraph("작업일", cell_style),
            Paragraph("필지", cell_style),
            Paragraph("작목", cell_style),
            Paragraph("작업단계", cell_style),
            Paragraph("세부작업내용", cell_style),
            Paragraph("농약/비료\n사용내역", cell_style),
            Paragraph("날씨", cell_style),
        ]
    ]

    # Table rows — one row per task (a log with 2 tasks = 2 rows)
    for log in sorted(logs, key=lambda l: l.log_date):
        date_str = log.log_date.strftime("%m.%d")
        weather = log.weather_farmer or ""

        # Chemical summary for this log
        chemicals = ""
        for c in log.chemicals:
            line = f"{c.name}"
            if c.amount:
                line += f" {c.amount}"
            line += f" ({c.action})"
            chemicals += line + "\n"
        chemicals = chemicals.strip()

        if not log.tasks:
            # Log with no tasks — still show the date
            table_data.append([
                Paragraph(date_str, cell_style),
                Paragraph("", cell_style),
                Paragraph(log.crop, cell_style),
                Paragraph("", cell_style),
                Paragraph(log.notes or "", cell_style),
                Paragraph(chemicals, cell_style),
                Paragraph(weather, cell_style),
            ])
        else:
            for i, task in enumerate(sorted(log.tasks, key=lambda t: t.sort_order)):
                field = task.field_name or ""
                table_data.append([
                    # Only show date on first row of each log
                    Paragraph(date_str if i == 0 else "", cell_style),
                    Paragraph(field, cell_style),
                    Paragraph(log.crop if i == 0 else "", cell_style),
                    Paragraph(task.stage, cell_style),
                    Paragraph(task.detail or "", cell_style),
                    Paragraph(chemicals if i == 0 else "", cell_style),
                    Paragraph(weather if i == 0 else "", cell_style),
                ])

    # Column widths (total ~180mm for A4 with margins)
    col_widths = [18 * mm, 22 * mm, 15 * mm, 20 * mm, 40 * mm, 40 * mm, 25 * mm]

    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.17, 0.31, 0.09)),  # #2D5016
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), KOREAN_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.5, colors.Color(0.9, 0.88, 0.86)),  # #E5E2DB
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        # Alternate row colors
        *[
            ("BACKGROUND", (0, i), (-1, i), colors.Color(0.99, 0.98, 0.97))  # #FDFBF7
            for i in range(1, len(table_data), 2)
        ],
    ]))

    elements.append(table)
    elements.append(Spacer(1, 10 * mm))

    # Footer
    footer_style = ParagraphStyle(
        "Footer",
        fontName=KOREAN_FONT,
        fontSize=9,
        alignment=2,  # right
    )
    elements.append(
        Paragraph(f"작성일: {date.today().strftime('%Y.%m.%d')}", footer_style)
    )
    elements.append(Paragraph(f"작성자: {farmer_name}", footer_style))

    doc.build(elements)
    return buffer.getvalue()
