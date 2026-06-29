from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models.designation import Designation
from models.employee import Employee
from utils.auth_utils import require_admin

router = APIRouter()


class DesignationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    level: Optional[int] = 1


class DesignationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    level: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/designations")
def list_designations(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    desigs = db.query(Designation).order_by(Designation.level, Designation.name).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "description": d.description,
            "level": d.level,
            "is_active": d.is_active,
        }
        for d in desigs
    ]


@router.get("/designations/all")
def list_all_designations(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    desigs = db.query(Designation).filter(Designation.is_active == True).order_by(Designation.level, Designation.name).all()
    return [{"id": d.id, "name": d.name} for d in desigs]


@router.post("/designations")
def create_designation(
    data: DesignationCreate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    existing = db.query(Designation).filter(Designation.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Designation already exists")
    desig = Designation(name=data.name, description=data.description, level=data.level or 1)
    db.add(desig)
    db.commit()
    db.refresh(desig)
    return {"id": desig.id, "name": desig.name, "description": desig.description, "level": desig.level, "is_active": desig.is_active}


@router.put("/designations/{desig_id}")
def update_designation(
    desig_id: int,
    data: DesignationUpdate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    desig = db.query(Designation).filter(Designation.id == desig_id).first()
    if not desig:
        raise HTTPException(status_code=404, detail="Designation not found")
    if data.name is not None:
        dup = db.query(Designation).filter(Designation.name == data.name, Designation.id != desig_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="Designation name already exists")
        desig.name = data.name
    if data.description is not None:
        desig.description = data.description
    if data.level is not None:
        desig.level = data.level
    if data.is_active is not None:
        desig.is_active = data.is_active
    db.commit()
    db.refresh(desig)
    return {"id": desig.id, "name": desig.name, "description": desig.description, "level": desig.level, "is_active": desig.is_active}


@router.delete("/designations/{desig_id}")
def delete_designation(
    desig_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    desig = db.query(Designation).filter(Designation.id == desig_id).first()
    if not desig:
        raise HTTPException(status_code=404, detail="Designation not found")
    active_employees = db.query(Employee).filter(Employee.designation_id == desig_id, Employee.is_active == True).count()
    if active_employees > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {active_employees} employees have this designation")
    desig.is_active = False
    db.commit()
    return {"message": "Designation deactivated"}
