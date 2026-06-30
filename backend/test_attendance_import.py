"""
Phase 2.2 Test — Attendance Import Pipeline
============================================

Proves: AttendanceLogs → Mapping → Attendance Table (PostgreSQL)

This script:
    1. Simulates raw AttendanceLogs records (as from eSSL MDB)
    2. Resolves external_employee_id → Xarka employee_id
    3. Imports resolved records into the attendance table
    4. Verifies duplicate detection
    5. Reports: imported, skipped, unmapped, errors

No scheduled jobs. No UI changes. Manual attendance untouched.
"""

import sys
import os
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from models.attendance import Attendance
from services.essl_sync import ESSLSync


# ── Simulated MDB AttendanceLogs ─────────────────────────────────────────
# Mix of mapped and unmapped records, plus a duplicate for testing.

TEST_DATE_1 = date(2026, 6, 30)
TEST_DATE_2 = date(2026, 6, 29)

SIMULATED_MDB_LOGS = [
    # Record 1: mapped employee, new record → should import
    {
        "attendance_date": TEST_DATE_1,
        "employee_id": "2528",
        "in_time": "09:05:00",
        "out_time": "18:30:00",
        "duration": 9.42,
        "late_by": 5.0,
        "early_by": 0.0,
        "status": "Present",
        "present": 1,
        "absent": 0,
    },
    # Record 2: mapped employee, different date → should import
    {
        "attendance_date": TEST_DATE_2,
        "employee_id": "2528",
        "in_time": "09:00:00",
        "out_time": "18:15:00",
        "duration": 9.25,
        "late_by": 0.0,
        "early_by": 15.0,
        "status": "Present",
        "present": 1,
        "absent": 0,
    },
    # Record 3: unmapped employee → should be skipped
    {
        "attendance_date": TEST_DATE_1,
        "employee_id": "9999",
        "in_time": "10:00:00",
        "out_time": "17:00:00",
        "duration": 7.0,
        "late_by": 30.0,
        "early_by": 120.0,
        "status": "Present",
        "present": 1,
        "absent": 0,
    },
    # Record 4: duplicate of Record 1 → should be skipped
    {
        "attendance_date": TEST_DATE_1,
        "employee_id": "2528",
        "in_time": "09:05:00",
        "out_time": "18:30:00",
        "duration": 9.42,
        "late_by": 5.0,
        "early_by": 0.0,
        "status": "Present",
        "present": 1,
        "absent": 0,
    },
    # Record 5: unmapped employee → should be skipped
    {
        "attendance_date": TEST_DATE_1,
        "employee_id": "0000",
        "in_time": "08:30:00",
        "out_time": "17:30:00",
        "duration": 9.0,
        "late_by": 0.0,
        "early_by": 0.0,
        "status": "Present",
        "present": 1,
        "absent": 0,
    },
]


