from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
from models import get_db, Task, TaskStatus, TaskLog
from pydantic import BaseModel

router = APIRouter()

class TaskCreate(BaseModel):
    task_type: str
    project_id: Optional[int] = None
    input_data: Optional[str] = None
    estimated_time: Optional[float] = None

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    progress: Optional[float] = None
    current_step: Optional[str] = None
    total_steps: Optional[int] = None
    completed_steps: Optional[int] = None
    output_data: Optional[str] = None
    error_message: Optional[str] = None

class TaskLogCreate(BaseModel):
    level: str = "INFO"
    message: str
    step_name: Optional[str] = None
    step_progress: Optional[float] = None
    metadata: Optional[str] = None

@router.post("/")
async def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """新しいタスクを作成"""
    task_id = str(uuid.uuid4())
    db_task = Task(
        task_id=task_id,
        task_type=task.task_type,
        project_id=task.project_id,
        input_data=task.input_data,
        estimated_time=task.estimated_time,
        status=TaskStatus.PENDING,
        progress=0.0,
        total_steps=0,
        completed_steps=0
    )
    
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    return {
        "task_id": db_task.task_id,
        "status": "created",
        "message": f"Task {task_id} created successfully"
    }

@router.get("/")
async def list_tasks(
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    """タスク一覧を取得"""
    query = db.query(Task)
    
    if project_id:
        query = query.filter(Task.project_id == project_id)
    
    if status:
        try:
            status_enum = TaskStatus(status)
            query = query.filter(Task.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    tasks = query.offset(offset).limit(limit).all()
    
    return {
        "tasks": [task.to_dict() for task in tasks],
        "total": query.count(),
        "limit": limit,
        "offset": offset
    }

@router.get("/{task_id}")
async def get_task(task_id: str, db: Session = Depends(get_db)):
    """特定のタスクの詳細を取得"""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    return task.to_dict()

@router.put("/{task_id}")
async def update_task(
    task_id: str,
    update: TaskUpdate,
    db: Session = Depends(get_db)
):
    """タスクの状態を更新"""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    # 状態の更新
    if update.status:
        try:
            new_status = TaskStatus(update.status)
            task.status = new_status
            
            # 開始時刻の記録
            if new_status == TaskStatus.PROCESSING and not task.started_at:
                task.started_at = datetime.utcnow()
            
            # 完了時刻の記録
            if new_status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
                task.completed_at = datetime.utcnow()
                if task.started_at:
                    task.actual_time = (task.completed_at - task.started_at).total_seconds()
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {update.status}")
    
    # その他のフィールドの更新
    if update.progress is not None:
        task.progress = min(100.0, max(0.0, update.progress))
    
    if update.current_step is not None:
        task.current_step = update.current_step
    
    if update.total_steps is not None:
        task.total_steps = update.total_steps
    
    if update.completed_steps is not None:
        task.completed_steps = update.completed_steps
        # 進捗率の自動計算
        if task.total_steps > 0:
            task.progress = (task.completed_steps / task.total_steps) * 100
    
    if update.output_data is not None:
        task.output_data = update.output_data
    
    if update.error_message is not None:
        task.error_message = update.error_message
    
    task.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    
    return {
        "task_id": task.task_id,
        "status": "updated",
        "current_status": task.status.value,
        "progress": task.progress
    }

@router.delete("/{task_id}")
async def delete_task(task_id: str, db: Session = Depends(get_db)):
    """タスクを削除"""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    db.delete(task)
    db.commit()
    
    return {
        "task_id": task_id,
        "status": "deleted",
        "message": f"Task {task_id} deleted successfully"
    }

@router.post("/{task_id}/logs")
async def add_task_log(
    task_id: str,
    log: TaskLogCreate,
    db: Session = Depends(get_db)
):
    """タスクログを追加"""
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
    
    return {
        "log_id": db_log.id,
        "task_id": task_id,
        "status": "logged",
        "message": "Log entry added successfully"
    }

@router.get("/{task_id}/logs")
async def get_task_logs(
    task_id: str,
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    """タスクログを取得"""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    logs = db.query(TaskLog).filter(
        TaskLog.task_id == task.id
    ).order_by(
        TaskLog.timestamp.desc()
    ).offset(offset).limit(limit).all()
    
    return {
        "task_id": task_id,
        "logs": [log.to_dict() for log in logs],
        "total": db.query(TaskLog).filter(TaskLog.task_id == task.id).count(),
        "limit": limit,
        "offset": offset
    }