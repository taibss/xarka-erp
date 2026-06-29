from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.employee import Employee
from models.task import Task
from models.attendance import Attendance
from utils.auth_utils import get_current_employee
from datetime import date, datetime

router = APIRouter()

@router.get("/manager/team-status")
def get_team_status(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee)
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    today = date.today()
    result = []

    for emp in employees:
        attendance = db.query(Attendance).filter(
            Attendance.employee_id == emp.id,
            Attendance.date == today
        ).first()

        if not attendance or not attendance.punch_in:
            continue

        if attendance.punch_out:
            office_status = "Out"
            hours_today = round(attendance.hours_worked or 0, 1)
        else:
            office_status = "In Office"
            elapsed = datetime.utcnow() - attendance.punch_in
            hours_today = round(elapsed.total_seconds() / 3600, 1)

        current_task = None
        active_task = db.query(Task).filter(
            Task.assignee_id == emp.id,
            Task.status.in_(["todo", "inprogress", "review"])
        ).order_by(Task.updated_at.desc()).first()
        if active_task:
            current_task = {
                "id": active_task.id,
                "title": active_task.title,
                "priority": active_task.priority,
                "status": active_task.status,
                "started": None
            }

        completed_today = db.query(Task).filter(
            Task.assignee_id == emp.id,
            Task.status == "done",
            Task.updated_at >= datetime.combine(today, datetime.min.time())
        ).all()

        overdue = db.query(Task).filter(
            Task.assignee_id == emp.id,
            Task.status != "done",
            Task.due_date < today
        ).all()

        result.append({
            "id": emp.id,
            "name": emp.name,
            "email": emp.email,
            "department": emp.department,
            "office_status": office_status,
            "hours_today": hours_today,
            "punch_in": attendance.punch_in.isoformat() if attendance.punch_in else None,
            "punch_out": attendance.punch_out.isoformat() if attendance.punch_out else None,
            "current_task": current_task,
            "completed_today": [{
                "id": t.id,
                "title": t.title
            } for t in completed_today],
            "overdue": [{
                "id": t.id,
                "title": t.title,
                "due_date": str(t.due_date)
            } for t in overdue]
        })

    return result
