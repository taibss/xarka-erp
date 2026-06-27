from sqlalchemy import Column, Integer, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from database import Base

class TaskTimer(Base):
    __tablename__ = "task_timers"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    started_at = Column(DateTime, nullable=False)
    stopped_at = Column(DateTime, nullable=True)
    duration_hours = Column(Float, nullable=True)
    created_at = Column(DateTime, default=func.now())