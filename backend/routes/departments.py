from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models.department import Department
from models.employee import Employee
from utils.auth_utils import require_admin

router = APIRouter()


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/departments")
def list_departments(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    depts = db.query(Department).order_by(Department.name).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "description": d.description,
            "is_active": d.is_active,
            "employee_count": db.query(Employee).filter(Employee.department_id == d.id, Employee.is_active == True).count(),
        }
        for d in depts
    ]


@router.get("/departments/all")
def list_all_departments(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    depts = db.query(Department).filter(Department.is_active == True).order_by(Department.name).all()
    return [{"id": d.id, "name": d.name} for d in depts]


@router.post("/departments")
def create_department(
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    existing = db.query(Department).filter(Department.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department already exists")
    dept = Department(name=data.name, description=data.description)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"id": dept.id, "name": dept.name, "description": dept.description, "is_active": dept.is_active}


@router.put("/departments/{dept_id}")
def update_department(
    dept_id: int,
    data: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    if data.name is not None:
        dup = db.query(Department).filter(Department.name == data.name, Department.id != dept_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="Department name already exists")
        dept.name = data.name
    if data.description is not None:
        dept.description = data.description
    if data.is_active is not None:
        dept.is_active = data.is_active
    db.commit()
    db.refresh(dept)
    return {"id": dept.id, "name": dept.name, "description": dept.description, "is_active": dept.is_active}


@router.delete("/departments/{dept_id}")
def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    active_employees = db.query(Employee).filter(Employee.department_id == dept_id, Employee.is_active == True).count()
    if active_employees > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {active_employees} active employees in this department")
    dept.is_active = False
    db.commit()
    return {"message": "Department deactivated"}
