from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from datetime import date
from typing import Optional

from database import get_db
from models.attendance import Attendance
from models.employee import Employee
from utils.auth_utils import require_admin
from services.report_generator import (
    build_rows,
    generate_attendance_excel,
    generate_attendance_pdf,
)

router = APIRouter(tags=["reports"])


@router.get("/reports/attendance")
def get_attendance_report(
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
    format: str = Query(..., description="Export format: xlsx or pdf"),
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    try:
        sd = date.fromisoformat(start_date)
        ed = date.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if format not in ("xlsx", "pdf"):
        raise HTTPException(status_code=400, detail="format must be 'xlsx' or 'pdf'.")

    query = (
        db.query(Attendance)
        .options(joinedload(Attendance.employee))
        .filter(
            Attendance.date >= sd,
            Attendance.date <= ed,
        )
        .order_by(Attendance.date.desc())
    )

    if employee_id is not None:
        query = query.filter(Attendance.employee_id == employee_id)

    records = query.all()

    if employee_id:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        employee_label = emp.name if emp else f"Employee {employee_id}"
    else:
        employee_label = "All Employees"

    rows = build_rows(records)

    if format == "xlsx":
        output = generate_attendance_excel(rows, start_date, end_date, employee_label)
        filename = f"attendance_report_{start_date}_to_{end_date}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        output = generate_attendance_pdf(rows, start_date, end_date, employee_label)
        filename = f"attendance_report_{start_date}_to_{end_date}.pdf"
        media_type = "application/pdf"

    return StreamingResponse(
        output,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
