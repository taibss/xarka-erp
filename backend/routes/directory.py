from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.employee import Employee
from models.attendance import Attendance
from models.leave import Leave
from models.task import Task
from utils.auth_utils import get_current_employee
from datetime import date
import calendar

router = APIRouter()

def get_employee_status(employee_id: int, db: Session) -> str:
    today = date.today()
    
    # check if on approved leave today
    leave = db.query(Leave).filter(
        Leave.employee_id == employee_id,
        Leave.status == "approved",
        Leave.from_date <= today,
        Leave.to_date >= today
    ).first()
    if leave:
        return "On Leave"
    
    # check attendance
    attendance = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date == today
    ).first()
    
    if attendance:
        if attendance.punch_out:
            return "Out"
        return "In Office"
    
    return "Out"

@router.get("/directory")
def get_directory(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee)
):
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    result = []
    for emp in employees:
        result.append({
            "id": emp.id,
            "name": emp.name,
            "email": emp.email,
            "department": emp.department,
            "role": emp.role,
            "phone": emp.phone,
            "status": get_employee_status(emp.id, db)
        })
    return result

@router.get("/directory/{id}")
def get_employee_profile(
    id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee)
):
    employee = db.query(Employee).filter(Employee.id == id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # basic info everyone can see
    profile = {
        "id": employee.id,
        "name": employee.name,
        "email": employee.email,
        "department": employee.department,
        "role": employee.role,
        "phone": employee.phone,
        "joining_date": employee.joining_date,
        "status": get_employee_status(employee.id, db)
    }
    
    # admin sees everything
    if current_employee.role == "admin" or current_employee.id == id:
        today = date.today()
        month_start = today.replace(day=1)

        month_attendance = db.query(Attendance).filter(
            Attendance.employee_id == id,
            Attendance.date >= month_start,
            Attendance.date <= today,
        ).all()
        hours_this_month = round(sum(a.hours_worked or 0 for a in month_attendance), 2)

        recent_attendance = db.query(Attendance).filter(
            Attendance.employee_id == id
        ).order_by(Attendance.date.desc()).limit(7).all()

        profile["attendance"] = [{
            "date": str(a.date),
            "punch_in": str(a.punch_in) if a.punch_in else None,
            "punch_out": str(a.punch_out) if a.punch_out else None,
            "hours_worked": a.hours_worked,
        } for a in recent_attendance]

        all_tasks = db.query(Task).filter(Task.assignee_id == id).all()
        active_tasks = [t for t in all_tasks if t.status != "done"]
        completed_count = len([t for t in all_tasks if t.status == "done"])

        profile["tasks"] = [{
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "due_date": str(t.due_date) if t.due_date else None,
        } for t in sorted(active_tasks, key=lambda t: t.created_at, reverse=True)]

        profile["stats"] = {
            "hours_this_month": hours_this_month,
            "tasks_pending": len(active_tasks),
            "tasks_completed": completed_count,
        }
    
    return profile