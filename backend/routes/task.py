from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
from database import get_db
from models.task import Task, Comment, Subtask
from models.employee import Employee
from models.activity_log import ActivityLog
from utils.auth_utils import get_current_employee
from services.notify import create_notification, send_email

router = APIRouter()

VALID_STATUSES = {"todo", "inprogress", "review", "done"}
VALID_PRIORITIES = {"low", "medium", "high"}


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None


class MoveTask(BaseModel):
    status: str


class CommentCreate(BaseModel):
    content: str


class SubtaskCreate(BaseModel):
    title: str


def _get_task_or_404(task_id: int, db: Session) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _serialize_task(task: Task, db: Session) -> dict:
    assignee = db.query(Employee).filter(Employee.id == task.assignee_id).first() if task.assignee_id else None
    creator = db.query(Employee).filter(Employee.id == task.created_by).first()
    requester = db.query(Employee).filter(Employee.id == task.requested_by).first() if task.requested_by else None
    comments = db.query(Comment).filter(Comment.task_id == task.id).order_by(Comment.created_at).all()
    subtasks = db.query(Subtask).filter(Subtask.task_id == task.id).order_by(Subtask.created_at).all()

    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date,
        "created_at": task.created_at.isoformat() + "Z" if task.created_at else None,
        "approval_status": task.approval_status,
        "requested_status": task.requested_status,
        "requested_by": task.requested_by,
        "requested_by_name": requester.name if requester else None,
        "assignee": {"id": assignee.id, "name": assignee.name} if assignee else None,
        "created_by": {"id": creator.id, "name": creator.name} if creator else None,
        "comments": [
            {
                "id": c.id,
                "content": c.content,
                "created_at": c.created_at.isoformat() + "Z" if c.created_at else None,
                "author": db.query(Employee).filter(Employee.id == c.author_id).first().name
            }
            for c in comments
        ],
        "subtasks": [
            {"id": s.id, "title": s.title, "is_done": s.is_done}
            for s in subtasks
        ],
    }


def _can_modify_task(task: Task, employee: Employee) -> bool:
    if employee.role == "admin":
        return True
    if task.created_by == employee.id:
        return True
    if task.assignee_id == employee.id:
        return True
    return False


