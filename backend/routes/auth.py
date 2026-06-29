from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.employee import Employee
from utils.auth_utils import hash_password, verify_password, create_access_token, get_current_employee, require_admin
from services.notify import send_email
from pydantic import BaseModel
from typing import Optional
from datetime import date
import secrets
import string

router = APIRouter()


class EmployeeCreateInput(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    designation_id: Optional[int] = None
    manager_id: Optional[int] = None
    role: Optional[str] = "employee"
    joining_date: Optional[date] = None


class LoginInput(BaseModel):
    email: str
    password: str


def generate_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%&*"
    return ''.join(secrets.choice(chars) for _ in range(length))


@router.post("/auth/register")
def register_admin_create(
    data: EmployeeCreateInput,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    existing = db.query(Employee).filter(Employee.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    password = generate_password()
    employee = Employee(
        name=data.name,
        email=data.email,
        password_hash=hash_password(password),
        role="employee",
        department=data.department,
        department_id=data.department_id,
        designation=data.designation,
        designation_id=data.designation_id,
        manager_id=data.manager_id,
        phone=data.phone,
        joining_date=data.joining_date,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    send_email(
        to=employee.email,
        subject="Welcome to Xarka ERP",
        body=(
            f"Hi {employee.name},\n\n"
            f"Your account has been created.\n\n"
            f"Email: {employee.email}\n"
            f"Password: {password}\n\n"
            f"Please log in and change your password.\n\n"
            f"Xarka ERP"
        ),
    )

    return {
        "message": "Employee created successfully",
        "id": employee.id,
        "name": employee.name,
        "email": employee.email,
        "role": employee.role,
        "temporary_password": password,
    }


@router.post("/auth/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.email == data.email).first()
    if not employee:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(data.password, employee.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not employee.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact admin.")

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
