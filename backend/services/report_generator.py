import io
from datetime import datetime
from typing import List, Dict, Optional

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet


def _format_time(dt: Optional[datetime]) -> str:
    """Format a datetime to 'HH:MM AM/PM' string without timezone conversion."""
    if not dt:
        return '--'
    hour = dt.hour
    minute = dt.minute
    period = 'PM' if hour >= 12 else 'AM'
    display_hour = hour % 12
    if display_hour == 0:
        display_hour = 12
    return f"{display_hour:02d}:{minute:02d} {period}"


def _format_date(d) -> str:
    """Format a date to 'DD Mon YYYY' string."""
    if not d:
        return '--'
    return d.strftime('%d %b %Y')


def build_rows(records) -> List[Dict]:
    """Convert Attendance ORM rows into flat dicts for report generation.

    Args:
        records: List of Attendance ORM objects with employee relationship loaded.

    Returns:
        List of flat dicts with formatted strings.
    """
    rows = []
    for rec in records:
        emp = getattr(rec, 'employee', None)
        punch_in_time = _format_time(rec.punch_in)
        punch_out_time = _format_time(rec.punch_out)
        hours = f"{rec.hours_worked:.2f}" if rec.hours_worked is not None else '--'

        # If both punch times are present, override "absent" — machine data is source of truth
        status = (rec.status or '--').capitalize()
        if rec.punch_in and rec.punch_out and status.lower() == 'absent':
            status = 'Present'

        rows.append({
            'date': _format_date(rec.date),
            'employee': emp.name if emp else f'ID {rec.employee_id}',
            'punch_in': punch_in_time,
            'punch_out': punch_out_time,
            'hours': hours,
            'status': status,
            'late': f"{rec.late_by:.0f} min" if rec.late_by else '--',
            'source': (rec.source or 'manual').replace('_', ' ').title(),
        })
    return rows


HEADERS = ['Date', 'Employee', 'Punch In', 'Punch Out', 'Hours', 'Status', 'Late', 'Source']

DARK_BG = '1F2937'
WHITE_FONT = Font(color='FFFFFF', bold=True, size=11)
HEADER_FILL = PatternFill(start_color=DARK_BG, end_color=DARK_BG, fill_type='solid')
ALT_ROW_FILL = PatternFill(start_color='F3F4F6', end_color='F3F4F6', fill_type='solid')
HEADER_BORDER = Border(
    bottom=Side(style='thin', color='9CA3AF'),
)
THIN_BORDER = Border(
    bottom=Side(style='hair', color='D1D5DB'),
)
CELL_FONT = Font(size=10)


def generate_attendance_excel(rows: List[Dict], start_date: str, end_date: str, employee_label: str) -> io.BytesIO:
    """Generate an Excel report of attendance data.

    Returns a BytesIO object containing the .xlsx file.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = 'Attendance Report'

    # Title row
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(HEADERS))
    title_cell = ws.cell(row=1, column=1, value='Attendance Report')
    title_cell.font = Font(bold=True, size=16, color=DARK_BG)
    title_cell.alignment = Alignment(horizontal='left')
    ws.row_dimensions[1].height = 30

    # Subtitle row
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(HEADERS))
    subtitle = f'{start_date}  to  {end_date}  |  {employee_label}'
    sub_cell = ws.cell(row=2, column=1, value=subtitle)
    sub_cell.font = Font(size=11, color='6B7280')
    sub_cell.alignment = Alignment(horizontal='left')
    ws.row_dimensions[2].height = 22

    # Header row
    header_row = 4
    for col_idx, header in enumerate(HEADERS, 1):
        cell = ws.cell(row=header_row, column=col_idx, value=header)
        cell.font = WHITE_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal='left', vertical='center')
        cell.border = HEADER_BORDER
    ws.row_dimensions[header_row].height = 28

    # Data rows
    for row_idx, row_data in enumerate(rows):
        excel_row = header_row + 1 + row_idx
        values = [
            row_data['date'],
            row_data['employee'],
            row_data['punch_in'],
            row_data['punch_out'],
            row_data['hours'],
            row_data['status'],
            row_data['late'],
            row_data['source'],
        ]
        for col_idx, value in enumerate(values, 1):
            cell = ws.cell(row=excel_row, column=col_idx, value=value)
            cell.font = CELL_FONT
            cell.border = THIN_BORDER
            cell.alignment = Alignment(vertical='center')
            if row_idx % 2 == 1:
                cell.fill = ALT_ROW_FILL

    # Column widths
    col_widths = [14, 22, 14, 14, 10, 12, 12, 16]
    for idx, width in enumerate(col_widths):
        ws.column_dimensions[chr(65 + idx)].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def generate_attendance_pdf(rows: List[Dict], start_date: str, end_date: str, employee_label: str) -> io.BytesIO:
    """Generate a PDF report of attendance data.

    Returns a BytesIO object containing the .pdf file.
    """
    output = io.BytesIO()
    doc = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # Title
    title_style = styles['Title']
    elements.append(Paragraph('Attendance Report', title_style))
    elements.append(Spacer(1, 6 * mm))

    # Subtitle
    subtitle_style = styles['Normal']
    subtitle_style.fontSize = 11
    subtitle_style.textColor = colors.HexColor('#6B7280')
    elements.append(Paragraph(f'{start_date}  to  {end_date}  |  {employee_label}', subtitle_style))
    elements.append(Spacer(1, 8 * mm))

    # Table data
    table_data = [HEADERS]
    for row_data in rows:
        table_data.append([
            row_data['date'],
            row_data['employee'],
            row_data['punch_in'],
            row_data['punch_out'],
            row_data['hours'],
            row_data['status'],
            row_data['late'],
            row_data['source'],
        ])

    col_widths = [40 * mm, 50 * mm, 32 * mm, 32 * mm, 22 * mm, 30 * mm, 25 * mm, 36 * mm]

    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    # Table styling
    dark_bg = colors.HexColor('#1F2937')
    alt_bg = colors.HexColor('#F3F4F6')
    grid_color = colors.HexColor('#D1D5DB')

    table_style = TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), dark_bg),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        # Data
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, grid_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ])

    # Alternating row colors
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            table_style.add('BACKGROUND', (0, i), (-1, i), alt_bg)

    table.setStyle(table_style)
    elements.append(table)

    doc.build(elements)
    output.seek(0)
    return output
