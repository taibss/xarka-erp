from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class EmployeeBiometricMapping(Base):
    __tablename__ = "employee_biometric_mapping"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, unique=True)
    provider = Column(String, nullable=False)  # essl, future_provider
    external_employee_id = Column(String, nullable=True)  # biometric device user ID
    external_employee_code = Column(String, nullable=True)  # biometric device user code
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
