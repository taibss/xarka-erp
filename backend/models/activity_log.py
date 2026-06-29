from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    action = Column(String, nullable=False)  # created, moved, completed, assigned, commented
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    detail = Column(Text, nullable=True)  # e.g. "moved to Review"
    created_at = Column(DateTime, default=func.now())
