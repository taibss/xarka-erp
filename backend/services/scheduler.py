import os
from datetime import datetime, date, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import sessionmaker
from database import engine
from models.task import Task
from models.leave import Leave
from models.employee import Employee
from models.attendance import Attendance
from models.meeting import Meeting
from models.meeting_attendee import MeetingAttendee
from models.integration_settings import IntegrationSettings
from services.notify import send_email

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def daily_digest():
    """Runs at 9:00 AM IST daily. Sends each employee their tasks due today and overdue tasks."""
    db = SessionLocal()
    try:
        today = date.today()
        employees = db.query(Employee).filter(Employee.is_active == True).all()

        for emp in employees:
            due_today = db.query(Task).filter(
                Task.due_date == today,
                Task.status != "done",
                Task.assignee_id == emp.id,
            ).all()

            overdue = db.query(Task).filter(
                Task.due_date < today,
                Task.status != "done",
                Task.assignee_id == emp.id,
            ).all()

            if not due_today and not overdue:
                continue

            tasks_lines = ""
            for t in due_today:
                tasks_lines += f"- {t.title} ({t.priority})\n"

            overdue_lines = ""
            for t in overdue:
                overdue_lines += f"- {t.title} (was due {t.due_date})\n"

            body = f"""Good morning {emp.name}!

Here's your day at a glance:

TASKS DUE TODAY:
{tasks_lines if tasks_lines else "- None\n"}
OVERDUE TASKS:
{overdue_lines if overdue_lines else "- None\n"}
Have a productive day!
Xarka ERP"""

            send_email(emp.email, f"Your day at Xarka — {today}", body)

    except Exception as e:
        print(f"[Scheduler Error] daily_digest: {e}")
    finally:
        db.close()


def punch_in_reminder():
    """Runs at 10:00 AM IST daily. Reminds employees who haven't punched in."""
    db = SessionLocal()
    try:
        today = date.today()
        employees = db.query(Employee).filter(Employee.is_active == True).all()

        for emp in employees:
            attendance = db.query(Attendance).filter(
                Attendance.employee_id == emp.id,
                Attendance.date == today,
            ).first()

            if attendance and attendance.punch_in:
                continue  # already punched in

            body = f"""Hi {emp.name},

You haven't punched in yet today. Please log into Xarka ERP and punch in.

Xarka ERP"""

            send_email(emp.email, "Reminder — Please punch in", body)

    except Exception as e:
        print(f"[Scheduler Error] punch_in_reminder: {e}")
    finally:
        db.close()


def punch_out_reminder():
    """Runs at 6:30 PM IST daily. Reminds employees who haven't punched out."""
    db = SessionLocal()
    try:
        today = date.today()
        employees = db.query(Employee).filter(Employee.is_active == True).all()

        for emp in employees:
            attendance = db.query(Attendance).filter(
                Attendance.employee_id == emp.id,
                Attendance.date == today,
            ).first()

            if not attendance or not attendance.punch_in:
                continue  # didn't punch in at all
            if attendance.punch_out:
                continue  # already punched out

            body = f"""Hi {emp.name},

You haven't punched out yet today. Please log into Xarka ERP and punch out.

Xarka ERP"""

            send_email(emp.email, "Reminder — Please punch out", body)

    except Exception as e:
        print(f"[Scheduler Error] punch_out_reminder: {e}")
    finally:
        db.close()


def meeting_reminder():
    """Runs every 15 minutes. Sends reminder for meetings starting in next 15 minutes."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        window = now + timedelta(minutes=15)

        meetings = db.query(Meeting).filter(
            Meeting.meeting_time > now.replace(tzinfo=None),
            Meeting.meeting_time <= window.replace(tzinfo=None),
        ).all()

        for meeting in meetings:
            attendees = db.query(Employee).join(
                MeetingAttendee, MeetingAttendee.employee_id == Employee.id
            ).filter(MeetingAttendee.meeting_id == meeting.id).all()

            for emp in attendees:
                send_email(
                    to=emp.email,
                    subject=f"Reminder — {meeting.title} starts in 15 minutes",
                    body=f"Hi {emp.name},\n\nYour meeting '{meeting.title}' starts in 15 minutes.\nAgenda: {meeting.agenda or 'None'}\n\nXarka ERP",
                )

    except Exception as e:
        print(f"[Scheduler Error] meeting_reminder: {e}")
    finally:
        db.close()


def sync_health_check():
    """Runs every hour. Alerts if biometric sync hasn't run in too long."""
    db = SessionLocal()
    try:
        setting = db.query(IntegrationSettings).filter(
            IntegrationSettings.key == "last_successful_sync"
        ).first()

        alert_email = os.getenv("SYNC_ALERT_EMAIL")
        if not alert_email:
            return

        threshold_hours = 0.01

        if not setting or not setting.value:
            send_email(
                alert_email,
                "Xarka ERP: No biometric sync recorded yet",
                "The biometric sync agent has never successfully reported in. "
                "Check the Windows PC and sync_agent.py."
            )
            return

        last_sync = datetime.fromisoformat(setting.value)
        hours_since = (datetime.now(timezone.utc) - last_sync).total_seconds() / 3600

        if hours_since > threshold_hours:
            already_alerted = db.query(IntegrationSettings).filter(
                IntegrationSettings.key == "last_sync_alert_sent"
            ).first()
            # Only alert once per stale period, not every hour
            if already_alerted and already_alerted.value == setting.value:
                return

            send_email(
                alert_email,
                "Xarka ERP: Biometric sync is overdue",
                f"No successful sync recorded in {hours_since:.1f} hours "
                f"(last successful sync: {last_sync.isoformat()}). "
                f"Check the Windows PC, sync_agent.py, and Task Scheduler."
            )

            if already_alerted:
                already_alerted.value = setting.value
            else:
                db.add(IntegrationSettings(
                    key="last_sync_alert_sent",
                    value=setting.value,
                    description="Tracks which last_successful_sync value we already alerted on"
                ))
            db.commit()
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(daily_digest, "cron", hour=9, minute=0, id="daily_digest")
    scheduler.add_job(punch_in_reminder, "cron", hour=10, minute=0, id="punch_in_reminder")
    scheduler.add_job(punch_out_reminder, "cron", hour=18, minute=30, id="punch_out_reminder")
    scheduler.add_job(meeting_reminder, "interval", minutes=15, id="meeting_reminder")
    scheduler.add_job(sync_health_check, "cron", minute=0, id="sync_health_check")
    scheduler.start()
    print("[Scheduler] Started — digest at 9:00 AM, punch-in reminder at 10:00 AM, punch-out reminder at 6:30 PM, meeting reminder every 15 min IST, sync health check every hour")
