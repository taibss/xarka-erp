"""
ESSL Biometric Sync Service
============================

Connects to eTimeTrackLite MDB database to fetch employee and attendance data.

Architecture:
    eTimeTrackLite (Access MDB on Windows PC)
        |
        v
    ESSLSync service (pyodbc reads MDB)
        |
        v
    PostgreSQL (Xarka ERP attendance table)

Database: eTimeTrackLite uses a Microsoft Access .mdb file.
Tables of interest:
    - Employees (EnrollNumber, Name, Privilege, Enabled)
    - AttendanceLogs schema:
        AttendanceDate, EmployeeId, InTime, OutTime,
        Duration, LateBy, EarlyBy, Status, Present, Absent

Dependencies:
    - pyodbc (Windows only, requires Access ODBC driver)
    - The MDB file is typically at:
      C:\\Program Files\\eTimeTrackLite\\eTimeTrackLite.mdb
      or a custom path configured in integration_settings.

Phase 2a implementation:
    - read_attendance_logs(): reads AttendanceLogs from MDB
    - resolve_mapping(): maps external_employee_id → Xarka employee_id
    - Full pipeline proven end-to-end before writing attendance data
"""

import logging
from datetime import date, datetime, time
from typing import Optional, List, Dict

from sqlalchemy.orm import Session
from sqlalchemy import and_

from models.attendance import Attendance
from models.biometric_mapping import EmployeeBiometricMapping

logger = logging.getLogger(__name__)


