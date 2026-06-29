"""
Biometric Provider Interface
==============================

Abstract base class and provider implementations for biometric device
integrations (eSSL, ZKTeco, future providers).

Architecture:
    BiometricProvider (abstract)
        |
        +-- ESSLProvider (eTimeTrackLite MDB or TCP)
        +-- ZKTecoProvider (future)
        +-- FutureProvider (placeholder)

Each provider implements:
    - connect() / disconnect()
    - get_punches(date_range) -> List[BiometricPunch]
    - get_enrolled_users() -> List[dict]
    - is_connected() -> bool

Phase 2 implementation notes:
    - eSSLProvider has two modes:
        a) MDB mode: reads the .mdb file via pyodbc (Windows only).
        b) TCP mode: communicates with the device via SDK (any OS).
    - The mode is determined by configuration (MDB path vs device IP).
    - BiometricPunch is the universal data format returned by all providers.
    - The attendance_sync service consumes BiometricPunch records
      and writes them to the PostgreSQL attendance table.

NOT implemented yet:
    - Any actual device communication
    - MDB file reading
    - TCP socket connections
    - SDK integration
"""

from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import List, Optional
from dataclasses import dataclass


@dataclass
class BiometricPunch:
    """
    Universal punch record format returned by all providers.

    Attributes:
        employee_code: Device user ID/code (EnrollNumber in eSSL).
        punch_time: Timestamp of the punch (datetime).
        device_id: Optional device identifier (for multi-device setups).
        verified: Whether the punch was verified (fingerprint/card/PIN).
        punch_type: 'in' or 'out' (if the device reports it).
    """
    employee_code: str
    punch_time: datetime
    device_id: Optional[str] = None
    verified: bool = True
    punch_type: Optional[str] = None  # 'in', 'out', or None


