from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from database import get_db
from models.task import Task
from models.task_timer import TaskTimer
from models.employee import Employee
from utils.auth_utils import get_current_employee

router = APIRouter()


def _serialize_employee_stats(employee: Employee, db: Session) -> dict:
    tasks_done = db.query(Task).filter(
        Task.assignee_id == employee.id,
        Task.status == "done"
    ).count()

    timers = db.query(TaskTimer).filter(
        TaskTimer.employee_id == employee.id,
        TaskTimer.duration_hours != None
    ).all()
    total_time = round(sum(t.duration_hours for t in timers), 2)

    active_timer = db.query(TaskTimer).filter(
        TaskTimer.employee_id == employee.id,
        TaskTimer.stopped_at == None
    ).first()

    active_task = None
    if active_timer:
        task = db.query(Task).filter(Task.id == active_timer.task_id).first()
        if task:
            active_task = {
                "timer_id": active_timer.id,
                "task_id": task.id,
                "task_title": task.title,
                "started_at": active_timer.started_at,
            }

    return {
        "employee_id": employee.id,
        "name": employee.name,
        "department": employee.department,
        "tasks_completed": tasks_done,
        "total_hours_logged": total_time,
        "active_task": active_task,
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
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    return [_serialize_employee_stats(e, db) for e in employees]


# POST /productivity/timer/start
@router.post("/productivity/timer/start/{task_id}")
def start_timer(
    task_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    existing = db.query(TaskTimer).filter(
        TaskTimer.employee_id == current_employee.id,
        TaskTimer.stopped_at == None
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already tracking a task — stop it first")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    timer = TaskTimer(task_id=task_id, employee_id=current_employee.id, started_at=now)
    db.add(timer)
    db.commit()
    db.refresh(timer)
    return {"timer_id": timer.id, "task_id": task_id, "started_at": timer.started_at}


# POST /productivity/timer/stop
@router.post("/productivity/timer/stop")
def stop_timer(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    timer = db.query(TaskTimer).filter(
        TaskTimer.employee_id == current_employee.id,
        TaskTimer.stopped_at == None
    ).first()
    if not timer:
        raise HTTPException(status_code=400, detail="No active timer")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    timer.stopped_at = now
    timer.duration_hours = round((now - timer.started_at).total_seconds() / 3600, 4)
    db.commit()
    db.refresh(timer)
    return {
        "timer_id": timer.id,
        "task_id": timer.task_id,
        "started_at": timer.started_at,
        "stopped_at": timer.stopped_at,
        "duration_hours": timer.duration_hours,
    }