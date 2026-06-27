from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
from database import get_db
from models.task import Task, Comment, Subtask
from models.employee import Employee
from utils.auth_utils import get_current_employee
from services.notify import create_notification, send_email

router = APIRouter()

VALID_STATUSES = {"todo", "inprogress", "review", "done"}
VALID_PRIORITIES = {"low", "medium", "high"}


# ── Schemas ──────────────────────────────────────────────────────────────────

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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_task_or_404(task_id: int, db: Session) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

def _serialize_task(task: Task, db: Session) -> dict:
    assignee = db.query(Employee).filter(Employee.id == task.assignee_id).first() if task.assignee_id else None
    creator = db.query(Employee).filter(Employee.id == task.created_by).first()
    comments = db.query(Comment).filter(Comment.task_id == task.id).order_by(Comment.created_at).all()
    subtasks = db.query(Subtask).filter(Subtask.task_id == task.id).order_by(Subtask.created_at).all()

    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date,
        "created_at": task.created_at,
        "assignee": {"id": assignee.id, "name": assignee.name} if assignee else None,
        "created_by": {"id": creator.id, "name": creator.name} if creator else None,
        "comments": [
            {
                "id": c.id,
                "content": c.content,
                "created_at": c.created_at,
                "author": db.query(Employee).filter(Employee.id == c.author_id).first().name
            }
            for c in comments
        ],
        "subtasks": [
            {"id": s.id, "title": s.title, "is_done": s.is_done}
            for s in subtasks
        ],
    }


# ── Task CRUD ─────────────────────────────────────────────────────────────────

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

    if task.assignee_id and task.assignee_id != current_employee.id:
        create_notification(
            db=db,
            employee_id=task.assignee_id,
            title="Task Assigned",
            message=f"You've been assigned to task '{task.title}'",
            notif_type="task_assigned",
            link="/kanban",
        )

        assignee = db.query(Employee).filter(Employee.id == task.assignee_id).first()
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
    return _serialize_task(task, db)


@router.patch("/tasks/{task_id}")
def update_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    task = _get_task_or_404(task_id, db)
    if data.title is not None: task.title = data.title
    if data.description is not None: task.description = data.description
    if data.priority is not None:
        if data.priority not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail="Invalid priority")
        task.priority = data.priority
    if data.assignee_id is not None: task.assignee_id = data.assignee_id
    if data.due_date is not None: task.due_date = data.due_date
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
    task.status = data.status
    db.commit()
    db.refresh(task)
    return _serialize_task(task, db)


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    task = _get_task_or_404(task_id, db)
    # only creator or admin can delete
    if task.created_by != current_employee.id and current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    db.query(Comment).filter(Comment.task_id == task_id).delete()
    db.query(Subtask).filter(Subtask.task_id == task_id).delete()
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}


# ── Comments ──────────────────────────────────────────────────────────────────

@router.post("/tasks/{task_id}/comments")
def add_comment(
    task_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    _get_task_or_404(task_id, db)
    comment = Comment(task_id=task_id, author_id=current_employee.id, content=data.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)

    task = db.query(Task).filter(Task.id == task_id).first()
    if task and task.assignee_id and task.assignee_id != current_employee.id:
        create_notification(
            db=db,
            employee_id=task.assignee_id,
            title="New Comment",
            message=f"{current_employee.name} commented on '{task.title}'",
            notif_type="new_comment",
            link="/kanban",
        )

    return {"id": comment.id, "content": comment.content, "created_at": comment.created_at, "author": current_employee.name}


# ── Subtasks ──────────────────────────────────────────────────────────────────

@router.post("/tasks/{task_id}/subtasks")
def add_subtask(
    task_id: int,
    data: SubtaskCreate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    _get_task_or_404(task_id, db)
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
    subtask = db.query(Subtask).filter(Subtask.id == subtask_id, Subtask.task_id == task_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    subtask.is_done = not subtask.is_done
    db.commit()
    db.refresh(subtask)
    return {"id": subtask.id, "title": subtask.title, "is_done": subtask.is_done}


# ── Employees list (for assignee dropdown) ────────────────────────────────────

@router.get("/employees")
def list_employees(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    return [{"id": e.id, "name": e.name, "department": e.department} for e in employees]