class BiometricProvider(ABC):
    """Abstract base class for biometric device providers."""

    @abstractmethod
    def connect(self) -> bool:
        """
        Establish connection to the biometric device or database.

        Returns:
            True if connection succeeded, False otherwise.

        Raises:
            ConnectionError: If connection cannot be established.
        """
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Close connection to the biometric device or database."""
        pass

    @abstractmethod
    def get_punches(self, start_date: date, end_date: date) -> List[BiometricPunch]:
        """
        Retrieve punch records for the given date range.

        Args:
            start_date: First date to fetch (inclusive).
            end_date: Last date to fetch (inclusive).

        Returns:
            List of BiometricPunch records, sorted by punch_time.
        """
        pass

    @abstractmethod
    def get_enrolled_users(self) -> List[dict]:
        """
        Get list of users enrolled on the device.

        Returns:
            List of dicts with keys:
                - employee_code: str (EnrollNumber)
                - name: str
                - privilege: int (0=user, 1=admin, 2=super admin)
                - enabled: bool
        """
        pass

    @abstractmethod
    def is_connected(self) -> bool:
        """Check if the device connection is active."""
        pass


class ESSLProvider(BiometricProvider):
    """
    eSSL biometric device provider.

    Supports two modes:
        1. MDB mode: reads eTimeTrackLite .mdb file via pyodbc.
           Used when mdb_path is provided.
           Requires: Windows + pyodbc + Access ODBC driver.

        2. TCP mode: communicates with eSSL device via SDK.
           Used when device_ip and port are provided.
           Requires: eSSL SDK (eSSLDirect) library.

    Phase 2 implementation:
        - Implement MDB read via pyodbc.
        - Implement TCP communication via eSSL SDK.
        - Handle connection timeouts and retries.
        - Handle concurrent access (file locking for MDB).

    TODO Phase 2 — MDB Mode:
        1. Import pyodbc (Windows only).
        2. Build connection string:
           "DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};DBQ={mdb_path};"
        3. Open connection, execute SQL queries.
        4. Parse AttendanceLogs into BiometricPunch records.
        5. Handle MDB file locking (eTimeTrackLite may lock it).

    TODO Phase 2 — TCP Mode:
        1. Import eSSL SDK library.
        2. Connect to device_ip:port via TCP.
        3. Authenticate with device.
        4. Fetch punch logs via SDK commands.
        5. Parse responses into BiometricPunch records.
    """

    def __init__(
        self,
        device_ip: str = "192.168.1.100",
        port: int = 4370,
        mdb_path: Optional[str] = None,
    ):
        """
        Initialize the eSSL provider.

        Args:
            device_ip: IP address of the eSSL device (for TCP mode).
            port: TCP port of the eSSL device (default: 4370).
            mdb_path: Path to the .mdb file (for MDB mode).
                      If provided, MDB mode is used instead of TCP.
        """
        self.device_ip = device_ip
        self.port = port
        self.mdb_path = mdb_path
        self._connected = False
        self._connection = None

    def connect(self) -> bool:
        """
        Connect to the eSSL device or MDB file.

        If mdb_path is set, uses MDB mode (pyodbc).
        Otherwise, uses TCP mode (eSSL SDK).

        TODO Phase 2:
            if self.mdb_path:
                return self._connect_mdb()
            else:
                return self._connect_tcp()

        Returns:
            True if connected, False otherwise.
        """
        # Phase 2: Implement connection logic
        return False

    def disconnect(self) -> None:
        """Close the connection."""
        if self._connection:
            try:
                self._connection.close()
            except Exception:
                pass
        self._connection = None
        self._connected = False

    def get_punches(self, start_date: date, end_date: date) -> List[BiometricPunch]:
        """
        Fetch punch records from the eSSL device/MDB.

        TODO Phase 2:
            if self.mdb_path:
                return self._fetch_from_mdb(start_date, end_date)
            else:
                return self._fetch_from_device(start_date, end_date)

        Args:
            start_date: First date to fetch (inclusive).
            end_date: Last date to fetch (inclusive).

        Returns:
            List of BiometricPunch records.
        """
        # Phase 2: Implement punch fetching
        return []

    def get_enrolled_users(self) -> List[dict]:
        """
        Get users enrolled on the eSSL device.

        TODO Phase 2:
            if self.mdb_path:
                return self._get_users_from_mdb()
            else:
                return self._get_users_from_device()

        Returns:
            List of dicts with employee_code, name, privilege, enabled.
        """
        # Phase 2: Implement user listing
        return []

    def is_connected(self) -> bool:
        """Check if the connection is active."""
        return self._connected

    # ── Private helpers (Phase 2) ──────────────────────────────────────────

    def _connect_mdb(self) -> bool:
        """
        TODO Phase 2: Connect to MDB file via pyodbc.

        import pyodbc
        conn_str = (
            r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
            rf"DBQ={self.mdb_path};"
        )
        self._connection = pyodbc.connect(conn_str)
        self._connected = True
        return True
        """
        raise NotImplementedError("MDB mode not yet implemented.")

    def _connect_tcp(self) -> bool:
        """
        TODO Phase 2: Connect to eSSL device via TCP/SDK.

        # Using eSSL SDK or direct TCP socket:
        # sdk = eSSLDirect()
        # sdk.connect(self.device_ip, self.port)
        # self._connection = sdk
        # self._connected = True
        # return True
        """
        raise NotImplementedError("TCP mode not yet implemented.")

    def _fetch_from_mdb(self, start_date: date, end_date: date) -> List[BiometricPunch]:
        """
        TODO Phase 2: Read AttendanceLogs from MDB.

        cursor = self._connection.cursor()
        cursor.execute(
            "SELECT EnrollNumber, AttTime, VerifyMode, InOutMode "
            "FROM AttendanceLogs "
            "WHERE AttTime >= ? AND AttTime <= ?",
            (start_date, end_date),
        )
        punches = []
        for row in cursor.fetchall():
            punches.append(BiometricPunch(
                employee_code=str(row.EnrollNumber),
                punch_time=row.AttTime,
                verified=bool(row.VerifyMode),
            ))
        return punches
        """
        raise NotImplementedError("MDB punch fetch not yet implemented.")

    def _fetch_from_device(self, start_date: date, end_date: date) -> List[BiometricPunch]:
        """
        TODO Phase 2: Fetch punches from eSSL device via TCP/SDK.

        # Using eSSL SDK:
        # raw_logs = self._connection.get_attendance_log(
        #     start_date=start_date,
        #     end_date=end_date,
        # )
        # return [
        #     BiometricPunch(
        #         employee_code=str(log.enroll_number),
        #         punch_time=log.timestamp,
        #         verified=log.verified,
        #     )
        #     for log in raw_logs
        # ]
        """
        raise NotImplementedError("TCP punch fetch not yet implemented.")

    def _get_users_from_mdb(self) -> List[dict]:
        """
        TODO Phase 2: Read Employees table from MDB.

        cursor = self._connection.cursor()
        cursor.execute("SELECT EnrollNumber, Name, Privilege, Enabled FROM Employees")
        return [
            {
                "employee_code": str(row.EnrollNumber),
                "name": row.Name,
                "privilege": row.Privilege,
                "enabled": bool(row.Enabled),
            }
            for row in cursor.fetchall()
        ]
        """
        raise NotImplementedError("MDB user fetch not yet implemented.")

    def _get_users_from_device(self) -> List[dict]:
        """
        TODO Phase 2: Fetch enrolled users from eSSL device via TCP/SDK.

        # users = self._connection.get_users()
        # return [
        #     {"employee_code": str(u.id), "name": u.name, ...}
        #     for u in users
        # ]
        """
        raise NotImplementedError("TCP user fetch not yet implemented.")


# ── Provider Factory ──────────────────────────────────────────────────────

PROVIDERS = {
    "essl": ESSLProvider,
    # "zkteco": ZKTecoProvider,  # Phase 3
}


def get_provider(provider_name: str, **kwargs) -> BiometricProvider:
    """
    Factory function to get a biometric provider instance.

    Args:
        provider_name: Name of the provider (e.g., 'essl').
        **kwargs: Arguments passed to the provider constructor.

    Returns:
        BiometricProvider instance.

    Raises:
        ValueError: If provider_name is not registered.
    """
    provider_class = PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(
            f"Unknown biometric provider: {provider_name}. "
            f"Available: {list(PROVIDERS.keys())}"
        )
    return provider_class(**kwargs)
