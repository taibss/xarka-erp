from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from database import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    agenda = Column(Text, nullable=True)
    meeting_time = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=60)
    created_by = Column(Integer, ForeignKey("employees.id"), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
