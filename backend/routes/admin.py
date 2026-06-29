from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from database import get_db
from models.employee import Employee
from models.attendance import Attendance
from models.task import Task
from models.leave import Leave
from models.meeting import Meeting
from models.meeting_attendee import MeetingAttendee
from models.announcement import Announcement
from utils.auth_utils import get_current_employee
from datetime import date, datetime, timedelta, timezone
from collections import defaultdict

router = APIRouter()

IST = timezone(timedelta(hours=5, minutes=30))

WEEKDAY_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}


@router.get("/admin/dashboard")
def admin_dashboard(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    now_ist = datetime.now(IST)
    total_employees = db.query(Employee).filter(Employee.is_active == True).count()

    # ── Attendance (today) ────────────────────────────────────────────────────
    today_records = db.query(Attendance).filter(Attendance.date == today).all()
    present_today = len([r for r in today_records if r.punch_in])
    absent_today = total_employees - present_today
    late_today = len([r for r in today_records if r.is_late])
    in_office = len([r for r in today_records if r.punch_in and not r.punch_out])

    # ── Attendance trend (last 30 days) ───────────────────────────────────────
    trend_records = db.query(Attendance).filter(
        Attendance.date >= thirty_days_ago,
        Attendance.date <= today,
    ).all()
    trend_map = {}
    for r in trend_records:
        d = r.date.isoformat()
        if d not in trend_map:
            trend_map[d] = {"date": d, "present": 0, "absent": 0, "late": 0}
        if r.punch_in:
            trend_map[d]["present"] += 1
        if r.is_late:
            trend_map[d]["late"] += 1
    for d_str, vals in trend_map.items():
        vals["absent"] = total_employees - vals["present"]
    attendance_trend = [trend_map[d.isoformat()] for d in
                        [thirty_days_ago + timedelta(days=i) for i in range(31)]
                        if d.isoformat() in trend_map]

    # ── Weekly hours (avg per weekday over last 30 days) ──────────────────────
    weekly_hours_map = defaultdict(list)
    for r in trend_records:
        if r.hours_worked is not None:
            wd = r.date.weekday()
            weekly_hours_map[WEEKDAY_MAP[wd]].append(r.hours_worked)
    weekly_hours = []
    for wd_key in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]:
        hours_list = weekly_hours_map.get(wd_key, [])
        avg = round(sum(hours_list) / len(hours_list), 1) if hours_list else 0
        weekly_hours.append({"day": wd_key, "hours": avg})

    # ── Tasks ─────────────────────────────────────────────────────────────────
    all_tasks = db.query(Task).all()
    tasks_todo = len([t for t in all_tasks if t.status == "todo"])
    tasks_inprogress = len([t for t in all_tasks if t.status == "inprogress"])
    tasks_review = len([t for t in all_tasks if t.status == "review"])
    tasks_done = len([t for t in all_tasks if t.status == "done"])
    overdue_tasks = len([t for t in all_tasks if t.due_date and t.due_date < today and t.status != "done"])

    # ── Active tasks (not done, limit 10) ────────────────────────────────────
    active_tasks_q = db.query(Task).filter(Task.status != "done").order_by(Task.created_at.desc()).limit(10).all()
    active_tasks = []
    for t in active_tasks_q:
        assignee = db.query(Employee).filter(Employee.id == t.assignee_id).first() if t.assignee_id else None
        active_tasks.append({
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "due_date": str(t.due_date) if t.due_date else None,
            "assignee": assignee.name if assignee else "Unassigned",
            "is_overdue": bool(t.due_date and t.due_date < today),
        })

    # ── Productivity leaderboard ──────────────────────────────────────────────
    active_employees = db.query(Employee).filter(Employee.is_active == True).all()
    productivity = []
    for emp in active_employees:
        completed = db.query(Task).filter(Task.assignee_id == emp.id, Task.status == "done").count()
        productivity.append({
            "employee_id": emp.id,
            "name": emp.name,
            "department": emp.department or "General",
            "tasks_completed": completed,
        })
    productivity.sort(key=lambda x: x["tasks_completed"], reverse=True)

    # ── Leaves ────────────────────────────────────────────────────────────────
    pending_leaves = db.query(Leave).filter(Leave.status == "pending").count()
    approved_leaves = db.query(Leave).filter(
        Leave.status == "approved",
        Leave.from_date >= thirty_days_ago,
    ).count()
    rejected_leaves = db.query(Leave).filter(Leave.status == "rejected").count()
    total_leaves_all = pending_leaves + approved_leaves + rejected_leaves

    # ── Recent leave requests (last 5) ────────────────────────────────────────
    recent_leaves_q = db.query(Leave).order_by(Leave.created_at.desc()).limit(5).all()
    recent_leaves = []
    for l in recent_leaves_q:
        emp = db.query(Employee).filter(Employee.id == l.employee_id).first()
        recent_leaves.append({
            "id": l.id,
            "employee": emp.name if emp else "Unknown",
            "leave_type": l.leave_type,
            "days": l.days,
            "from_date": str(l.from_date),
            "to_date": str(l.to_date),
            "status": l.status,
        })

    # ── Employee list with status ─────────────────────────────────────────────
    employees_list = db.query(Employee).filter(Employee.is_active == True).all()
    employees = []
    for emp in employees_list:
        emp_today = db.query(Attendance).filter(
            Attendance.employee_id == emp.id,
            Attendance.date == today,
        ).first()
        emp_tasks = db.query(Task).filter(Task.assignee_id == emp.id, Task.status != "done").count()
        employees.append({
            "id": emp.id,
            "name": emp.name,
            "department": emp.department,
            "role": emp.role,
            "is_in_office": emp_today.punch_in and not emp_today.punch_out if emp_today else False,
            "open_tasks": emp_tasks,
        })

    # ── Upcoming meetings (next 5) ───────────────────────────────────────────
    meetings_q = db.query(Meeting).filter(
        Meeting.meeting_time >= now_ist,
    ).order_by(Meeting.meeting_time.asc()).limit(5).all()
    upcoming_meetings = []
    for m in meetings_q:
        attendees_rows = db.query(MeetingAttendee).filter(MeetingAttendee.meeting_id == m.id).all()
        attendee_names = []
        for a in attendees_rows:
            a_emp = db.query(Employee).filter(Employee.id == a.employee_id).first()
            if a_emp:
                attendee_names.append(a_emp.name)
        creator = db.query(Employee).filter(Employee.id == m.created_by).first()
        upcoming_meetings.append({
            "id": m.id,
            "title": m.title,
            "meeting_time": m.meeting_time.isoformat(),
            "duration_minutes": m.duration_minutes,
            "created_by": creator.name if creator else "Unknown",
            "attendees": attendee_names,
            "attendee_count": len(attendee_names),
        })

    # ── Recent announcements (last 5) ────────────────────────────────────────
    announcements_q = db.query(Announcement).filter(
        Announcement.is_active == True,
    ).order_by(Announcement.created_at.desc()).limit(5).all()
    recent_announcements = []
    for ann in announcements_q:
        creator = db.query(Employee).filter(Employee.id == ann.created_by).first()
        recent_announcements.append({
            "id": ann.id,
            "title": ann.title,
            "body": ann.body[:120] + "..." if len(ann.body or "") > 120 else ann.body,
            "created_by": creator.name if creator else "Unknown",
            "created_at": ann.created_at.isoformat() if ann.created_at else None,
        })

    # ── New employees this month ──────────────────────────────────────────────
    month_start = today.replace(day=1)
    new_employees_month = db.query(Employee).filter(
        Employee.is_active == True,
        Employee.joining_date >= month_start,
    ).count()

    # ── Attendance rate ───────────────────────────────────────────────────────
    attendance_rate = round((present_today / total_employees * 100) if total_employees > 0 else 0)

    return {
        "total_employees": total_employees,
        "new_employees_month": new_employees_month,
        "attendance": {
            "present": present_today,
            "absent": absent_today,
            "late": late_today,
            "in_office": in_office,
            "attendance_rate": attendance_rate,
        },
        "attendance_trend": attendance_trend,
        "weekly_hours": weekly_hours,
        "tasks": {
            "total": len(all_tasks),
            "todo": tasks_todo,
            "inprogress": tasks_inprogress,
            "review": tasks_review,
            "done": tasks_done,
            "overdue": overdue_tasks,
        },
        "active_tasks": active_tasks,
        "productivity": productivity[:10],
        "leaves": {
            "pending": pending_leaves,
            "approved_30d": approved_leaves,
            "rejected": rejected_leaves,
            "total": total_leaves_all,
            "recent": recent_leaves,
        },
        "upcoming_meetings": upcoming_meetings,
        "recent_announcements": recent_announcements,
        "employees": employees,
    }
