from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.employee import Employee
from utils.auth_utils import verify_password, create_access_token, get_current_employee
from services.notify import send_email
from pydantic import BaseModel
from datetime import datetime, timedelta

router = APIRouter()

# In-memory failed-login tracker: { email: [attempt_datetime, ...] }
# Safe because this backend runs as a single gunicorn worker.
_failed_login_attempts = {}

MAX_ATTEMPTS = 5
LOCKOUT_WINDOW_MINUTES = 5


def _check_rate_limit(email: str):
    """Raise 429 if this email has too many recent failed attempts."""
    now = datetime.utcnow()
    attempts = _failed_login_attempts.get(email, [])
    attempts = [a for a in attempts if now - a < timedelta(minutes=LOCKOUT_WINDOW_MINUTES)]
    _failed_login_attempts[email] = attempts
    if len(attempts) >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed login attempts. Try again in {LOCKOUT_WINDOW_MINUTES} minutes."
        )


def _record_failed_attempt(email: str):
    now = datetime.utcnow()
    _failed_login_attempts.setdefault(email, []).append(now)


def _clear_failed_attempts(email: str):
    _failed_login_attempts.pop(email, None)


class LoginInput(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    _check_rate_limit(data.email)
    employee = db.query(Employee).filter(Employee.email == data.email).first()
    if not employee:
        _record_failed_attempt(data.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(data.password, employee.password_hash):
        _record_failed_attempt(data.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not employee.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact admin.")

    _clear_failed_attempts(data.email)
    token = create_access_token({"sub": employee.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "employee": {
            "id": employee.id,
            "name": employee.name,
            "email": employee.email,
            "role": employee.role,
            "department": employee.department,
        },
    }


@router.get("/auth/me")
def get_me(current_employee: Employee = Depends(get_current_employee)):
    return {
        "id": current_employee.id,
        "name": current_employee.name,
        "email": current_employee.email,
        "role": current_employee.role,
        "department": current_employee.department,
        "phone": current_employee.phone,
        "joining_date": current_employee.joining_date,
        "is_active": current_employee.is_active,
    }


@router.get("/test-email")
def test_email(current_employee: Employee = Depends(get_current_employee)):
    send_email(
        to=current_employee.email,
        subject="Test email from Xarka ERP",
        body=f"Hi {current_employee.name},\n\nThis is a test email from Xarka ERP.\nMicrosoft Graph API is working correctly!\n\nXarka ERP",
    )
    return {"message": "Test email sent — check your inbox!"}