def cleanup_test_data(db):
    """Remove any test attendance records created by this script."""
    deleted = (
        db.query(Attendance)
        .filter(
            Attendance.source == "essl",
            Attendance.source_employee_id == "2528",
            Attendance.date.in_([TEST_DATE_1, TEST_DATE_2]),
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


def run_import_test():
    """Run the full attendance import pipeline test."""
    db = SessionLocal()
    sync = ESSLSync()

    print("=" * 70)
    print("Phase 2.2 — Attendance Import Pipeline Test")
    print("=" * 70)

    # ── Step 0: Clean slate ──────────────────────────────────────────────
    print("\n[0] CLEANUP — removing prior test records")
    cleaned = cleanup_test_data(db)
    print(f"    Removed {cleaned} existing test record(s)")

    # ── Step 1: Show simulated MDB logs ──────────────────────────────────
    print("\n[1] SIMULATED MDB ATTENDANCE LOGS")
    print("-" * 70)
    print(f"{'#':<3} {'Date':<12} {'EmpID':<8} {'In':<10} {'Out':<10} {'Late':<6}")
    print("-" * 70)
    for i, log in enumerate(SIMULATED_MDB_LOGS, 1):
        print(
            f"{i:<3} {log['attendance_date']!s:<12} {log['employee_id']:<8} "
            f"{log['in_time']:<10} {log['out_time']:<10} {log['late_by']:<6.1f}"
        )
    print(f"\n    Total records: {len(SIMULATED_MDB_LOGS)}")

    # ── Step 2: Resolve mappings ─────────────────────────────────────────
    print("\n[2] RESOLVING MAPPINGS")
    print("-" * 70)
    resolved = []
    for log in SIMULATED_MDB_LOGS:
        ext_id = str(log["employee_id"])
        mapping = sync.resolve_mapping(db, ext_id)
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
            "mapped": mapping is not None,
            "employee_id": mapping["employee_id"] if mapping else None,
            "employee_name": mapping["employee_name"] if mapping else None,
        }
        resolved.append(record)
        label = f"#{mapping['employee_id']} {mapping['employee_name']}" if mapping else "???"
        print(f"    {ext_id} → {label}")

    # ── Step 3: Import attendance ────────────────────────────────────────
    print("\n[3] IMPORTING ATTENDANCE")
    print("-" * 70)
    summary = sync.import_attendance(db, resolved)

    print(f"    Imported:          {summary['imported']}")
    print(f"    Skipped (duplicate): {summary['skipped_duplicate']}")
    print(f"    Skipped (unmapped):  {summary['skipped_unmapped']}")
    print(f"    Errors:            {len(summary['errors'])}")

    if summary["errors"]:
        for err in summary["errors"]:
            print(f"      - {err}")

    # ── Step 4: Verify DB records ────────────────────────────────────────
    print("\n[4] DATABASE VERIFICATION")
    print("-" * 70)
    db_records = (
        db.query(Attendance)
        .filter(
            Attendance.source == "essl",
            Attendance.source_employee_id == "2528",
            Attendance.date.in_([TEST_DATE_1, TEST_DATE_2]),
        )
        .order_by(Attendance.date)
        .all()
    )

    print(f"    Records in DB: {len(db_records)}")
    print()
    print(
        f"    {'ID':<6} {'EmpID':<8} {'Date':<12} {'In':<20} {'Out':<20} "
        f"{'Hrs':<6} {'Late':<6} {'Source':<8} {'ExtID'}"
    )
    print("    " + "-" * 100)
    for r in db_records:
        print(
            f"    {r.id:<6} {r.employee_id:<8} {r.date!s:<12} "
            f"{str(r.punch_in):<20} {str(r.punch_out):<20} "
            f"{r.hours_worked or 0:<6.2f} {r.late_by or 0:<6.1f} "
            f"{r.source:<8} {r.source_employee_id}"
        )

    # ── Step 5: Duplicate detection test ─────────────────────────────────
    print("\n[5] DUPLICATE DETECTION TEST")
    print("-" * 70)
    print("    Re-running import with same records...")
    summary2 = sync.import_attendance(db, resolved)
    print(f"    Imported:          {summary2['imported']}")
    print(f"    Skipped (duplicate): {summary2['skipped_duplicate']}")
    print(f"    Skipped (unmapped):  {summary2['skipped_unmapped']}")

    dup_works = summary2["imported"] == 0 and summary2["skipped_duplicate"] > 0
    print(f"    Duplicate detection: {'PASS' if dup_works else 'FAIL'}")

    # ── Step 6: Summary ──────────────────────────────────────────────────
    print("\n" + "=" * 70)
    total_db = len(db_records)
    if summary["imported"] >= 1 and summary2["imported"] == 0:
        print("VERDICT: Pipeline works — AttendanceLogs → Mapping → Attendance Table OK")
        print(f"  - {summary['imported']} records imported on first run")
        print(f"  - {summary2['skipped_duplicate']} duplicates detected on second run")
        print(f"  - {summary['skipped_unmapped']} unmapped records skipped")
        print(f"  - {total_db} total attendance records in DB")
    else:
        print("VERDICT: Pipeline issue — check errors above")
    print("=" * 70)

    db.close()
    return summary, summary2


if __name__ == "__main__":
    run_import_test()
