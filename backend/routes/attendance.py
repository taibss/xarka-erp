import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models.attendance import Attendance
from models.employee import Employee
from utils.auth_utils import get_current_employee, require_admin
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

WORK_START_HOUR = 10
LATE_THRESHOLD_HOUR = 11
LATE_THRESHOLD_MINUTE = 30  # late if punch_in after 11:30am


@router.post("/attendance/punchin")
def punch_in(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    today = date.today()
    existing = db.query(Attendance).filter(
        Attendance.employee_id == current_employee.id,
        Attendance.date == today,
    ).first()

    if existing and existing.punch_in:
        raise HTTPException(status_code=400, detail="Already punched in today")

    now = datetime.utcnow()
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = datetime.now(timezone(ist_offset))
    is_late = now_ist.hour > LATE_THRESHOLD_HOUR or (now_ist.hour == LATE_THRESHOLD_HOUR and now_ist.minute > LATE_THRESHOLD_MINUTE)

    late_by = None
    if is_late:
        work_start = now_ist.replace(hour=LATE_THRESHOLD_HOUR, minute=LATE_THRESHOLD_MINUTE, second=0, microsecond=0)
        late_by = round((now_ist - work_start).total_seconds() / 60, 1)

    if existing:
        existing.punch_in = now
        existing.is_late = is_late
        existing.late_by = late_by
        existing.status = "present"
        existing.source = "manual"
    else:
        attendance = Attendance(
            employee_id=current_employee.id,
            date=today,
            punch_in=now,
            is_late=is_late,
            late_by=late_by,
            status="present",
            source="manual",
        )
        db.add(attendance)

    db.commit()
    return {"message": "Punched in", "time": now.isoformat(), "is_late": is_late}


@router.post("/attendance/punchout")
def punch_out(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    today = date.today()
    attendance = db.query(Attendance).filter(
        Attendance.employee_id == current_employee.id,
        Attendance.date == today,
    ).first()

    if not attendance or not attendance.punch_in:
        raise HTTPException(status_code=400, detail="No punch in record today")
    if attendance.punch_out:
        raise HTTPException(status_code=400, detail="Already punched out today")

    now = datetime.utcnow()
    attendance.punch_out = now
    attendance.hours_worked = round((now - attendance.punch_in).total_seconds() / 3600, 2)

    # Calculate early departure (assuming work ends at 19:00 IST)
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = datetime.now(timezone(ist_offset))
    work_end_hour = 19
    if now_ist.hour < work_end_hour:
        early_by = round((work_end_hour * 60 - (now_ist.hour * 60 + now_ist.minute)) / 60, 1)
        attendance.early_by = early_by

    db.commit()

    return {
        "message": "Punched out",
        "time": now.isoformat(),
        "hours_worked": attendance.hours_worked,
    }


@router.get("/attendance/today")
def get_today(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    today = date.today()
    attendance = db.query(Attendance).filter(
        Attendance.employee_id == current_employee.id,
        Attendance.date == today,
    ).first()

    if not attendance:
        return {"status": "not_punched"}

    if attendance.punch_in and attendance.punch_out:
        return {
            "status": "punched_out",
            "punch_in": attendance.punch_in.isoformat(),
            "punch_out": attendance.punch_out.isoformat(),
            "hours_worked": attendance.hours_worked,
            "is_late": attendance.is_late,
            "source": attendance.source or "manual",
        }

    if attendance.punch_in:
        return {
            "status": "punched_in",
            "punch_in": attendance.punch_in.isoformat(),
            "is_late": attendance.is_late,
            "source": attendance.source or "manual",
        }

    return {"status": "not_punched"}


@router.get("/attendance/history")
def get_history(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    thirty_days_ago = date.today() - timedelta(days=30)
    records = db.query(Attendance).filter(
        Attendance.employee_id == current_employee.id,
        Attendance.date >= thirty_days_ago,
    ).order_by(Attendance.date.desc()).all()

    return [
        {
            "id": r.id,
            "date": r.date.isoformat(),
            "punch_in": r.punch_in.isoformat() if r.punch_in else None,
            "punch_out": r.punch_out.isoformat() if r.punch_out else None,
            "hours_worked": r.hours_worked,
            "is_late": r.is_late,
            "source": r.source or "manual",
            "synced_at": r.synced_at.isoformat() if r.synced_at else None,
        }
        for r in records
    ]


@router.get("/attendance/admin")
def admin_view(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):

    today = date.today()
    records = db.query(Attendance).filter(Attendance.date == today).all()

    result = []
    for r in records:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        result.append({
            "employee": emp.name if emp else "Unknown",
            "punch_in": r.punch_in.isoformat() if r.punch_in else None,
            "punch_out": r.punch_out.isoformat() if r.punch_out else None,
            "hours_worked": r.hours_worked,
            "is_late": r.is_late,
            "is_in_office": r.punch_in and not r.punch_out,
            "source": r.source or "manual",
            "synced_at": r.synced_at.isoformat() if r.synced_at else None,
        })

    return result


@router.get("/attendance/admin/employees")
def admin_list_employees(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):

    employees = db.query(Employee).filter(Employee.is_active == True).all()
    return [{"id": e.id, "name": e.name, "email": e.email} for e in employees]


@router.get("/attendance/admin/{employee_id}")
def admin_employee_history(
    employee_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):

    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    thirty_days_ago = date.today() - timedelta(days=30)
    records = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date >= thirty_days_ago,
    ).order_by(Attendance.date.desc()).all()

    return {
        "employee": {"id": emp.id, "name": emp.name, "email": emp.email},
        "records": [
            {
                "id": r.id,
                "date": r.date.isoformat(),
                "punch_in": r.punch_in.isoformat() if r.punch_in else None,
                "punch_out": r.punch_out.isoformat() if r.punch_out else None,
                "hours_worked": r.hours_worked,
                "is_late": r.is_late,
                "source": r.source or "manual",
                "synced_at": r.synced_at.isoformat() if r.synced_at else None,
            }
            for r in records
        ],
    }


# ── Biometric Sync Endpoint ──────────────────────────────────────────────


class SyncBiometricRequest(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    test_mode: bool = False
    test_records: Optional[List[dict]] = None


class SyncBiometricResponse(BaseModel):
    success: bool
    imported: int
    duplicates: int
    unmapped: int
    errors: int
    details: List[dict]


@router.post("/attendance/sync")
def sync_attendance(
    body: dict,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    """
    Sync attendance records from external biometric system (eSSL).

    Accepts pre-parsed attendance records and creates/updates ERP attendance.
    The Windows sync agent reads the MDB and posts records to this endpoint.

    Authentication: Admin JWT required.

    Request body:
        {
            "records": [
                {
                    "external_employee_id": 2533,
                    "attendance_date": "2026-06-30",
                    "in_time": "10:41:51",
                    "out_time": "18:05:46",
                    "status": "Present"
                }
            ]
        }

    Processing:
        1. Resolve employee via employee_biometric_mapping
        2. Create new attendance or update existing (unique: employee_id + date)
        3. Store source='essl'

    Response:
        {
            "success": true,
            "processed": 15,
            "created": 10,
            "updated": 3,
            "unmapped": 1,
            "errors": 1
        }
    """
    from models.biometric_mapping import EmployeeBiometricMapping

    records = body.get("records", [])
    if not records:
        raise HTTPException(status_code=400, detail="No records provided")

    # Build mapping lookup: external_employee_id -> employee_id
    mappings = (
        db.query(EmployeeBiometricMapping)
        .filter(
            EmployeeBiometricMapping.provider == "essl",
            EmployeeBiometricMapping.is_active == True,
        )
        .all()
    )
    mapping_lookup = {str(m.external_employee_id): m.employee_id for m in mappings}

    created = 0
    updated = 0
    unmapped = 0
    unmapped_records = []
    errors = 0

    for rec in records:
        try:
            ext_id = str(rec.get("external_employee_id", ""))
            att_date_str = rec.get("attendance_date")
            in_time_str = rec.get("in_time")
            out_time_str = rec.get("out_time")
            status = rec.get("status", "Present")

            # Resolve employee
            employee_id = mapping_lookup.get(ext_id)
            if not employee_id:
                unmapped += 1
                unmapped_records.append({
                    "external_employee_id": ext_id,
                    "attendance_date": att_date_str,
                })
                continue

            # Parse date
            try:
                att_date = datetime.strptime(att_date_str, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                errors += 1
                continue

            # Parse times
            punch_in = None
            punch_out = None
            if in_time_str:
                try:
                    t = datetime.strptime(in_time_str, "%H:%M:%S").time()
                    punch_in = datetime.combine(att_date, t)
                except ValueError:
                    try:
                        t = datetime.strptime(in_time_str, "%H:%M").time()
                        punch_in = datetime.combine(att_date, t)
                    except ValueError:
                        pass

            if out_time_str:
                try:
                    t = datetime.strptime(out_time_str, "%H:%M:%S").time()
                    punch_out = datetime.combine(att_date, t)
                except ValueError:
                    try:
                        t = datetime.strptime(out_time_str, "%H:%M").time()
                        punch_out = datetime.combine(att_date, t)
                    except ValueError:
                        pass

            # Calculate hours worked
            hours_worked = None
            if punch_in and punch_out:
                hours_worked = round((punch_out - punch_in).total_seconds() / 3600, 2)

            # Check for existing record (unique: employee_id + date)
            existing = (
                db.query(Attendance)
                .filter(
                    Attendance.employee_id == employee_id,
                    Attendance.date == att_date,
                )
                .first()
            )

            if existing:
                # Update existing record
                existing.punch_in = punch_in or existing.punch_in
                existing.punch_out = punch_out or existing.punch_out
                existing.hours_worked = hours_worked or existing.hours_worked
                existing.status = status.lower() if status else existing.status
                existing.source = "essl"
                existing.source_employee_id = ext_id
                existing.synced_at = datetime.utcnow()
                updated += 1
            else:
                # Create new record
                attendance = Attendance(
                    employee_id=employee_id,
                    date=att_date,
                    status=status.lower() if status else "present",
                    punch_in=punch_in,
                    punch_out=punch_out,
                    hours_worked=hours_worked,
                    source="essl",
                    source_employee_id=ext_id,
                    synced_at=datetime.utcnow(),
                )
                db.add(attendance)
                created += 1

        except Exception as e:
            errors += 1
            logger.error("Error processing record: %s", e)

    db.commit()

    return {
        "success": True,
        "processed": len(records),
        "created": created,
        "updated": updated,
        "unmapped": unmapped,
        "errors": errors,
        "unmapped_records": unmapped_records,
    }


@router.post("/attendance/sync-biometric")
def sync_biometric(
    body: SyncBiometricRequest = None,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
):
    """
    Manual biometric sync endpoint.

    Triggers a sync from eTimeTrackLite MDB → Xarka attendance table.

    Flow:
        1. Connect to MDB (or use test records)
        2. Read AttendanceLogs
        3. Resolve EmployeeId via employee_biometric_mapping
        4. Import using import_attendance() (with duplicate detection)

    Admin only. No automatic scheduling. No background jobs.
    """
    from services.essl_sync import ESSLSync

    logger.info(
        "Biometric sync triggered by admin %s (id=%d)",
        current_employee.email, current_employee.id,
    )

    # Parse date range
    start_date = None
    end_date = None
    if body and body.start_date:
        try:
            start_date = datetime.strptime(body.start_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD.")
    if body and body.end_date:
        try:
            end_date = datetime.strptime(body.end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD.")

    # Get MDB path from environment
    mdb_path = os.getenv("ESSL_MDB_PATH")

    test_mode = body.test_mode if body else False
    test_records = body.test_records if body else None

    # Initialize sync service
    sync = ESSLSync(mdb_path=mdb_path)

    resolved_records = []

    if test_mode:
        # Test mode: use injected records
        logger.info("Test mode: using %d injected records", len(test_records or []))
        if not test_records:
            raise HTTPException(
                status_code=400,
                detail="test_mode=true requires test_records array in request body.",
            )

        # Resolve mappings for test records
        mapping_lookup = sync._build_mapping_lookup(db)
        for log in test_records:
            ext_id = str(log.get("employee_id", ""))
            mapping = mapping_lookup.get(ext_id)
            resolved_records.append({
                "attendance_date": str(log.get("attendance_date", "")),
                "external_employee_id": ext_id,
                "in_time": log.get("in_time"),
                "out_time": log.get("out_time"),
                "duration": log.get("duration"),
                "late_by": log.get("late_by", 0),
                "early_by": log.get("early_by", 0),
                "status": log.get("status", "Present"),
                "present": bool(log.get("present", 1)),
                "absent": bool(log.get("absent", 0)),
                "mapped": mapping is not None,
                "employee_id": mapping["employee_id"] if mapping else None,
                "employee_name": mapping["employee_name"] if mapping else None,
            })
    else:
        # Production mode: read from MDB
        if not mdb_path:
            raise HTTPException(
                status_code=400,
                detail=(
                    "ESSL_MDB_PATH environment variable not set. "
                    "Configure the path to the eTimeTrackLite .mdb file. "
                    "Or use test_mode=true with test_records."
                ),
            )

        try:
            connected = sync.connect()
            if not connected:
                raise HTTPException(
                    status_code=500,
                    detail="MDB connection returned False. Check MDB path and ODBC driver.",
                )
        except NotImplementedError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Cannot connect to MDB: {e}",
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"MDB connection failed: {e}",
            )

        try:
            resolved_records = sync.read_attendance_logs(db, start_date, end_date)
        finally:
            sync.disconnect()

    # Import attendance
    summary = sync.import_attendance(db, resolved_records)

    # Log results
    logger.info(
        "Sync complete: imported=%d, duplicates=%d, unmapped=%d, errors=%d",
        summary["imported"],
        summary["skipped_duplicate"],
        summary["skipped_unmapped"],
        len(summary["errors"]),
    )

    for record in summary["records"]:
        logger.info(
            "Imported: employee_id=%s date=%s ext_id=%s",
            record["employee_id"],
            record["date"],
            record["source_employee_id"],
        )

    for error in summary["errors"]:
        logger.error("Sync error: %s", error)

    return SyncBiometricResponse(
        success=True,
        imported=summary["imported"],
        duplicates=summary["skipped_duplicate"],
        unmapped=summary["skipped_unmapped"],
        errors=len(summary["errors"]),
        details=summary["records"],
    )
