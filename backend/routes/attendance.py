import os
import logging
import json
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

    if existing:
        existing.punch_in = now
        existing.status = "present"
        existing.source = "manual"
    else:
        attendance = Attendance(
            employee_id=current_employee.id,
            date=today,
            punch_in=now,
            status="present",
            source="manual",
        )
        db.add(attendance)

    db.commit()
    return {"message": "Punched in", "time": now.isoformat()}


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
            "source": attendance.source or "manual",
        }

    if attendance.punch_in:
        return {
            "status": "punched_in",
            "punch_in": attendance.punch_in.isoformat(),
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

    for i, rec in enumerate(records[:3]):
        logger.info(
            "SYNC PAYLOAD DEBUG:\n%s",
            json.dumps({
                "external_employee_id": rec.get("external_employee_id"),
                "attendance_date": rec.get("attendance_date"),
                "in_time": rec.get("in_time"),
                "out_time": rec.get("out_time"),
                "status": rec.get("status"),
            }, indent=2, default=str),
        )

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

            # Parse times — handle both time-only ("10:41:51") and
            # full datetime strings ("2026-06-30 10:41:51") that pyodbc
            # may return from Access MDB DateTime fields.
            punch_in = None
            punch_out = None
            _TIME_FORMATS = ("%H:%M:%S", "%H:%M")
            _DATETIME_FORMATS = ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S.%f")

            def _parse_time_string(ts):
                for fmt in _TIME_FORMATS:
                    try:
                        return datetime.strptime(ts, fmt).time()
                    except ValueError:
                        continue
                for fmt in _DATETIME_FORMATS:
                    try:
                        return datetime.strptime(ts, fmt).time()
                    except ValueError:
                        continue
                return None

            if in_time_str:
                in_time_clean = str(in_time_str).strip()
                t = _parse_time_string(in_time_clean)
                if t:
                    punch_in = datetime.combine(att_date, t)
                else:
                    logger.warning(
                        "PARSE FAIL in_time: raw=%r type=%s cleaned=%r",
                        in_time_str, type(in_time_str).__name__, in_time_clean,
                    )

            if out_time_str:
                out_time_clean = str(out_time_str).strip()
                t = _parse_time_string(out_time_clean)
                if t:
                    punch_out = datetime.combine(att_date, t)
                else:
                    logger.warning(
                        "PARSE FAIL out_time: raw=%r type=%s cleaned=%r",
                        out_time_str, type(out_time_str).__name__, out_time_clean,
                    )

            # Calculate hours worked
            hours_worked = None
            if punch_in and punch_out:
                hours_worked = round((punch_out - punch_in).total_seconds() / 3600, 2)

            # Log first 3 records for diagnostics
            if created + updated < 3:
                logger.info(
                    "RECORD DEBUG: emp=%s date=%s in_raw=%r punch_in=%s out_raw=%r punch_out=%s hours=%s",
                    employee_id, att_date, in_time_str, punch_in, out_time_str, punch_out, hours_worked,
                )

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
                # Update existing record — use `is not None` to avoid dropping 0.0 values
                if punch_in is not None:
                    existing.punch_in = punch_in
                if punch_out is not None:
                    existing.punch_out = punch_out
                if hours_worked is not None:
                    existing.hours_worked = hours_worked
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

    logger.info(
        "Sync complete: processed=%d created=%d updated=%d unmapped=%d errors=%d",
        len(records), created, updated, unmapped, errors,
    )

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
