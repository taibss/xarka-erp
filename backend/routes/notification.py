from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.notification import Notification
from models.employee import Employee
from utils.auth_utils import get_current_employee

router = APIRouter()


@router.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    notifs = db.query(Notification).filter(
        Notification.employee_id == current_employee.id
    ).order_by(Notification.created_at.desc()).limit(50).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "link": n.link,
            "is_read": n.is_read,
            "created_at": n.created_at,
        }
        for n in notifs
    ]


@router.get("/notifications/unread")
def get_unread_count(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    count = db.query(Notification).filter(
        Notification.employee_id == current_employee.id,
        Notification.is_read == False,
    ).count()
    return {"count": count}


@router.patch("/notifications/{notif_id}/read")
def mark_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.employee_id == current_employee.id,
    ).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"ok": True}


@router.patch("/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    db.query(Notification).filter(
        Notification.employee_id == current_employee.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}
