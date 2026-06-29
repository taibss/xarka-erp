from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.activity_log import ActivityLog
from models.employee import Employee
from utils.auth_utils import require_admin

router = APIRouter()


@router.get("/activity/recent")
def get_recent_activity(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):

    logs = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit).all()

    result = []
    for log in logs:
        emp = db.query(Employee).filter(Employee.id == log.employee_id).first()
        task_title = None
        if log.task_id:
            from models.task import Task
            task = db.query(Task).filter(Task.id == log.task_id).first()
            task_title = task.title if task else None

        result.append({
            "id": log.id,
            "employee_name": emp.name if emp else "Unknown",
            "action": log.action,
            "task_title": task_title,
            "detail": log.detail,
            "created_at": log.created_at,
        })

    return result
