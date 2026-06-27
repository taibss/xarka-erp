from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, nullable=False)  # overdue_task, leave_approved, leave_rejected, task_assigned, new_comment, daily_digest
    link = Column(String, nullable=True)   # frontend route, e.g. "/kanban"
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
