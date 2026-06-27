from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.employee import Employee
from models.attendance import Attendance
from models.leave import Leave
from utils.auth_utils import get_current_employee
from datetime import date

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
        attendance_records = db.query(Attendance).filter(
            Attendance.employee_id == id
        ).order_by(Attendance.date.desc()).limit(30).all()
        
        profile["attendance"] = [{
            "date": str(a.date),
            "punch_in": str(a.punch_in),
            "punch_out": str(a.punch_out) if a.punch_out else None,
            "hours_worked": a.hours_worked,
            "is_late": a.is_late
        } for a in attendance_records]
    
    return profile