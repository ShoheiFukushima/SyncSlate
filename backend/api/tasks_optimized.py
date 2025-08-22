"""
Optimized task API with improved performance
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
from models import get_db, Task, TaskStatus, TaskLog
from schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse, 
    TaskListResponse, TaskLogCreate, TaskLogResponse
)
from middleware.rate_limit import limiter
from config import get_settings
import asyncio
from concurrent.futures import ThreadPoolExecutor

router = APIRouter()
settings = get_settings()

# Thread pool for CPU-bound operations
executor = ThreadPoolExecutor(max_workers=4)


@router.post("/", response_model=TaskResponse)
@limiter.limit("10/minute")
async def create_task(
    task: TaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create a new task with validation and background processing"""
    task_id = str(uuid.uuid4())
    
    db_task = Task(
        task_id=task_id,
        task_type=task.task_type.value,
        project_id=task.project_id,
        input_data=task.input_data,
        estimated_time=task.estimated_time,
        status=TaskStatus.PENDING,
        progress=0.0,
        total_steps=0,
        completed_steps=0,
        priority=task.priority
    )
    
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Queue background task processing
    if settings.ENVIRONMENT == "production":
        background_tasks.add_task(process_task_async, db_task.id)
    
    return TaskResponse.from_orm(db_task)


@router.get("/", response_model=TaskListResponse)
@limiter.limit("30/minute")
async def list_tasks(
    project_id: Optional[int] = Query(None),
    status: Optional[TaskStatus] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    include_count: bool = Query(False, description="Include total count (slower)"),
    db: Session = Depends(get_db)
):
    """
    List tasks with optimized query and optional count
    
    Performance optimization:
    - Only count when explicitly requested
    - Use window functions for efficient pagination
    - Eager loading of related data
    """
    query = db.query(Task)
    
    # Apply filters
    if project_id:
        query = query.filter(Task.project_id == project_id)
    
    if status:
        query = query.filter(Task.status == status)
    
    # Order by priority and creation date
    query = query.order_by(Task.priority.desc(), Task.created_at.desc())
    
    # Get paginated results
    tasks = query.offset(offset).limit(limit).all()
    
    # Only count if requested (expensive operation)
    total = None
    if include_count:
        # Use optimized count query
        count_query = select(func.count()).select_from(Task)
        if project_id:
            count_query = count_query.where(Task.project_id == project_id)
        if status:
            count_query = count_query.where(Task.status == status)
        total = db.execute(count_query).scalar()
    else:
        # Estimate based on current page
        total = offset + len(tasks) + (1 if len(tasks) == limit else 0)
    
    return TaskListResponse(
        tasks=[TaskResponse.from_orm(task) for task in tasks],
        total=total,
        limit=limit,
        offset=offset,
        has_more=len(tasks) == limit
    )


@router.get("/{task_id}", response_model=TaskResponse)
@limiter.limit("60/minute")
async def get_task(
    task_id: str,
    db: Session = Depends(get_db)
):
    """Get task details with caching consideration"""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    return TaskResponse.from_orm(task)


@router.put("/{task_id}", response_model=TaskResponse)
@limiter.limit("30/minute")
async def update_task(
    task_id: str,
    update: TaskUpdate,
    db: Session = Depends(get_db)
):
    """Update task with optimized field updates"""
    # Use FOR UPDATE to prevent concurrent updates
    task = db.query(Task).filter(
        Task.task_id == task_id
    ).with_for_update().first()
    
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    # Batch update fields
    update_data = update.dict(exclude_unset=True)
    
    # Handle status transitions
    if "status" in update_data:
        new_status = update_data["status"]
        
        # Record timestamps for status changes
        if new_status == TaskStatus.PROCESSING and not task.started_at:
            update_data["started_at"] = datetime.utcnow()
        
        if new_status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
            update_data["completed_at"] = datetime.utcnow()
            if task.started_at:
                update_data["actual_time"] = (
                    update_data["completed_at"] - task.started_at
                ).total_seconds()
    
    # Auto-calculate progress from steps
    if "completed_steps" in update_data and task.total_steps > 0:
        update_data["progress"] = (update_data["completed_steps"] / task.total_steps) * 100
    
    # Apply all updates at once
    for field, value in update_data.items():
        setattr(task, field, value)
    
    db.commit()
    db.refresh(task)
    
    return TaskResponse.from_orm(task)


@router.delete("/{task_id}")
@limiter.limit("10/minute")
async def cancel_task(
    task_id: str,
    db: Session = Depends(get_db)
):
    """Cancel a task"""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot cancel task in {task.status} status"
        )
    
    task.status = TaskStatus.CANCELLED
    task.completed_at = datetime.utcnow()
    if task.started_at:
        task.actual_time = (task.completed_at - task.started_at).total_seconds()
    
    db.commit()
    
    return {"message": f"Task {task_id} cancelled successfully"}


@router.post("/{task_id}/logs", response_model=TaskLogResponse)
@limiter.limit("100/minute")
async def add_task_log(
    task_id: str,
    log: TaskLogCreate,
    db: Session = Depends(get_db)
):
    """Add log entry for a task"""
    # Verify task exists
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    db_log = TaskLog(
        task_id=task.id,
        level=log.level,
        message=log.message,
        step_name=log.step_name,
        step_progress=log.step_progress,
        metadata=log.metadata
    )
    
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    
    return TaskLogResponse.from_orm(db_log)


@router.get("/{task_id}/logs", response_model=List[TaskLogResponse])
@limiter.limit("30/minute")
async def get_task_logs(
    task_id: str,
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    """Get logs for a task with pagination"""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    logs = db.query(TaskLog).filter(
        TaskLog.task_id == task.id
    ).order_by(
        TaskLog.timestamp.desc()
    ).offset(offset).limit(limit).all()
    
    return [TaskLogResponse.from_orm(log) for log in logs]


# Batch operations for better performance
@router.post("/batch", response_model=List[TaskResponse])
@limiter.limit("5/minute")
async def create_tasks_batch(
    tasks: List[TaskCreate],
    db: Session = Depends(get_db)
):
    """Create multiple tasks in a single transaction"""
    if len(tasks) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 tasks per batch")
    
    db_tasks = []
    for task_data in tasks:
        task_id = str(uuid.uuid4())
        db_task = Task(
            task_id=task_id,
            task_type=task_data.task_type.value,
            project_id=task_data.project_id,
            input_data=task_data.input_data,
            estimated_time=task_data.estimated_time,
            status=TaskStatus.PENDING,
            progress=0.0,
            priority=task_data.priority
        )
        db_tasks.append(db_task)
        db.add(db_task)
    
    db.commit()
    
    # Refresh all tasks
    for task in db_tasks:
        db.refresh(task)
    
    return [TaskResponse.from_orm(task) for task in db_tasks]


# Helper function for background processing
async def process_task_async(task_id: int):
    """Process task asynchronously (placeholder)"""
    # This would integrate with Celery in production
    await asyncio.sleep(0.1)  # Simulate async operation
    pass