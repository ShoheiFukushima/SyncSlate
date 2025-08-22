from sqlalchemy import Column, Integer, String, DateTime, Float, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum
from .database import Base

class TaskStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, index=True, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    task_type = Column(String(50), nullable=False)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    progress = Column(Float, default=0.0)
    current_step = Column(String(200))
    total_steps = Column(Integer, default=0)
    completed_steps = Column(Integer, default=0)
    
    input_data = Column(Text)
    output_data = Column(Text)
    error_message = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    estimated_time = Column(Float)
    actual_time = Column(Float)
    
    # Relationships
    project = relationship("Project", back_populates="tasks")
    logs = relationship("TaskLog", back_populates="task", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "project_id": self.project_id,
            "task_type": self.task_type,
            "status": self.status.value if self.status else None,
            "progress": self.progress,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "completed_steps": self.completed_steps,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "estimated_time": self.estimated_time,
            "actual_time": self.actual_time,
            "error_message": self.error_message
        }

class TaskLog(Base):
    __tablename__ = "task_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    level = Column(String(20), default="INFO")
    message = Column(Text)
    step_name = Column(String(200))
    step_progress = Column(Float)
    metadata = Column(Text)
    
    # Relationships
    task = relationship("Task", back_populates="logs")
    
    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "level": self.level,
            "message": self.message,
            "step_name": self.step_name,
            "step_progress": self.step_progress,
            "metadata": self.metadata
        }