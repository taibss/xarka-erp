"""
Xarka ERP — eSSL Biometric Sync Agent
======================================

Standalone script for Windows PCs that reads the eTimeTrackLite MDB file
and syncs attendance data to the Xarka ERP server via API.

No FastAPI dependency. Runs independently on the Windows office PC.

Requirements (Windows):
    pip install pyodbc requests python-dotenv

Usage:
    python sync_agent.py                     # sync today
    python sync_agent.py --start 2026-06-29  # sync from date
    python sync_agent.py --start 2026-06-29 --end 2026-06-30
    python sync_agent.py --validate          # validate config only

Architecture:
    eTimeTrackLite MDB (Windows PC)
        │  pyodbc reads AttendanceLogs
        ▼
    sync_agent.py
        │  HTTP POST to Xarka API
        ▼
    Xarka Server (PostgreSQL)
"""

import os
import sys
import json
import time
import logging
from datetime import date, datetime
from typing import Optional, List, Dict, Tuple

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("WARNING: python-dotenv not installed. Reading from system env only.")
    print("Install: pip install python-dotenv")

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)


# ── Logging ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("sync_agent")


# ── Configuration ────────────────────────────────────────────────────────

class Config:
    """Load configuration from environment / .env file."""

    def __init__(self):
        self.xarka_api_url: str = os.getenv("XARKA_API_URL", "http://localhost:8000")
        self.xarka_api_token: str = os.getenv("XARKA_API_TOKEN", "")
        self.mdb_path: str = os.getenv("ESSL_MDB_PATH", "")
        self.timeout: int = int(os.getenv("REQUEST_TIMEOUT", "30"))
        self.max_retries: int = int(os.getenv("MAX_RETRIES", "3"))
        self.retry_delay: int = int(os.getenv("RETRY_DELAY", "5"))

    def validate(self) -> List[str]:
        """Validate configuration. Returns list of error messages."""
        errors = []
        if not self.xarka_api_url:
            errors.append("XARKA_API_URL not set")
        if not self.xarka_api_token:
            errors.append("XARKA_API_TOKEN not set")
        if not self.mdb_path:
            errors.append("ESSL_MDB_PATH not set")
        return errors

    def summary(self) -> str:
        """Return masked config summary."""
        token_masked = self.xarka_api_token[:8] + "..." if self.xarka_api_token else "(empty)"
        return (
            f"  API URL:      {self.xarka_api_url}\n"
            f"  API Token:    {token_masked}\n"
            f"  MDB Path:     {self.mdb_path}\n"
            f"  Timeout:      {self.timeout}s\n"
            f"  Max Retries:  {self.max_retries}"
        )


# ── MDB Reader ───────────────────────────────────────────────────────────

class MDBReader:
    """Read AttendanceLogs from eTimeTrackLite MDB via pyodbc."""

    def __init__(self, mdb_path: str):
        self.mdb_path = mdb_path
        self._connection = None

    def validate_mdb_path(self) -> Tuple[bool, str]:
        """Check if MDB file exists and is readable."""
        if not os.path.exists(self.mdb_path):
            return False, f"MDB file not found: {self.mdb_path}"
        if not os.path.isfile(self.mdb_path):
            return False, f"Path is not a file: {self.mdb_path}"
        if os.path.getsize(self.mdb_path) == 0:
            return False, f"MDB file is empty: {self.mdb_path}"
        return True, "OK"

    def connect(self) -> Tuple[bool, str]:
        """Open pyodbc connection to MDB."""
        try:
            import pyodbc
        except ImportError:
            return False, "pyodbc not installed. Run: pip install pyodbc"

        valid, msg = self.validate_mdb_path()
        if not valid:
            return False, msg

        try:
            conn_str = (
                r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
                rf"DBQ={self.mdb_path};"
            )
            self._connection = pyodbc.connect(conn_str)
            logger.info("Connected to MDB: %s", self.mdb_path)
            return True, "Connected"
        except Exception as e:
            return False, f"Connection failed: {e}"

    def disconnect(self):
        """Close MDB connection."""
        if self._connection:
            try:
                self._connection.close()
            except Exception:
                pass
            self._connection = None

    def read_attendance_logs(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Tuple[List[Dict], str]:
        """
        Read AttendanceLogs from MDB.

        Returns:
            (records, error_message)
            error_message is empty on success.
        """
        if not self._connection:
            return [], "Not connected to MDB"

        try:
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

            records = []
            for row in rows:
                records.append({
                    "attendance_date": str(row.AttendanceDate) if row.AttendanceDate else "",
                    "employee_id": str(row.EmployeeId) if row.EmployeeId else "",
                    "in_time": str(row.InTime) if row.InTime else "",
                    "out_time": str(row.OutTime) if row.OutTime else "",
                    "duration": float(row.Duration) if row.Duration else 0,
                    "late_by": float(row.LateBy) if row.LateBy else 0,
                    "early_by": float(row.EarlyBy) if row.EarlyBy else 0,
                    "status": str(row.Status) if row.Status else "",
                    "present": int(row.Present) if row.Present else 0,
                    "absent": int(row.Absent) if row.Absent else 0,
                })

            logger.info("Read %d AttendanceLogs from MDB", len(records))
            return records, ""

        except Exception as e:
            return [], f"Failed to read AttendanceLogs: {e}"


# ── Xarka API Client ────────────────────────────────────────────────────

class XarkaClient:
    """Send attendance data to Xarka ERP API."""

    def __init__(self, api_url: str, api_token: str, timeout: int = 30):
        self.api_url = api_url.rstrip("/")
        self.api_token = api_token
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        })

    def validate_connection(self) -> Tuple[bool, str]:
        """Test API connectivity."""
        try:
            resp = self.session.get(
                f"{self.api_url}/",
                timeout=self.timeout,
            )
            if resp.status_code == 200:
                return True, "API reachable"
            return False, f"API returned status {resp.status_code}"
        except requests.ConnectionError:
            return False, f"Cannot connect to {self.api_url}"
        except requests.Timeout:
            return False, f"API timeout ({self.timeout}s)"
        except Exception as e:
            return False, f"API validation failed: {e}"

    def sync_attendance(
        self,
        records: List[Dict],
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict:
        """
        Send attendance records to Xarka sync endpoint.

        Uses test_mode=true to inject records directly,
        bypassing MDB connection on the server side.

        Returns:
            API response dict.
        """
        payload = {
            "test_mode": True,
            "test_records": records,
        }
        if start_date:
            payload["start_date"] = start_date
        if end_date:
            payload["end_date"] = end_date

        try:
            resp = self.session.post(
                f"{self.api_url}/attendance/sync-biometric",
                json=payload,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.Timeout:
            return {"success": False, "error": f"Request timeout ({self.timeout}s)"}
        except requests.ConnectionError:
            return {"success": False, "error": f"Cannot connect to {self.api_url}"}
        except requests.HTTPError as e:
            try:
                error_detail = resp.json().get("detail", str(e))
            except Exception:
                error_detail = str(e)
            return {"success": False, "error": error_detail}
        except Exception as e:
            return {"success": False, "error": str(e)}


# ── Sync Agent ───────────────────────────────────────────────────────────

def run_sync(
    config: Config,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Dict:
    """
    Execute full sync: MDB → API → Xarka Server.

    Returns:
        Summary dict with imported, duplicates, unmapped, errors.
    """
    summary = {
        "imported": 0,
        "duplicates": 0,
        "unmapped": 0,
        "errors": 0,
        "records_read": 0,
        "success": False,
        "message": "",
    }

    # ── Step 1: Validate config ──────────────────────────────────────
    logger.info("Step 1: Validating configuration")
    config_errors = config.validate()
    if config_errors:
        for err in config_errors:
            logger.error("Config error: %s", err)
        summary["message"] = "Configuration invalid"
        summary["errors"] = len(config_errors)
        return summary

    logger.info("Configuration OK:\n%s", config.summary())

    # ── Step 2: Validate MDB ─────────────────────────────────────────
    logger.info("Step 2: Validating MDB file")
    reader = MDBReader(config.mdb_path)
    valid, msg = reader.validate_mdb_path()
    if not valid:
        logger.error("MDB validation failed: %s", msg)
        summary["message"] = msg
        summary["errors"] = 1
        return summary
    logger.info("MDB file OK: %s", msg)

    # ── Step 3: Connect to MDB ───────────────────────────────────────
    logger.info("Step 3: Connecting to MDB")
    connected, msg = reader.connect()
    if not connected:
        logger.error("MDB connection failed: %s", msg)
        summary["message"] = msg
        summary["errors"] = 1
        return summary

    # ── Step 4: Read AttendanceLogs ──────────────────────────────────
    logger.info("Step 4: Reading AttendanceLogs")
    records, error = reader.read_attendance_logs(start_date, end_date)
    reader.disconnect()

    if error:
        logger.error("MDB read failed: %s", error)
        summary["message"] = error
        summary["errors"] = 1
        return summary

    summary["records_read"] = len(records)
    if not records:
        logger.info("No records found in MDB for date range")
        summary["message"] = "No records to sync"
        summary["success"] = True
        return summary

    logger.info("Read %d records from MDB", len(records))

    # ── Step 5: Send to Xarka API ────────────────────────────────────
    logger.info("Step 5: Sending to Xarka API")
    client = XarkaClient(config.xarka_api_url, config.xarka_api_token, config.timeout)

    # Validate API connection first
    api_ok, api_msg = client.validate_connection()
    if not api_ok:
        logger.error("API validation failed: %s", api_msg)
        summary["message"] = api_msg
        summary["errors"] = 1
        return summary
    logger.info("API connection OK: %s", api_msg)

    # Send with retry
    last_error = None
    for attempt in range(1, config.max_retries + 1):
        logger.info("Sync attempt %d/%d", attempt, config.max_retries)

        start_str = str(start_date) if start_date else None
        end_str = str(end_date) if end_date else None
        result = client.sync_attendance(records, start_str, end_str)

        if result.get("success"):
            summary["imported"] = result.get("imported", 0)
            summary["duplicates"] = result.get("duplicates", 0)
            summary["unmapped"] = result.get("unmapped", 0)
            summary["errors"] = result.get("errors", 0)
            summary["success"] = True
            summary["message"] = "Sync completed"
            logger.info("Sync successful on attempt %d", attempt)
            break
        else:
            last_error = result.get("error", "Unknown error")
            logger.warning(
                "Attempt %d/%d failed: %s",
                attempt, config.max_retries, last_error,
            )
            if attempt < config.max_retries:
                logger.info("Retrying in %ds...", config.retry_delay)
                time.sleep(config.retry_delay)

    if not summary["success"]:
        summary["message"] = f"All {config.max_retries} attempts failed. Last error: {last_error}"

    return summary


def print_summary(summary: Dict):
    """Print human-readable sync summary."""
    print()
    print("=" * 50)
    print("  SYNC SUMMARY")
    print("=" * 50)
    print(f"  Status:       {'SUCCESS' if summary['success'] else 'FAILED'}")
    print(f"  Records read: {summary['records_read']}")
    print(f"  Imported:     {summary['imported']}")
    print(f"  Duplicates:   {summary['duplicates']}")
    print(f"  Unmapped:     {summary['unmapped']}")
    print(f"  Errors:       {summary['errors']}")
    print(f"  Message:      {summary['message']}")
    print("=" * 50)
    print()


# ── CLI ──────────────────────────────────────────────────────────────────

def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Xarka ERP — eSSL Biometric Sync Agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python sync_agent.py                          # sync today\n"
            "  python sync_agent.py --start 2026-06-30       # sync from date\n"
            "  python sync_agent.py -s 2026-06-29 -e 2026-06-30\n"
            "  python sync_agent.py --validate               # check config\n"
        ),
    )
    parser.add_argument("--start", "-s", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", "-e", help="End date (YYYY-MM-DD)")
    parser.add_argument("--validate", action="store_true", help="Validate config only")
    parser.add_argument("--dry-run", action="store_true", help="Read MDB but don't send to API")
    args = parser.parse_args()

    print()
    print("  Xarka ERP — eSSL Biometric Sync Agent")
    print("  " + "-" * 40)
    print()

    config = Config()

    if args.validate:
        print("Validating configuration...")
        errors = config.validate()
        if errors:
            print("ERRORS:")
            for err in errors:
                print(f"  - {err}")
            sys.exit(1)
        else:
            print("Configuration OK:")
            print(config.summary())

            print("\nValidating MDB file...")
            reader = MDBReader(config.mdb_path)
            valid, msg = reader.validate_mdb_path()
            if valid:
                print(f"  MDB: {msg}")
            else:
                print(f"  MDB: {msg}")
                sys.exit(1)

            print("\nValidating API connection...")
            client = XarkaClient(config.xarka_api_url, config.xarka_api_token, config.timeout)
            ok, msg = client.validate_connection()
            if ok:
                print(f"  API: {msg}")
            else:
                print(f"  API: {msg}")
                sys.exit(1)

            print("\nAll checks passed.")
            sys.exit(0)

    # Parse dates
    start_date = None
    end_date = None
    if args.start:
        try:
            start_date = datetime.strptime(args.start, "%Y-%m-%d").date()
        except ValueError:
            print(f"ERROR: Invalid start date: {args.start}")
            sys.exit(1)
    if args.end:
        try:
            end_date = datetime.strptime(args.end, "%Y-%m-%d").date()
        except ValueError:
            print(f"ERROR: Invalid end date: {args.end}")
            sys.exit(1)

    if args.dry_run:
        print("DRY RUN — will read MDB but not send to API\n")
        config_errors = config.validate()
        if config_errors:
            for err in config_errors:
                print(f"  ERROR: {err}")
            sys.exit(1)

        reader = MDBReader(config.mdb_path)
        connected, msg = reader.connect()
        if not connected:
            print(f"  ERROR: {msg}")
            sys.exit(1)

        records, error = reader.read_attendance_logs(start_date, end_date)
        reader.disconnect()

        if error:
            print(f"  ERROR: {error}")
            sys.exit(1)

        print(f"  Records found: {len(records)}")
        for r in records[:10]:
            print(f"    {r['attendance_date']}  emp={r['employee_id']}  "
                  f"in={r['in_time']}  out={r['out_time']}")
        if len(records) > 10:
            print(f"    ... and {len(records) - 10} more")
        sys.exit(0)

    # Run full sync
    summary = run_sync(config, start_date, end_date)
    print_summary(summary)

    sys.exit(0 if summary["success"] else 1)


if __name__ == "__main__":
    main()
