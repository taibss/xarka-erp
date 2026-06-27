from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.attendance import Attendance
from models.employee import Employee
from utils.auth_utils import get_current_employee
from datetime import datetime, date, timedelta, timezone

router = APIRouter()

WORK_START_HOUR = 10
LATE_THRESHOLD_HOUR = 11
LATE_THRESHOLD_MINUTE = 30  # late if punch_in after 11:30am


@router.post("/attendance/punchin")
def punch_in(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    today = date.today()
    existing = db.query(Attendance).filter(
        Attendance.employee_id == current_employee.id,
        Attendance.date == today,
    ).first()

    if existing and existing.punch_in:
        raise HTTPException(status_code=400, detail="Already punched in today")

    now = datetime.utcnow()
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = datetime.now(timezone(ist_offset))
    is_late = now_ist.hour > LATE_THRESHOLD_HOUR or (now_ist.hour == LATE_THRESHOLD_HOUR and now_ist.minute > LATE_THRESHOLD_MINUTE)

    if existing:
        existing.punch_in = now
        existing.is_late = is_late
        existing.status = "present"
    else:
        attendance = Attendance(
            employee_id=current_employee.id,
            date=today,
            punch_in=now,
            is_late=is_late,
            status="present",
        )
        db.add(attendance)

    db.commit()
    return {"message": "Punched in", "time": now.isoformat(), "is_late": is_late}


@router.post("/attendance/punchout")
def punch_out(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    today = date.today()
    attendance = db.query(Attendance).filter(
        Attendance.employee_id == current_employee.id,
        Attendance.date == today,
    ).first()

    if not attendance or not attendance.punch_in:
        raise HTTPException(status_code=400, detail="No punch in record today")
    if attendance.punch_out:
        raise HTTPException(status_code=400, detail="Already punched out today")

    now = datetime.utcnow()
    attendance.punch_out = now
    attendance.hours_worked = round((now - attendance.punch_in).total_seconds() / 3600, 2)
    db.commit()

    return {
        "message": "Punched out",
        "time": now.isoformat(),
        "hours_worked": attendance.hours_worked,
    }


@router.get("/attendance/today")
def get_today(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    today = date.today()
    attendance = db.query(Attendance).filter(
        Attendance.employee_id == current_employee.id,
        Attendance.date == today,
    ).first()

    if not attendance:
        return {"status": "not_punched"}

    if attendance.punch_in and attendance.punch_out:
        return {
            "status": "punched_out",
            "punch_in": attendance.punch_in.isoformat(),
            "punch_out": attendance.punch_out.isoformat(),
            "hours_worked": attendance.hours_worked,
            "is_late": attendance.is_late,
        }

    if attendance.punch_in:
        return {
            "status": "punched_in",
            "punch_in": attendance.punch_in.isoformat(),
            "is_late": attendance.is_late,
        }

    return {"status": "not_punched"}


@router.get("/attendance/history")
def get_history(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    thirty_days_ago = date.today() - timedelta(days=30)
    records = db.query(Attendance).filter(
        Attendance.employee_id == current_employee.id,
        Attendance.date >= thirty_days_ago,
    ).order_by(Attendance.date.desc()).all()

    return [
        {
            "id": r.id,
            "date": r.date.isoformat(),
            "punch_in": r.punch_in.isoformat() if r.punch_in else None,
            "punch_out": r.punch_out.isoformat() if r.punch_out else None,
            "hours_worked": r.hours_worked,
            "is_late": r.is_late,
        }
        for r in records
    ]


@router.get("/attendance/admin")
def admin_view(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    today = date.today()
    records = db.query(Attendance).filter(Attendance.date == today).all()

    result = []
    for r in records:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        result.append({
            "employee": emp.name if emp else "Unknown",
            "punch_in": r.punch_in.isoformat() if r.punch_in else None,
            "punch_out": r.punch_out.isoformat() if r.punch_out else None,
            "hours_worked": r.hours_worked,
            "is_late": r.is_late,
            "is_in_office": r.punch_in and not r.punch_out,
        })

    return result


@router.get("/attendance/admin/employees")
def admin_list_employees(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    return [{"id": e.id, "name": e.name, "email": e.email} for e in employees]


@router.get("/attendance/admin/{employee_id}")
def admin_employee_history(
    employee_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    thirty_days_ago = date.today() - timedelta(days=30)
    records = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date >= thirty_days_ago,
    ).order_by(Attendance.date.desc()).all()

    return {
        "employee": {"id": emp.id, "name": emp.name, "email": emp.email},
        "records": [
            {
                "id": r.id,
                "date": r.date.isoformat(),
                "punch_in": r.punch_in.isoformat() if r.punch_in else None,
                "punch_out": r.punch_out.isoformat() if r.punch_out else None,
                "hours_worked": r.hours_worked,
                "is_late": r.is_late,
            }
            for r in records
        ],
    }
