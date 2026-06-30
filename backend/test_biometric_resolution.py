"""
Phase 2.1 Test — Biometric Attendance Resolution Pipeline
==========================================================

Proves: AttendanceLogs → Mapping Table → Xarka Employee resolution
works end-to-end before writing any attendance data.

This script:
    1. Simulates raw AttendanceLogs records (as read from eSSL MDB)
    2. Loads real biometric mappings from PostgreSQL
    3. Resolves each external_employee_id → Xarka employee_id
    4. Reports: parsed records, resolved IDs, unmapped entries

No attendance records are created. No database writes occur.
"""

import sys
import os
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from services.essl_sync import ESSLSync


# ── Simulated MDB AttendanceLogs (raw data from eSSL device) ──────────────
# These represent what read_attendance_logs() would return from the MDB.
# EmployeeId values correspond to external_employee_id in the mapping table.

SIMULATED_MDB_LOGS = [
    {
        "attendance_date": date(2026, 6, 30),
        "employee_id": "2528",       # mapped to employee 6 (om)
        "in_time": "09:05:00",
        "out_time": "18:30:00",
        "duration": 9.42,
        "late_by": 5.0,
        "early_by": 0.0,
        "status": "Present",
        "present": 1,
        "absent": 0,
    },
    {
        "attendance_date": date(2026, 6, 30),
        "employee_id": "9999",       # NOT mapped — should be flagged
        "in_time": "10:00:00",
        "out_time": "17:00:00",
        "duration": 7.0,
        "late_by": 30.0,
        "early_by": 120.0,
        "status": "Present",
        "present": 1,
        "absent": 0,
    },
    {
        "attendance_date": date(2026, 6, 29),
        "employee_id": "2528",       # mapped to employee 6 (om) — previous day
        "in_time": "09:00:00",
        "out_time": "18:15:00",
        "duration": 9.25,
        "late_by": 0.0,
        "early_by": 15.0,
        "status": "Present",
        "present": 1,
        "absent": 0,
    },
    {
        "attendance_date": date(2026, 6, 30),
        "employee_id": "0000",       # NOT mapped — another unmapped entry
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


def run_resolution_test():
    """Run the full resolution pipeline test."""
    db = SessionLocal()
    sync = ESSLSync()

    print("=" * 70)
    print("Phase 2.1 — Biometric Attendance Resolution Pipeline Test")
    print("=" * 70)

    # ── Step 1: Show simulated MDB logs ──────────────────────────────────
    print("\n[1] SIMULATED MDB ATTENDANCE LOGS (raw from device)")
    print("-" * 70)
    print(f"{'#':<3} {'Date':<12} {'EmpID':<8} {'In':<10} {'Out':<10} {'Late':<6} {'Status'}")
    print("-" * 70)
    for i, log in enumerate(SIMULATED_MDB_LOGS, 1):
        print(
            f"{i:<3} {log['attendance_date']!s:<12} {log['employee_id']:<8} "
            f"{log['in_time']:<10} {log['out_time']:<10} "
            f"{log['late_by']:<6.1f} {log['status']}"
        )
    print(f"\nTotal records: {len(SIMULATED_MDB_LOGS)}")

    # ── Step 2: Load biometric mappings from DB ──────────────────────────
    print("\n[2] BIOMETRIC MAPPINGS (from PostgreSQL)")
    print("-" * 70)
    lookup = sync._build_mapping_lookup(db)
    print(f"{'Ext Emp ID':<15} {'Xarka Emp ID':<15} {'Name':<20} {'Code'}")
    print("-" * 70)
    for ext_id, info in lookup.items():
        print(
            f"{ext_id:<15} {info['employee_id']:<15} "
            f"{info['employee_name']:<20} {info['external_employee_code']}"
        )
    print(f"\nActive mappings: {len(lookup)}")

    # ── Step 3: Resolve each log record ──────────────────────────────────
    print("\n[3] RESOLUTION PIPELINE")
    print("-" * 70)

    resolved = []
    mapped_count = 0
    unmapped_count = 0

    for log in SIMULATED_MDB_LOGS:
        ext_id = str(log["employee_id"])
        mapping = sync.resolve_mapping(db, ext_id)

        record = {
            "attendance_date": log["attendance_date"],
            "external_employee_id": ext_id,
            "employee_id": mapping["employee_id"] if mapping else None,
            "employee_name": mapping["employee_name"] if mapping else None,
            "in_time": log["in_time"],
            "out_time": log["out_time"],
            "duration": log["duration"],
            "late_by": log["late_by"],
            "early_by": log["early_by"],
            "status": log["status"],
            "present": bool(log["present"]),
            "absent": bool(log["absent"]),
            "mapped": mapping is not None,
        }
        resolved.append(record)

        if mapping:
            mapped_count += 1
            status_icon = "OK"
        else:
            unmapped_count += 1
            status_icon = "UNMAPPED"

        print(
            f"  {ext_id} → "
            f"{'#' + str(record['employee_id']) + ' ' + record['employee_name'] if mapping else '???':<20} "
            f"[{status_icon}]"
        )

    # ── Step 4: Summary ──────────────────────────────────────────────────
    print("\n[4] RESOLUTION SUMMARY")
    print("-" * 70)
    print(f"  Total log records:     {len(SIMULATED_MDB_LOGS)}")
    print(f"  Successfully mapped:   {mapped_count}")
    print(f"  Unmapped (skipped):    {unmapped_count}")
    print(f"  Mapping table entries: {len(lookup)}")

    # ── Step 5: Resolved records output ──────────────────────────────────
    print("\n[5] RESOLVED RECORDS (ready for attendance creation)")
    print("-" * 70)
    print(
        f"{'Date':<12} {'XarkaID':<10} {'Name':<15} "
        f"{'In':<10} {'Out':<10} {'Hrs':<6} {'Late':<6} {'Status'}"
    )
    print("-" * 70)
    for r in resolved:
        if r["mapped"]:
            print(
                f"{r['attendance_date']!s:<12} #{r['employee_id']:<9} "
                f"{r['employee_name']:<15} {r['in_time']:<10} {r['out_time']:<10} "
                f"{r['duration']:<6.2f} {r['late_by']:<6.1f} {r['status']}"
            )
        else:
            print(
                f"{r['attendance_date']!s:<12} {'???':<10} "
                f"{'(unmapped)':<15} {r['in_time']:<10} {r['out_time']:<10} "
                f"{r['duration']:<6.2f} {r['late_by']:<6.1f} {r['status']}"
            )

    # ── Step 6: Single-record resolution test ────────────────────────────
    print("\n[6] SINGLE RECORD RESOLUTION TEST")
    print("-" * 70)
    test_ext_id = "2528"
    result = sync.resolve_mapping(db, test_ext_id)
    if result:
        print(f"  resolve_mapping('{test_ext_id}') → employee_id={result['employee_id']}, "
              f"name='{result['employee_name']}'")
    else:
        print(f"  resolve_mapping('{test_ext_id}') → None (not found)")

    test_ext_id_miss = "1111"
    result_miss = sync.resolve_mapping(db, test_ext_id_miss)
    print(f"  resolve_mapping('{test_ext_id_miss}') → {result_miss}")

    # ── Verdict ──────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    if mapped_count > 0 and unmapped_count >= 0:
        print("VERDICT: Pipeline works — AttendanceLogs → Mapping → Employee resolution OK")
    else:
        print("VERDICT: Pipeline failed — no records resolved")
    print("=" * 70)

    db.close()
    return resolved


if __name__ == "__main__":
    run_resolution_test()
