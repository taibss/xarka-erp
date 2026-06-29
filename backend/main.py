from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import engine
from models.employee import Employee, Base
from models.department import Department
from models.designation import Designation
from models.attendance import Attendance
from models.task import Task, Comment, Subtask
from models.leave import Leave, LeaveBalance
from models.notification import Notification
from models.announcement import Announcement
from models.announcement_read import AnnouncementRead
from models.meeting import Meeting
from models.meeting_attendee import MeetingAttendee
from routes.auth import router as auth_router
from routes.attendance import router as attendance_router
from routes.task import router as tasks_router
from routes.productivity import router as productivity_router
from routes.leave import router as leave_router
from routes.notification import router as notification_router
from routes.admin import router as admin_router
from services.scheduler import start_scheduler
from routes.directory import router as directory_router
from routes.profile import router as profile_router
from routes.announcements import router as announcements_router
from routes.meetings import router as meetings_router
from routes.manager import router as manager_router
from routes.activity import router as activity_router
from models.activity_log import ActivityLog
from models.biometric_mapping import EmployeeBiometricMapping
from models.integration_settings import IntegrationSettings
from routes.settings import router as settings_router
from routes.departments import router as departments_router
from routes.designations import router as designations_router
from routes.employee_management import router as employee_management_router
import os


Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield


app = FastAPI(title="Xarka ERP", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", ""),
]
ALLOWED_ORIGINS = [o for o in ALLOWED_ORIGINS if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(attendance_router)
app.include_router(tasks_router)
app.include_router(productivity_router)
app.include_router(leave_router)
app.include_router(notification_router)
app.include_router(admin_router)
app.include_router(directory_router)
app.include_router(profile_router)
app.include_router(announcements_router)
app.include_router(meetings_router)
app.include_router(manager_router)
app.include_router(activity_router)
app.include_router(settings_router)
app.include_router(departments_router)
app.include_router(designations_router)
app.include_router(employee_management_router)


@app.get("/")
def root():
    return {"message": "Xarka ERP is running!"}
