from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.task import Task
from models.employee import Employee
from utils.auth_utils import get_current_employee, require_admin

router = APIRouter()


def _serialize_employee_stats(employee: Employee, db: Session) -> dict:
    tasks_done = db.query(Task).filter(
        Task.assignee_id == employee.id,
        Task.status == "done"
    ).count()

    return {
        "employee_id": employee.id,
        "name": employee.name,
        "department": employee.department,
        "tasks_completed": tasks_done,
    }


# GET /productivity/me
@router.get("/productivity/me")
def get_my_stats(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    stats = _serialize_employee_stats(current_employee, db)

    completed_tasks = db.query(Task).filter(
        Task.assignee_id == current_employee.id,
        Task.status == "done"
    ).order_by(Task.updated_at.desc()).all()

    stats["completed_tasks"] = [
        {"id": t.id, "title": t.title, "priority": t.priority, "due_date": t.due_date}
        for t in completed_tasks
    ]

    return stats


# GET /productivity/leaderboard
@router.get("/productivity/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    board = [_serialize_employee_stats(e, db) for e in employees]
    board.sort(key=lambda x: x["tasks_completed"], reverse=True)
    for i, entry in enumerate(board):
        entry["rank"] = i + 1
    return board


# GET /productivity/admin
@router.get("/productivity/admin")
def get_admin_overview(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    return [_serialize_employee_stats(e, db) for e in employees]
