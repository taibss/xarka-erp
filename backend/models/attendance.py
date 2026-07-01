from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, default="present")  # present, absent, half-day
    punch_in = Column(DateTime, nullable=True)
    punch_out = Column(DateTime, nullable=True)
    hours_worked = Column(Float, nullable=True)
    is_late = Column(Boolean, default=False)

    # Biometric integration fields
    source = Column(String, default="manual")  # manual, essl, future_provider
    source_employee_id = Column(String, nullable=True)  # external biometric user ID
    late_by = Column(Float, nullable=True)  # minutes late
    early_by = Column(Float, nullable=True)  # minutes left early
    synced_at = Column(DateTime, nullable=True)  # when biometric data was synced
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    employee = relationship("Employee", backref="attendances")
