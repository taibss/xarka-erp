from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models.announcement import Announcement
from models.announcement_read import AnnouncementRead
from models.employee import Employee
from utils.auth_utils import get_current_employee
from services.notify import send_email

router = APIRouter()


class AnnouncementCreate(BaseModel):
    title: str
    body: str


@router.post("/announcements")
def create_announcement(
    data: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    announcement = Announcement(
        title=data.title,
        body=data.body,
        created_by=current_employee.id,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    for emp in employees:
        if emp.id == current_employee.id:
            continue
        send_email(
            to=emp.email,
            subject=f"Announcement — {data.title}",
            body=f"{data.body}\n\nFrom Xarka Management",
        )

    return {
        "id": announcement.id,
        "title": announcement.title,
        "body": announcement.body,
        "created_by": current_employee.name,
        "is_active": announcement.is_active,
        "created_at": announcement.created_at,
    }


@router.get("/announcements")
def get_announcements(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    announcements = db.query(Announcement).filter(
        Announcement.is_active == True
    ).order_by(Announcement.created_at.desc()).all()

    read_ids = {
        r.announcement_id for r in db.query(AnnouncementRead).filter(
            AnnouncementRead.employee_id == current_employee.id
        ).all()
    }

    result = []
    for a in announcements:
        creator = db.query(Employee).filter(Employee.id == a.created_by).first()
        result.append({
            "id": a.id,
            "title": a.title,
            "body": a.body,
            "created_by": creator.name if creator else None,
            "is_read": a.id in read_ids,
            "created_at": a.created_at,
        })

    return result


@router.post("/announcements/{announcement_id}/read")
def mark_read(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    existing = db.query(AnnouncementRead).filter(
        AnnouncementRead.announcement_id == announcement_id,
        AnnouncementRead.employee_id == current_employee.id,
    ).first()

    if not existing:
        read_record = AnnouncementRead(
            announcement_id=announcement_id,
            employee_id=current_employee.id,
        )
        db.add(read_record)
        db.commit()

    return {"message": "Marked as read"}


@router.delete("/announcements/{announcement_id}")
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    announcement.is_active = False
    db.commit()

    return {"message": "Announcement deleted"}
