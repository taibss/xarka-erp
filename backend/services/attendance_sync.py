"""
Attendance Sync Service
========================

Orchestrates attendance data synchronization from biometric providers
to the Xarka ERP attendance table.

This is the main entry point for triggering a sync. It:
    1. Instantiates the correct provider (e.g., ESSLProvider).
    2. Fetches punch records from the device/MDB.
    3. Maps external employee codes to Xarka employee IDs.
    4. Creates or updates attendance records in PostgreSQL.
    5. Returns a sync summary.

Phase 2 implementation notes:
    - This service is called by the scheduler or manually by admin.
    - Only runs when attendance_source setting is set to a biometric provider.
    - The sync is idempotent: re-running for the same date range
      updates existing records instead of creating duplicates.
    - Unmapped employees are skipped and logged as warnings.
    - Errors are collected and returned, not raised as exceptions.

NOT implemented yet:
    - Actual sync logic
    - Provider instantiation and data fetching
    - Attendance record creation from biometric punches
"""

from datetime import date, datetime
from typing import Optional, List, Dict
from sqlalchemy.orm import Session

from models.attendance import Attendance
from models.biometric_mapping import EmployeeBiometricMapping


def sync_biometric_attendance(
    db: Session,
    provider_name: str,
    sync_date: Optional[date] = None,
) -> dict:
    """
    Sync attendance data from a biometric provider for a given date.

    TODO Phase 2 — Implementation steps:
        1. Validate that provider_name is a known provider.
        2. Instantiate the provider: provider = get_provider(provider_name)
        3. Connect to the device/MDB: provider.connect()
        4. Fetch punch records for sync_date (default: today).
        5. Load all active biometric mappings for this provider:
           mappings = db.query(EmployeeBiometricMapping).filter(
               EmployeeBiometricMapping.provider == provider_name,
               EmployeeBiometricMapping.is_active == True,
           ).all()
           code_to_emp = {m.external_employee_code: m.employee_id for m in mappings}
        6. For each punch record:
           a. Look up employee_id from code_to_emp using punch.employee_code.
           b. If not found, add to skipped list and continue.
           c. Find or create Attendance record for (employee_id, sync_date).
           d. If this is the first punch of the day, set punch_in.
           e. If this is a later punch, update punch_out.
           f. Calculate hours_worked from punch_in to punch_out.
           g. Set source = provider_name, synced_at = datetime.utcnow().
        7. Commit all changes.
        8. Disconnect from provider.
        9. Return summary dict.

    Args:
        db: SQLAlchemy database session.
        provider_name: Name of the biometric provider (e.g., 'essl').
        sync_date: Date to sync. Defaults to today.

    Returns:
        Dict with sync results:
        {
            "synced": int,       # Number of attendance records created/updated
            "skipped": int,      # Number of punch records skipped (unmapped)
            "errors": list,      # List of error strings
            "message": str,      # Human-readable summary
        }
    """
    # Phase 2: Implement actual sync logic
    return {
        "synced": 0,
        "skipped": 0,
        "errors": [],
        "message": "Sync not yet implemented. Phase 2 — requires pyodbc + MDB connectivity.",
    }


def sync_date_range(
    db: Session,
    provider_name: str,
    start_date: date,
    end_date: date,
) -> dict:
    """
    Sync attendance for a range of dates.

    TODO Phase 2:
        1. Iterate from start_date to end_date.
        2. Call sync_biometric_attendance() for each date.
        3. Aggregate results across all dates.
        4. Return combined summary.

    Args:
        db: SQLAlchemy database session.
        provider_name: Name of the biometric provider.
        start_date: First date to sync (inclusive).
        end_date: Last date to sync (inclusive).

    Returns:
        Aggregated sync summary dict.
    """
    # Phase 2: Implement date range sync
    return {
        "synced": 0,
        "skipped": 0,
        "errors": [],
        "dates_synced": 0,
        "message": "Date range sync not yet implemented. Phase 2.",
    }


def get_attendance_source(db: Session, employee_id: int, attendance_date: date) -> str:
    """
    Get the source of attendance data for a specific employee/date.

    Returns 'manual' if no record exists or source is not set.
    """
    record = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date == attendance_date,
    ).first()
    return record.source if record else "manual"


def get_sync_status(db: Session, provider_name: str) -> dict:
    """
    Get the last sync status for a provider.

    TODO Phase 2:
        - Could be stored in integration_settings or a dedicated sync_log table.
        - For now, return a stub.

    Returns:
        Dict with keys: last_sync_at, last_sync_result, is_configured.
    """
    # Phase 2: Implement sync status tracking
    return {
        "provider": provider_name,
        "last_sync_at": None,
        "last_sync_result": None,
        "is_configured": False,
        "message": "Sync status tracking not yet implemented.",
    }
