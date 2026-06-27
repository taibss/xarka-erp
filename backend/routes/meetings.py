from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_db
from models.meeting import Meeting
from models.meeting_attendee import MeetingAttendee
from models.task import Task
from models.employee import Employee
from utils.auth_utils import get_current_employee
from services.notify import send_email, create_notification
from services.calendar import create_calendar_event, delete_calendar_event

router = APIRouter()


class MeetingCreate(BaseModel):
    title: str
    agenda: Optional[str] = None
    meeting_time: datetime
    duration_minutes: Optional[int] = 60
    attendee_ids: List[int] = []


class MeetingNotes(BaseModel):
    notes: str
    action_items: Optional[List[str]] = None


def _serialize_meeting(meeting: Meeting, db: Session) -> dict:
    creator = db.query(Employee).filter(Employee.id == meeting.created_by).first()
    attendees = db.query(Employee).join(
        MeetingAttendee, MeetingAttendee.employee_id == Employee.id
    ).filter(MeetingAttendee.meeting_id == meeting.id).all()

    return {
        "id": meeting.id,
        "title": meeting.title,
        "agenda": meeting.agenda,
        "meeting_time": meeting.meeting_time,
        "duration_minutes": meeting.duration_minutes,
        "created_by": {"id": creator.id, "name": creator.name} if creator else None,
        "notes": meeting.notes,
        "created_at": meeting.created_at,
        "attendees": [{"id": a.id, "name": a.name, "email": a.email} for a in attendees],
    }


@router.post("/meetings")
def create_meeting(
    data: MeetingCreate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    meeting = Meeting(
        title=data.title,
        agenda=data.agenda,
        meeting_time=data.meeting_time,
        duration_minutes=data.duration_minutes,
        created_by=current_employee.id,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    for emp_id in data.attendee_ids:
        attendee = MeetingAttendee(meeting_id=meeting.id, employee_id=emp_id)
        db.add(attendee)
    db.commit()

    for emp_id in data.attendee_ids:
        emp = db.query(Employee).filter(Employee.id == emp_id).first()
        if emp:
            send_email(
                to=emp.email,
                subject=f"Meeting invite — {data.title}",
                body=f"Hi {emp.name},\n\nYou have been invited to a meeting:\n\nTitle: {data.title}\nTime: {data.meeting_time}\nDuration: {data.duration_minutes} minutes\nAgenda: {data.agenda or 'None'}\n\nXarka ERP",
            )
            create_notification(
                db=db,
                employee_id=emp.id,
                title=f"New meeting: {data.title}",
                message=f"You've been invited to a meeting on {data.meeting_time.strftime('%d %b, %I:%M %p')}",
                notif_type="meeting_invited",
                link="/meetings",
            )

    attendee_emails = []
    for emp_id in data.attendee_ids:
        emp = db.query(Employee).filter(Employee.id == emp_id).first()
        if emp:
            attendee_emails.append(emp.email)

    try:
        event_id = create_calendar_event(
            organizer_email=current_employee.email,
            title=data.title,
            agenda=data.agenda or "",
            meeting_time=str(data.meeting_time),
            duration_minutes=data.duration_minutes,
            attendee_emails=attendee_emails,
        )
        if event_id:
            meeting.calendar_event_id = event_id
            db.commit()
    except Exception as e:
        print(f"Calendar event creation failed: {e}")

    return _serialize_meeting(meeting, db)


@router.get("/meetings")
def get_meetings(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    meeting_ids = {m[0] for m in db.query(MeetingAttendee.meeting_id).filter(
        MeetingAttendee.employee_id == current_employee.id
    ).all()}

    meetings = db.query(Meeting).filter(
        (Meeting.created_by == current_employee.id) | (Meeting.id.in_(meeting_ids))
    ).order_by(Meeting.meeting_time.asc()).all()

    return [_serialize_meeting(m, db) for m in meetings]


@router.get("/meetings/{meeting_id}")
def get_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    return _serialize_meeting(meeting, db)


@router.put("/meetings/{meeting_id}/notes")
def update_meeting_notes(
    meeting_id: int,
    data: MeetingNotes,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.created_by != current_employee.id:
        raise HTTPException(status_code=403, detail="Only creator can add notes")

    meeting.notes = data.notes
    db.commit()

    if data.action_items:
        for item in data.action_items:
            task = Task(
                title=item,
                assignee_id=current_employee.id,
                created_by=current_employee.id,
            )
            db.add(task)
        db.commit()

    return _serialize_meeting(meeting, db)


@router.delete("/meetings/{meeting_id}")
def delete_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.created_by != current_employee.id and current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")

    if meeting.calendar_event_id:
        try:
            delete_calendar_event(
                organizer_email=current_employee.email,
                event_id=meeting.calendar_event_id,
            )
        except Exception as e:
            print(f"Calendar event deletion failed: {e}")

    attendees = db.query(Employee).join(
        MeetingAttendee, MeetingAttendee.employee_id == Employee.id
    ).filter(MeetingAttendee.meeting_id == meeting.id).all()

    db.query(MeetingAttendee).filter(MeetingAttendee.meeting_id == meeting.id).delete()
    db.delete(meeting)
    db.commit()

    for emp in attendees:
        send_email(
            to=emp.email,
            subject=f"Meeting cancelled — {meeting.title}",
            body=f"Hi {emp.name},\n\nThe meeting '{meeting.title}' scheduled for {meeting.meeting_time} has been cancelled.\n\nXarka ERP",
        )
        create_notification(
            db=db,
            employee_id=emp.id,
            title=f"Meeting cancelled: {meeting.title}",
            message=f"The meeting on {meeting.meeting_time.strftime('%d %b, %I:%M %p')} has been cancelled",
            notif_type="meeting_cancelled",
            link="/meetings",
        )

    return {"message": "Meeting deleted"}
