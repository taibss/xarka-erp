from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
from database import get_db
from models.employee import Employee
from models.biometric_mapping import EmployeeBiometricMapping
from utils.auth_utils import require_admin, hash_password
from services.notify import send_email
import secrets
import string

router = APIRouter()


class EmployeeCreate(BaseModel):
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


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    designation_id: Optional[int] = None
    manager_id: Optional[int] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    joining_date: Optional[date] = None


class BiometricMappingInput(BaseModel):
    provider: str = "essl"
    external_employee_id: Optional[str] = None
    external_employee_code: Optional[str] = None


def generate_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%&*"
    return ''.join(secrets.choice(chars) for _ in range(length))


def _serialize_employee(emp: Employee, db: Session) -> dict:
    manager = db.query(Employee).filter(Employee.id == emp.manager_id).first() if emp.manager_id else None
    return {
        "id": emp.id,
        "name": emp.name,
        "email": emp.email,
        "phone": emp.phone,
        "department": emp.department,
        "department_id": emp.department_id,
        "designation": emp.designation,
        "designation_id": emp.designation_id,
        "manager_id": emp.manager_id,
        "manager_name": manager.name if manager else None,
        "role": emp.role,
        "is_active": emp.is_active,
        "joining_date": emp.joining_date,
        "created_at": emp.created_at.isoformat() if emp.created_at else None,
    }


@router.get("/employees")
def list_employees(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    employees = db.query(Employee).order_by(Employee.name).all()
    return [_serialize_employee(e, db) for e in employees]


@router.get("/employees/active")
def list_active_employees(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    employees = db.query(Employee).filter(Employee.is_active == True).order_by(Employee.name).all()
    return [{"id": e.id, "name": e.name, "department": e.department} for e in employees]


@router.get("/employees/{emp_id}")
def get_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    result = _serialize_employee(emp, db)
    mapping = db.query(EmployeeBiometricMapping).filter(EmployeeBiometricMapping.employee_id == emp_id).first()
    if mapping:
        result["biometric"] = {
            "provider": mapping.provider,
            "external_employee_id": mapping.external_employee_id,
            "external_employee_code": mapping.external_employee_code,
            "is_active": mapping.is_active,
        }
    else:
        result["biometric"] = None
    return result


@router.post("/employees")
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    existing = db.query(Employee).filter(Employee.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    password = generate_password()
    emp = Employee(
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
    db.add(emp)
    db.commit()
    db.refresh(emp)

    send_email(
        to=emp.email,
        subject="Welcome to Xarka ERP",
        body=(
            f"Hi {emp.name},\n\n"
            f"Your account has been created.\n\n"
            f"Email: {emp.email}\n"
            f"Password: {password}\n\n"
            f"Please log in and change your password.\n\n"
            f"Xarka ERP"
        ),
    )

    return {**_serialize_employee(emp, db), "temporary_password": password}


@router.put("/employees/{emp_id}")
def update_employee(
    emp_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if data.email is not None and data.email != emp.email:
        dup = db.query(Employee).filter(Employee.email == data.email, Employee.id != emp_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="Email already in use")
        emp.email = data.email
    if data.name is not None:
        emp.name = data.name
    if data.phone is not None:
        emp.phone = data.phone
    if data.department is not None:
        emp.department = data.department
    if data.department_id is not None:
        emp.department_id = data.department_id
    if data.designation is not None:
        emp.designation = data.designation
    if data.designation_id is not None:
        emp.designation_id = data.designation_id
    if data.manager_id is not None:
        emp.manager_id = data.manager_id
    if data.role is not None:
        emp.role = data.role
    if data.is_active is not None:
        emp.is_active = data.is_active
    if data.joining_date is not None:
        emp.joining_date = data.joining_date

    db.commit()
    db.refresh(emp)
    return _serialize_employee(emp, db)


@router.delete("/employees/{emp_id}")
def deactivate_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if emp.id == current_employee.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    emp.is_active = False
    db.commit()
    return {"message": f"Employee {emp.name} deactivated"}


@router.post("/employees/{emp_id}/reactivate")
def reactivate_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.is_active = True
    db.commit()
    return {"message": f"Employee {emp.name} reactivated"}


@router.post("/employees/{emp_id}/reset-password")
def reset_employee_password(
    emp_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    password = generate_password()
    emp.password_hash = hash_password(password)
    db.commit()
    send_email(
        to=emp.email,
        subject="Password Reset — Xarka ERP",
        body=(
            f"Hi {emp.name},\n\n"
            f"Your password has been reset.\n\n"
            f"New Password: {password}\n\n"
            f"Please log in and change your password.\n\n"
            f"Xarka ERP"
        ),
    )
    return {"message": "Password reset", "temporary_password": password}


@router.put("/employees/{emp_id}/biometric")
def upsert_biometric_mapping(
    emp_id: int,
    data: BiometricMappingInput,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    mapping = db.query(EmployeeBiometricMapping).filter(EmployeeBiometricMapping.employee_id == emp_id).first()
    if mapping:
        mapping.provider = data.provider
        mapping.external_employee_id = data.external_employee_id
        mapping.external_employee_code = data.external_employee_code
    else:
        mapping = EmployeeBiometricMapping(
            employee_id=emp_id,
            provider=data.provider,
            external_employee_id=data.external_employee_id,
            external_employee_code=data.external_employee_code,
        )
        db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return {
        "id": mapping.id,
        "employee_id": mapping.employee_id,
        "provider": mapping.provider,
        "external_employee_id": mapping.external_employee_id,
        "external_employee_code": mapping.external_employee_code,
    }
