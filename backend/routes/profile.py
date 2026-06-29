from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.employee import Employee
from utils.auth_utils import get_current_employee, hash_password, require_admin
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class UpdateProfileInput(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None


class UpdatePasswordInput(BaseModel):
    current_password: str
    new_password: str


@router.get("/profile/me")
def get_my_profile(
    current_employee: Employee = Depends(get_current_employee)
):
    return {
        "id": current_employee.id,
        "name": current_employee.name,
        "email": current_employee.email,
        "department": current_employee.department,
        "role": current_employee.role,
        "phone": current_employee.phone,
        "joining_date": current_employee.joining_date,
        "is_active": current_employee.is_active,
    }


@router.put("/profile/me")
def update_my_profile(
    data: UpdateProfileInput,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee)
):
    if data.name:
        current_employee.name = data.name
    if data.phone:
        current_employee.phone = data.phone
    if data.department:
        current_employee.department = data.department
    db.commit()
    return {"message": "Profile updated successfully"}


@router.put("/profile/password")
def update_password(
    data: UpdatePasswordInput,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee)
):
    from utils.auth_utils import verify_password
    if not verify_password(data.current_password, current_employee.password_hash):
        raise HTTPException(status_code=400, detail="Current password is wrong")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    current_employee.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