@router.post("/tasks")
def create_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if data.priority and data.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail="Invalid priority")

    task = Task(
        title=data.title,
        description=data.description,
        priority=data.priority or "medium",
        assignee_id=data.assignee_id,
        due_date=data.due_date,
        created_by=current_employee.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    log = ActivityLog(
        employee_id=current_employee.id,
        action="created",
        task_id=task.id,
        detail=f"created task '{task.title}'",
    )
    db.add(log)

    if task.assignee_id and task.assignee_id != current_employee.id:
        assignee = db.query(Employee).filter(Employee.id == task.assignee_id).first()
        log2 = ActivityLog(
            employee_id=current_employee.id,
            action="assigned",
            task_id=task.id,
            detail=f"assigned to {assignee.name}" if assignee else "assigned",
        )
        db.add(log2)
        db.commit()
        create_notification(
            db=db,
            employee_id=task.assignee_id,
            title="Task Assigned",
            message=f"You've been assigned to task '{task.title}'",
            notif_type="task_assigned",
            link="/kanban",
        )

        if assignee:
            send_email(
                to=assignee.email,
                subject=f"New task assigned — {task.title}",
                body=f"Hi {assignee.name},\n\nYou have been assigned a new task:\n\nTitle: {task.title}\nPriority: {task.priority}\nDue date: {task.due_date}\n\nPlease log into Xarka ERP to view details.\n\nXarka ERP",
            )

    return _serialize_task(task, db)


@router.get("/tasks")
def get_tasks(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role == "admin":
        tasks = db.query(Task).order_by(Task.created_at.desc()).all()
    else:
        tasks = db.query(Task).filter(
            Task.assignee_id == current_employee.id
        ).order_by(Task.created_at.desc()).all()
    return [_serialize_task(t, db) for t in tasks]


@router.get("/tasks/{task_id}")
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    task = _get_task_or_404(task_id, db)
    if not _can_modify_task(task, current_employee):
        raise HTTPException(status_code=403, detail="Not authorized to view this task")
    return _serialize_task(task, db)


@router.patch("/tasks/{task_id}")
def update_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    task = _get_task_or_404(task_id, db)
    if not _can_modify_task(task, current_employee):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")

    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.priority is not None:
        if data.priority not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail="Invalid priority")
        task.priority = data.priority
    if data.assignee_id is not None:
        task.assignee_id = data.assignee_id
    if data.due_date is not None:
        task.due_date = data.due_date
    db.commit()
    db.refresh(task)
    return _serialize_task(task, db)


@router.patch("/tasks/{task_id}/move")
def move_task(
    task_id: int,
    data: MoveTask,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if data.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    task = _get_task_or_404(task_id, db)
    if not _can_modify_task(task, current_employee):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")

    # Admin can move directly
    if current_employee.role == "admin":
        old_status = task.status
        task.status = data.status
        task.approval_status = None
        task.requested_status = None
        task.requested_by = None
        db.commit()
        db.refresh(task)

        status_labels = {"todo": "To Do", "inprogress": "In Progress", "review": "Review", "done": "Done"}
        log = ActivityLog(
            employee_id=current_employee.id,
            action="completed" if data.status == "done" else "moved",
            task_id=task.id,
            detail=f"moved to {status_labels.get(data.status, data.status)}" if data.status != "done" else f"completed '{task.title}'",
        )
        db.add(log)
        db.commit()
        return _serialize_task(task, db)

    # Non-admin: create approval request instead of moving directly
    if data.status == task.status:
        return _serialize_task(task, db)

    task.approval_status = "pending"
    task.requested_status = data.status
    task.requested_by = current_employee.id
    db.commit()
    db.refresh(task)

    # Notify admin(s)
    admins = db.query(Employee).filter(Employee.role == "admin", Employee.is_active == True).all()
    for admin in admins:
        if admin.id != current_employee.id:
            create_notification(
                db=db,
                employee_id=admin.id,
                title="Approval Required",
                message=f"{current_employee.name} requests to move '{task.title}' to {data.status}",
                notif_type="approval_required",
                link="/kanban",
            )

    status_labels = {"todo": "To Do", "inprogress": "In Progress", "review": "Review", "done": "Done"}
    log = ActivityLog(
        employee_id=current_employee.id,
        action="requested",
        task_id=task.id,
        detail=f"requested move to {status_labels.get(data.status, data.status)}",
    )
    db.add(log)
    db.commit()

    return _serialize_task(task, db)


class ApprovalAction(BaseModel):
    action: str  # "approve" or "reject"


@router.post("/tasks/{task_id}/approve")
def approve_task(
    task_id: int,
    data: ApprovalAction,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can approve task moves")

    task = _get_task_or_404(task_id, db)
    if task.approval_status != "pending":
        raise HTTPException(status_code=400, detail="No pending approval for this task")

    if data.action == "approve":
        task.status = task.requested_status
        task.approval_status = None
        task.requested_status = None
        task.requested_by = None
        action_type = "approved"
        detail_msg = f"approved move to {task.status}"
    elif data.action == "reject":
        task.approval_status = None
        task.requested_status = None
        task.requested_by = None
        action_type = "rejected"
        detail_msg = "rejected status change request"
    else:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    db.commit()
    db.refresh(task)

    log = ActivityLog(
        employee_id=current_employee.id,
        action=action_type,
        task_id=task.id,
        detail=detail_msg,
    )
    db.add(log)

    # Notify the requester
    if task.requested_by and task.requested_by != current_employee.id:
        create_notification(
            db=db,
            employee_id=task.requested_by,
            title=f"Request {data.action.title()}d",
            message=f"Your request to move '{task.title}' was {data.action}d by {current_employee.name}",
            notif_type=f"task_{data.action}d",
            link="/kanban",
        )

    db.commit()
    return _serialize_task(task, db)


@router.get("/tasks/pending-approvals")
def get_pending_approvals(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    tasks = db.query(Task).filter(
        Task.approval_status == "pending"
    ).order_by(Task.created_at.desc()).all()
    return [_serialize_task(t, db) for t in tasks]


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    task = _get_task_or_404(task_id, db)
    if not _can_modify_task(task, current_employee):
        raise HTTPException(status_code=403, detail="Not allowed")
    db.query(Comment).filter(Comment.task_id == task_id).delete()
    db.query(Subtask).filter(Subtask.task_id == task_id).delete()
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}


@router.post("/tasks/{task_id}/comments")
def add_comment(
    task_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    task = _get_task_or_404(task_id, db)
    if not _can_modify_task(task, current_employee):
        raise HTTPException(status_code=403, detail="Not authorized to comment on this task")

    comment = Comment(task_id=task_id, author_id=current_employee.id, content=data.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)

    log = ActivityLog(
        employee_id=current_employee.id,
        action="commented",
        task_id=task_id,
        detail=f"commented on task",
    )
    db.add(log)
    db.commit()

    if task.assignee_id and task.assignee_id != current_employee.id:
        create_notification(
            db=db,
            employee_id=task.assignee_id,
            title="New Comment",
            message=f"{current_employee.name} commented on '{task.title}'",
            notif_type="new_comment",
            link="/kanban",
        )

    return {"id": comment.id, "content": comment.content, "created_at": comment.created_at.isoformat() + "Z" if comment.created_at else None, "author": current_employee.name}


@router.post("/tasks/{task_id}/subtasks")
def add_subtask(
    task_id: int,
    data: SubtaskCreate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    task = _get_task_or_404(task_id, db)
    if not _can_modify_task(task, current_employee):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")

    subtask = Subtask(task_id=task_id, title=data.title)
    db.add(subtask)
    db.commit()
    db.refresh(subtask)
    return {"id": subtask.id, "title": subtask.title, "is_done": subtask.is_done}


@router.patch("/tasks/{task_id}/subtasks/{subtask_id}")
def toggle_subtask(
    task_id: int,
    subtask_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    task = _get_task_or_404(task_id, db)
    if not _can_modify_task(task, current_employee):
        raise HTTPException(status_code=403, detail="Not authorized to modify this task")

    subtask = db.query(Subtask).filter(Subtask.id == subtask_id, Subtask.task_id == task_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    subtask.is_done = not subtask.is_done
    db.commit()
    db.refresh(subtask)
    return {"id": subtask.id, "title": subtask.title, "is_done": subtask.is_done}