class ESSLSync:
    """
    eSSL biometric synchronization service.

    Reads attendance logs from eTimeTrackLite MDB and resolves
    external employee IDs to Xarka employee IDs via the
    employee_biometric_mapping table.
    """

    def __init__(self, mdb_path: Optional[str] = None):
        """
        Initialize the sync service.

        Args:
            mdb_path: Full path to the eTimeTrackLite .mdb file.
                      Example: C:\\Program Files\\eTimeTrackLite\\eTimeTrackLite.mdb
        """
        self.mdb_path = mdb_path
        self._connection = None

    def connect(self) -> bool:
        """
        Open a pyodbc connection to the MDB file.

        Returns:
            True if connected, False otherwise.

        Raises:
            NotImplementedError: If pyodbc is not available (non-Windows).
        """
        try:
            import pyodbc
            conn_str = (
                r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
                rf"DBQ={self.mdb_path};"
            )
            self._connection = pyodbc.connect(conn_str)
            logger.info("Connected to MDB: %s", self.mdb_path)
            return True
        except ImportError:
            logger.error("pyodbc not available — requires Windows + Access ODBC driver")
            raise NotImplementedError(
                "MDB connection requires pyodbc + Access ODBC driver on Windows."
            )
        except Exception as e:
            logger.error("Failed to connect to MDB: %s", e)
            return False

    def disconnect(self) -> None:
        """Close the MDB connection."""
        if self._connection:
            try:
                self._connection.close()
            except Exception:
                pass
            self._connection = None

    def read_attendance_logs(
        self,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[Dict]:
        """
        Read AttendanceLogs from MDB and resolve to Xarka employee IDs.

        AttendanceLogs schema:
            AttendanceDate  — date of the attendance record
            EmployeeId      — device employee ID (maps to external_employee_id)
            InTime          — first punch-in time
            OutTime         — last punch-out time
            Duration        — hours worked (device-calculated)
            LateBy          — minutes late (device-calculated)
            EarlyBy         — minutes left early (device-calculated)
            Status          — attendance status from device
            Present         — 1 if present, 0 otherwise
            Absent          — 1 if absent, 0 otherwise

        Pipeline:
            1. Read raw AttendanceLogs from MDB
            2. Build mapping lookup: external_employee_id → employee_id
            3. For each log record, resolve to Xarka employee
            4. Return parsed + resolved records (no writes)

        Args:
            db: SQLAlchemy database session (for mapping lookup).
            start_date: Filter records from this date (inclusive).
            end_date: Filter records up to this date (inclusive).

        Returns:
            List of resolved attendance records:
            [
                {
                    "attendance_date": "2026-06-30",
                    "employee_id": 6,             # Xarka employee ID
                    "employee_name": "om",
                    "external_employee_id": "2528",
                    "in_time": "09:05:00",
                    "out_time": "18:30:00",
                    "duration": 9.42,
                    "late_by": 5.0,
                    "early_by": 0.0,
                    "status": "Present",
                    "present": True,
                    "absent": False,
                    "mapped": True,
                },
                ...
            ]
        """
        raw_logs = self._fetch_raw_logs(start_date, end_date)
        logger.info("Fetched %d raw AttendanceLogs from MDB", len(raw_logs))

        mapping_lookup = self._build_mapping_lookup(db)
        logger.info("Loaded %d active biometric mappings", len(mapping_lookup))

        resolved = []
        unmapped_count = 0

        for log in raw_logs:
            ext_id = str(log["employee_id"])
            record = {
                "attendance_date": str(log["attendance_date"]),
                "external_employee_id": ext_id,
                "in_time": log["in_time"],
                "out_time": log["out_time"],
                "duration": log["duration"],
                "late_by": log["late_by"],
                "early_by": log["early_by"],
                "status": log["status"],
                "present": bool(log["present"]),
                "absent": bool(log["absent"]),
                "mapped": False,
                "employee_id": None,
                "employee_name": None,
            }

            if ext_id in mapping_lookup:
                mapping = mapping_lookup[ext_id]
                record["employee_id"] = mapping["employee_id"]
                record["employee_name"] = mapping["employee_name"]
                record["mapped"] = True
            else:
                unmapped_count += 1
                logger.warning(
                    "Unmapped external_employee_id=%s on %s — skipping",
                    ext_id, log["attendance_date"],
                )

            resolved.append(record)

        logger.info(
            "Resolution complete: %d total, %d mapped, %d unmapped",
            len(resolved), len(resolved) - unmapped_count, unmapped_count,
        )

        return resolved

    def _fetch_raw_logs(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[Dict]:
        """
        Read raw AttendanceLogs from MDB via pyodbc.

        Expected MDB table: AttendanceLogs
        Columns: AttendanceDate, EmployeeId, InTime, OutTime,
                 Duration, LateBy, EarlyBy, Status, Present, Absent

        Returns:
            List of raw log dicts from MDB.
        """
        if not self._connection:
            raise RuntimeError("Not connected. Call connect() first.")

        cursor = self._connection.cursor()

        query = (
            "SELECT AttendanceDate, EmployeeId, InTime, OutTime, "
            "Duration, LateBy, EarlyBy, Status, Present, Absent "
            "FROM AttendanceLogs"
        )
        params = []
        conditions = []

        if start_date:
            conditions.append("AttendanceDate >= ?")
            params.append(start_date)
        if end_date:
            conditions.append("AttendanceDate <= ?")
            params.append(end_date)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        logs = []
        for row in rows:
            logs.append({
                "attendance_date": row.AttendanceDate,
                "employee_id": str(row.EmployeeId),
                "in_time": row.InTime,
                "out_time": row.OutTime,
                "duration": row.Duration,
                "late_by": row.LateBy,
                "early_by": row.EarlyBy,
                "status": row.Status,
                "present": row.Present,
                "absent": row.Absent,
            })

        return logs

    def _build_mapping_lookup(self, db: Session) -> Dict[str, Dict]:
        """
        Build a lookup dict from external_employee_id → Xarka employee info.

        Queries employee_biometric_mapping for all active eSSL mappings,
        then joins with employees table to get employee names.

        Returns:
            Dict keyed by external_employee_id:
            {
                "2528": {"employee_id": 6, "employee_name": "om"},
                ...
            }
        """
        from models.employee import Employee

        mappings = (
            db.query(EmployeeBiometricMapping, Employee.name)
            .join(Employee, EmployeeBiometricMapping.employee_id == Employee.id)
            .filter(
                EmployeeBiometricMapping.provider == "essl",
                EmployeeBiometricMapping.is_active == True,
            )
            .all()
        )

        lookup = {}
        for mapping, emp_name in mappings:
            ext_id = mapping.external_employee_id
            if ext_id:
                lookup[str(ext_id)] = {
                    "employee_id": mapping.employee_id,
                    "employee_name": emp_name,
                    "external_employee_code": mapping.external_employee_code,
                }

        return lookup

    def resolve_mapping(self, db: Session, external_employee_id: str) -> Optional[Dict]:
        """
        Resolve a single external_employee_id to a Xarka employee.

        Args:
            db: SQLAlchemy database session.
            external_employee_id: Device employee ID to resolve.

        Returns:
            Dict with employee_id, employee_name, external_employee_code
            or None if not mapped.
        """
        lookup = self._build_mapping_lookup(db)
        return lookup.get(str(external_employee_id))

    def import_attendance(
        self,
        db: Session,
        resolved_records: List[Dict],
    ) -> Dict:
        """
        Import resolved attendance records into the Xarka attendance table.

        For each resolved record:
            1. Skip if not mapped (employee_id is None).
            2. Check for duplicate: same employee_id + date + source_employee_id.
            3. If duplicate exists, skip (do not overwrite).
            4. If new, create Attendance record.

        Field mapping (AttendanceLogs → Attendance):
            AttendanceDate     → date
            EmployeeId         → source_employee_id (+ resolved employee_id)
            InTime             → punch_in (combined with AttendanceDate)
            OutTime            → punch_out (combined with AttendanceDate)
            Duration           → hours_worked
            LateBy             → late_by, is_late (if > 0)
            EarlyBy            → early_by
            Status             → status (lowercased)
            Present/Absent     → derived status if Status is empty

        Args:
            db: SQLAlchemy database session.
            resolved_records: Output from read_attendance_logs().

        Returns:
            Import summary dict:
            {
                "imported": int,
                "skipped_duplicate": int,
                "skipped_unmapped": int,
                "errors": list,
                "records": list,   # details of imported records
            }
        """
        imported = 0
        updated_count = 0
        skipped_duplicate = 0
        skipped_unmapped = 0
        errors = []
        imported_records = []

        # Track keys within this batch to detect intra-batch duplicates
        # (DB query won't see uncommitted rows from the same session)
        seen_keys = set()

        for record in resolved_records:
            ext_id = record["external_employee_id"]
            att_date_str = record["attendance_date"]

            # Skip unmapped records
            if not record.get("mapped") or record.get("employee_id") is None:
                skipped_unmapped += 1
                logger.debug(
                    "Skipping unmapped record: ext_id=%s date=%s",
                    ext_id, att_date_str,
                )
                continue

            employee_id = record["employee_id"]

            # Parse attendance date
            try:
                att_date = self._parse_date(att_date_str)
            except ValueError as e:
                errors.append(f"Invalid date '{att_date_str}' for employee {employee_id}: {e}")
                continue

            # Duplicate key: (employee_id, date, source_employee_id)
            dup_key = (employee_id, att_date, ext_id)

            # Check 1: duplicate within this batch (uncommitted rows invisible to DB)
            if dup_key in seen_keys:
                skipped_duplicate += 1
                logger.debug(
                    "Intra-batch duplicate skipped: employee_id=%s date=%s ext_id=%s",
                    employee_id, att_date, ext_id,
                )
                continue

            # Check 2: duplicate already in database (from previous imports)
            existing = (
                db.query(Attendance)
                .filter(
                    and_(
                        Attendance.employee_id == employee_id,
                        Attendance.date == att_date,
                        Attendance.source_employee_id == ext_id,
                    )
                )
                .first()
            )

            if existing:
                try:
                    punch_in = self._combine_date_time(
                        att_date, record.get("in_time")
                    )
                    punch_out = self._combine_date_time(
                        att_date, record.get("out_time")
                    )

                    logger.info(
                        "RAW TIMES: employee_id=%s date=%s in_time=%r out_time=%r",
                        employee_id, att_date,
                        record.get("in_time"),
                        record.get("out_time")
                    )

                    # Always overwrite with machine data
                    existing.punch_in = punch_in
                    existing.punch_out = punch_out

                    # Update hours_worked from machine duration
                    if record.get("duration"):
                        existing.hours_worked = record.get("duration")
                    elif punch_in and punch_out:
                        existing.hours_worked = round(
                            (punch_out - punch_in).total_seconds() / 3600, 2
                        )

                    # Update status
                    existing.status = self._derive_status(record)
                    existing.synced_at = datetime.utcnow()
                    updated_count += 1

                    logger.info(
                        "Updated: employee_id=%s date=%s punch_in=%s punch_out=%s",
                        employee_id, att_date, punch_in, punch_out,
                    )

                except Exception as e:
                    logger.error(
                        "Error updating employee_id=%s date=%s: %s",
                        employee_id, att_date, e
                    )
                continue

            # Transform and create attendance record
            try:
                attendance = self._transform_record(record, att_date)
                db.add(attendance)
                seen_keys.add(dup_key)
                imported += 1
                imported_records.append({
                    "employee_id": employee_id,
                    "date": str(att_date),
                    "source_employee_id": ext_id,
                    "punch_in": str(attendance.punch_in) if attendance.punch_in else None,
                    "punch_out": str(attendance.punch_out) if attendance.punch_out else None,
                    "hours_worked": attendance.hours_worked,
                })
                logger.info(
                    "Imported: employee_id=%s date=%s ext_id=%s",
                    employee_id, att_date, ext_id,
                )
            except Exception as e:
                error_msg = f"Error importing employee_id={employee_id} date={att_date}: {e}"
                errors.append(error_msg)
                logger.error(error_msg)

        # Commit all new records and updates
        if imported > 0 or updated_count > 0:
            db.commit()
            logger.info("Committed %d new records, %d updates", imported, updated_count)

        summary = {
            "imported": imported,
            "updated": updated_count,
            "skipped_duplicate": skipped_duplicate,
            "skipped_unmapped": skipped_unmapped,
            "errors": errors,
            "records": imported_records,
        }

        logger.info(
            "Import complete: imported=%d, updated=%d, duplicates=%d, unmapped=%d, errors=%d",
            imported, updated_count, skipped_duplicate, skipped_unmapped, len(errors),
        )

        return summary

    def _transform_record(self, record: Dict, att_date: date) -> Attendance:
        """
        Transform a resolved AttendanceLogs record into an Attendance model instance.

        Args:
            record: Resolved record dict from read_attendance_logs().
            att_date: Parsed date object.

        Returns:
            Unsaved Attendance instance.
        """
        # Parse punch times (combine date + time)
        punch_in = self._combine_date_time(att_date, record.get("in_time"))
        punch_out = self._combine_date_time(att_date, record.get("out_time"))

        # Derive status
        status = self._derive_status(record)

        return Attendance(
            employee_id=record["employee_id"],
            date=att_date,
            status=status,
            punch_in=punch_in,
            punch_out=punch_out,
            hours_worked=record.get("duration"),
            source="essl",
            source_employee_id=str(record["external_employee_id"]),
            early_by=record.get("early_by") or 0.0,
            synced_at=datetime.utcnow(),
        )

    def _parse_date(self, date_str: str) -> date:
        """Parse a date string into a date object."""
        if isinstance(date_str, date):
            return date_str
        # Try common formats
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Cannot parse date: {date_str}")

    def _combine_date_time(self, att_date: date, time_str: Optional[str]) -> Optional[datetime]:
        """Combine a date with a time string to create a full datetime."""
        if not time_str:
            return None

        time_str = str(time_str).strip()

        # Microsoft Access null datetime — treat as None
        if not time_str or time_str.startswith('1900-01'):
            return None

        # Try full datetime strings first (sent by sync_agent)
        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S.%f",
        ):
            try:
                dt = datetime.strptime(time_str, fmt)
                # Use the date from att_date but time from the parsed datetime
                # This handles cases where the date in the string might differ
                return datetime.combine(att_date, dt.time())
            except ValueError:
                continue

        # Try time-only strings (legacy format)
        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                t = datetime.strptime(time_str, fmt).time()
                return datetime.combine(att_date, t)
            except ValueError:
                continue

        # Log the failure so we can debug future format issues
        logger.warning(
            "_combine_date_time: could not parse time_str=%r for date=%s",
            time_str, att_date,
        )
        return None

    def _derive_status(self, record: Dict) -> str:
        """
        Derive attendance status from the record.

        Priority:
            1. Status field from device (lowercased)
            2. Present/Absent flags
            3. Default to 'present' if punch_in exists
        """
        status = record.get("status")
        if status:
            return status.lower()

        if record.get("absent"):
            return "absent"
        if record.get("present"):
            return "present"
        if record.get("in_time"):
            return "present"

        return "absent"
