from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.employee import Employee
from utils.auth_utils import verify_password, create_access_token, get_current_employee
from services.notify import send_email
from pydantic import BaseModel

router = APIRouter()


class LoginInput(BaseModel):
    email: str
    password: str


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
