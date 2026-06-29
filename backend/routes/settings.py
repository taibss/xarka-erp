from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models.employee import Employee
from models.integration_settings import IntegrationSettings
from utils.auth_utils import get_current_employee

router = APIRouter()


class AttendanceSourceUpdate(BaseModel):
    source: str  # manual, essl


@router.get("/settings/attendance")
def get_attendance_settings(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    source = db.query(IntegrationSettings).filter(
        IntegrationSettings.key == "attendance_source"
    ).first()

    device_ip = db.query(IntegrationSettings).filter(
        IntegrationSettings.key == "essl_device_ip"
    ).first()

    device_port = db.query(IntegrationSettings).filter(
        IntegrationSettings.key == "essl_device_port"
    ).first()

    return {
        "attendance_source": source.value if source else "manual",
        "essl_device_ip": device_ip.value if device_ip else "192.168.1.100",
        "essl_device_port": int(device_port.value) if device_port else 4370,
        "essl_available": False,  # Phase 2: set to True when provider is implemented
    }


@router.put("/settings/attendance")
def update_attendance_settings(
    data: AttendanceSourceUpdate,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if data.source not in ("manual", "essl"):
        raise HTTPException(status_code=400, detail="Invalid source. Must be 'manual' or 'essl'.")

    if data.source == "essl":
        raise HTTPException(
            status_code=400,
            detail="eSSL integration is not yet available. Coming in Phase 2.",
        )

    setting = db.query(IntegrationSettings).filter(
        IntegrationSettings.key == "attendance_source"
    ).first()

    if setting:
        setting.value = data.source
    else:
        setting = IntegrationSettings(
            key="attendance_source",
            value=data.source,
            description="Attendance data source: manual or essl",
        )
        db.add(setting)

    db.commit()
    return {"message": "Settings updated", "attendance_source": data.source}
