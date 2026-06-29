"""
Biometric Provider Interface

Abstract base for biometric device integrations (eSSL, ZKTeco, etc.).
Phase 2: Implement actual device communication here.
"""
from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import List, Optional
from dataclasses import dataclass


@dataclass
class BiometricPunch:
    """Represents a single punch record from a biometric device."""
    employee_code: str
    punch_time: datetime
    device_id: Optional[str] = None
    verified: bool = True


class BiometricProvider(ABC):
    """Abstract base class for biometric device providers."""

    @abstractmethod
    def connect(self) -> bool:
        """Establish connection to the biometric device."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Close connection to the biometric device."""
        pass

    @abstractmethod
    def get_punches(self, start_date: date, end_date: date) -> List[BiometricPunch]:
        """Retrieve punch records from the device for the given date range."""
        pass

    @abstractmethod
    def get_enrolled_users(self) -> List[dict]:
        """Get list of users enrolled on the device."""
        pass

    @abstractmethod
    def is_connected(self) -> bool:
        """Check if the device connection is active."""
        pass


class ESSLProvider(BiometricProvider):
    """
    eSSL biometric device provider.

    Phase 2: Implement MDB file reading and device communication.
    Stub implementation for architecture preparation.
    """

    def __init__(self, device_ip: str = "192.168.1.100", port: int = 4370):
        self.device_ip = device_ip
        self.port = port
        self._connected = False

    def connect(self) -> bool:
        # Phase 2: Implement actual TCP connection to eSSL device
        # self._connected = self._tcp_connect()
        return False

    def disconnect(self) -> None:
        self._connected = False

    def get_punches(self, start_date: date, end_date: date) -> List[BiometricPunch]:
        # Phase 2: Read MDB file or query device via SDK
        return []

    def get_enrolled_users(self) -> List[dict]:
        # Phase 2: Query device for enrolled user list
        return []

    def is_connected(self) -> bool:
        return self._connected


# Provider factory
PROVIDERS = {
    "essl": ESSLProvider,
}


def get_provider(provider_name: str, **kwargs) -> BiometricProvider:
    """Factory function to get a biometric provider instance."""
    provider_class = PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f"Unknown biometric provider: {provider_name}")
    return provider_class(**kwargs)
