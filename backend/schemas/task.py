"""
Task-related Pydantic schemas with enhanced validation
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, validator, constr, confloat
from enum import Enum


class TaskStatus(str, Enum):
    """Task status enumeration"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskType(str, Enum):
    """Task type enumeration"""
    VIDEO_EDIT = "video_edit"
    AUDIO_PROCESS = "audio_process"
    IMAGE_PROCESS = "image_process"
    TRANSCRIPTION = "transcription"
    ANALYSIS = "analysis"


class TaskCreate(BaseModel):
    """Schema for creating a new task"""
    task_type: TaskType
    project_id: Optional[int] = Field(None, ge=1)
    input_data: Optional[Dict[str, Any]] = Field(None)
    estimated_time: Optional[confloat(ge=0)] = Field(None, description="Estimated time in seconds")
    priority: Optional[int] = Field(5, ge=1, le=10, description="Priority from 1 (lowest) to 10 (highest)")
    
    @validator("input_data")
    def validate_input_data(cls, v):
        """Validate input data structure"""
        if v is not None:
            # Ensure no sensitive data in input
            sensitive_keys = {"password", "secret", "token", "key", "credential"}
            if any(key in str(v).lower() for key in sensitive_keys):
                raise ValueError("Input data contains potentially sensitive information")
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "task_type": "video_edit",
                "project_id": 1,
                "input_data": {"source": "video.mp4", "preset": "high_quality"},
                "estimated_time": 300,
                "priority": 5
            }
        }


class TaskUpdate(BaseModel):
    """Schema for updating an existing task"""
    status: Optional[TaskStatus] = None
    progress: Optional[confloat(ge=0, le=100)] = Field(None, description="Progress percentage")
    current_step: Optional[constr(max_length=200)] = None
    total_steps: Optional[int] = Field(None, ge=0)
    completed_steps: Optional[int] = Field(None, ge=0)
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[constr(max_length=1000)] = None
    
    @validator("completed_steps")
    def validate_completed_steps(cls, v, values):
        """Ensure completed steps don't exceed total steps"""
        total = values.get("total_steps")
        if total is not None and v is not None and v > total:
            raise ValueError("Completed steps cannot exceed total steps")
        return v
    
    @validator("output_data")
    def validate_output_data(cls, v):
        """Validate output data"""
        if v is not None:
            # Limit output data size
            import json
            if len(json.dumps(v)) > 10000:  # 10KB limit
                raise ValueError("Output data is too large")
        return v


class TaskResponse(BaseModel):
    """Schema for task response"""
    id: int
    task_id: str
    project_id: Optional[int]
    task_type: str
    status: TaskStatus
    progress: float
    current_step: Optional[str]
    total_steps: int
    completed_steps: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    estimated_time: Optional[float]
    actual_time: Optional[float]
    error_message: Optional[str]
    priority: int = 5
    
    class Config:
        orm_mode = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class TaskListResponse(BaseModel):
    """Schema for task list response"""
    tasks: List[TaskResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
    
    @validator("has_more", pre=False, always=True)
    def calculate_has_more(cls, v, values):
        """Calculate if there are more results"""
        total = values.get("total", 0)
        offset = values.get("offset", 0)
        limit = values.get("limit", 0)
        return offset + limit < total


class TaskLogCreate(BaseModel):
    """Schema for creating a task log"""
    level: constr(regex="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$") = "INFO"
    message: constr(max_length=1000)
    step_name: Optional[constr(max_length=200)] = None
    step_progress: Optional[confloat(ge=0, le=100)] = None
    metadata: Optional[Dict[str, Any]] = None
    
    @validator("metadata")
    def validate_metadata(cls, v):
        """Validate metadata size"""
        if v is not None:
            import json
            if len(json.dumps(v)) > 5000:  # 5KB limit
                raise ValueError("Metadata is too large")
        return v


class TaskLogResponse(BaseModel):
    """Schema for task log response"""
    id: int
    task_id: int
    timestamp: datetime
    level: str
    message: str
    step_name: Optional[str]
    step_progress: Optional[float]
    metadata: Optional[Dict[str, Any]]
    
    class Config:
        orm_mode = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }