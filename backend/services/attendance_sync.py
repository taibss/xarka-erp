"""
Attendance Sync Service

Handles syncing attendance records from external providers (eSSL biometric)
to the Xarka attendance table.

Phase 2: Implement actual sync logic.
"""
from datetime import date, datetime
from typing import Optional
from sqlalchemy.orm import Session

from models.attendance import Attendance
from models.biometric_mapping import EmployeeBiometricMapping


def sync_biometric_attendance(
    db: Session,
    provider_name: str,
    sync_date: Optional[date] = None,
) -> dict:
    """
    Sync attendance data from a biometric provider.

    Phase 2: Implement actual sync.
    Currently returns a stub response.

    Returns:
        dict with sync results: { synced: int, skipped: int, errors: list }
    """
    # Phase 2 implementation:
    #
    # 1. Get provider instance
    #    provider = get_provider(provider_name)
    #    provider.connect()
    #
    # 2. Get punch records from device
    #    target_date = sync_date or date.today()
    #    punches = provider.get_punches(target_date, target_date)
    #
    # 3. Map external employee codes to Xarka employee IDs
    #    mappings = db.query(EmployeeBiometricMapping).filter(
    #        EmployeeBiometricMapping.provider == provider_name,
    #        EmployeeBiometricMapping.is_active == True
    #    ).all()
    #    code_to_emp = {m.external_employee_code: m.employee_id for m in mappings}
    #
    # 4. Create/update attendance records
    #    for punch in punches:
    #        emp_id = code_to_emp.get(punch.employee_code)
    #        if not emp_id:
    #            continue
    #        # Find or create attendance record for this employee/date
    #        # Set punch_in (first punch) or punch_out (last punch)
    #        # Calculate hours_worked, late_by, early_by
    #        # Set source = provider_name, synced_at = now
    #
    # 5. Disconnect
    #    provider.disconnect()
    #
    # 6. Return summary

    return {
        "synced": 0,
        "skipped": 0,
        "errors": [],
        "message": "Sync not yet implemented. Phase 2.",
    }


def get_attendance_source(db: Session, employee_id: int, attendance_date: date) -> str:
    """Get the source of attendance data for a specific employee/date."""
    record = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date == attendance_date,
    ).first()
    return record.source if record else "manual"
