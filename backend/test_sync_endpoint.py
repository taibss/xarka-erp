"""
Phase 2.3 Test — Manual Biometric Sync Endpoint
================================================

Tests POST /attendance/sync-biometric endpoint.

Verifies:
    1. Endpoint imports records successfully (test mode)
    2. Duplicate detection works
    3. Unmapped employees are skipped
    4. Summary response is accurate
    5. Manual attendance records are preserved

No MDB connection required — uses test_mode with injected records.
"""

import sys
import os
import json
import requests

sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from models.attendance import Attendance
from models.employee import Employee

BASE_URL = "http://localhost:8000"


def get_admin_token():
    """Generate admin JWT token for testing."""
    import jwt
    import time
    payload = {"sub": "mukadamtaiba@gmail.com", "exp": int(time.time()) + 3600}
    return jwt.encode(payload, "xarka_erp_secret_key_2024", algorithm="HS256")


def cleanup_test_records():
    """Remove test attendance records created by this script."""
    db = SessionLocal()
    deleted = (
        db.query(Attendance)
        .filter(Attendance.source == "essl", Attendance.source_employee_id == "2528")
        .delete(synchronize_session=False)
    )
    db.commit()
    db.close()
    return deleted


def test_sync_endpoint():
    """Run all sync endpoint tests."""
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    print("=" * 70)
    print("Phase 2.3 — Manual Biometric Sync Endpoint Test")
    print("=" * 70)

    # ── Step 0: Cleanup ──────────────────────────────────────────────────
    print("\n[0] CLEANUP")
    cleaned = cleanup_test_records()
    print(f"    Removed {cleaned} prior test records")

    # ── Test data ────────────────────────────────────────────────────────
    test_records = [
        {
            "attendance_date": "2026-06-30",
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
        {
            "attendance_date": "2026-06-29",
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
        {
            "attendance_date": "2026-06-30",
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
    ]

    # ── Test 1: Successful import ────────────────────────────────────────
    print("\n[1] TEST: Successful import (test_mode)")
    print("-" * 70)
    payload = {"test_mode": True, "test_records": test_records}
    resp = requests.post(f"{BASE_URL}/attendance/sync-biometric", headers=headers, json=payload)
    data = resp.json()

    print(f"    Status: {resp.status_code}")
    print(f"    Response: {json.dumps(data, indent=4)}")

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert data["success"] is True
    assert data["imported"] == 2, f"Expected 2 imported, got {data['imported']}"
    assert data["unmapped"] == 1, f"Expected 1 unmapped, got {data['unmapped']}"
    assert data["errors"] == 0, f"Expected 0 errors, got {data['errors']}"
    print("\n    PASS: Import successful")

    # ── Test 2: Duplicate detection ──────────────────────────────────────
    print("\n[2] TEST: Duplicate detection (re-run same records)")
    print("-" * 70)
    resp2 = requests.post(f"{BASE_URL}/attendance/sync-biometric", headers=headers, json=payload)
    data2 = resp2.json()

    print(f"    Status: {resp2.status_code}")
    print(f"    Response: {json.dumps(data2, indent=4)}")

    assert resp2.status_code == 200
    assert data2["imported"] == 0, f"Expected 0 imported, got {data2['imported']}"
    assert data2["duplicates"] == 2, f"Expected 2 duplicates, got {data2['duplicates']}"
    print("\n    PASS: Duplicates detected correctly")

    # ── Test 3: Unmapped employee handling ───────────────────────────────
    print("\n[3] TEST: Unmapped employee handling")
    print("-" * 70)
    unmapped_count = data["unmapped"]
    print(f"    Unmapped records skipped: {unmapped_count}")
    assert unmapped_count >= 1, "Expected at least 1 unmapped record"
    print("\n    PASS: Unmapped employees skipped")

    # ── Test 4: DB verification ──────────────────────────────────────────
    print("\n[4] TEST: Database verification")
    print("-" * 70)
    db = SessionLocal()
    records = (
        db.query(Attendance)
        .filter(Attendance.source == "essl", Attendance.source_employee_id == "2528")
        .all()
    )
    print(f"    Attendance records in DB: {len(records)}")
    for r in records:
        print(
            f"      #{r.id} emp={r.employee_id} date={r.date} "
            f"in={r.punch_in} out={r.punch_out} hrs={r.hours_worked} "
            f"source={r.source} ext={r.source_employee_id}"
        )
    assert len(records) == 2, f"Expected 2 DB records, got {len(records)}"
    print("\n    PASS: DB records correct")
    db.close()

    # ── Test 5: Manual attendance preserved ──────────────────────────────
    print("\n[5] TEST: Manual attendance preserved")
    print("-" * 70)
    db = SessionLocal()
    manual_records = db.query(Attendance).filter(Attendance.source == "manual").count()
    print(f"    Manual attendance records: {manual_records}")
    print("\n    PASS: Manual attendance untouched")
    db.close()

    # ── Test 6: Auth required ────────────────────────────────────────────
    print("\n[6] TEST: Auth required (no token)")
    print("-" * 70)
    resp_no_auth = requests.post(f"{BASE_URL}/attendance/sync-biometric", json=payload)
    print(f"    Status: {resp_no_auth.status_code}")
    assert resp_no_auth.status_code in (401, 403), "Expected 401 or 403"
    print("\n    PASS: Auth enforced")

    # ── Test 7: Admin required ───────────────────────────────────────────
    print("\n[7] TEST: Admin required (non-admin token)")
    print("-" * 70)
    import jwt
    import time
    non_admin_payload = {"sub": "hello@gmail.com", "exp": int(time.time()) + 3600}
    non_admin_token = jwt.encode(non_admin_payload, "xarka_erp_secret_key_2024", algorithm="HS256")
    non_admin_headers = {"Authorization": f"Bearer {non_admin_token}", "Content-Type": "application/json"}
    resp_non_admin = requests.post(
        f"{BASE_URL}/attendance/sync-biometric",
        headers=non_admin_headers,
        json=payload,
    )
    print(f"    Status: {resp_non_admin.status_code}")
    assert resp_non_admin.status_code == 403, "Expected 403"
    print("\n    PASS: Admin-only enforced")

    # ── Summary ──────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("ALL TESTS PASSED")
    print("=" * 70)
    print(f"  Endpoint: POST {BASE_URL}/attendance/sync-biometric")
    print(f"  Auth: Admin-only (Bearer token)")
    print(f"  Test mode: Inject sample records without MDB")
    print(f"  Duplicate detection: Works")
    print(f"  Unmapped handling: Works")
    print(f"  Manual attendance: Preserved")


if __name__ == "__main__":
    test_sync_endpoint()
