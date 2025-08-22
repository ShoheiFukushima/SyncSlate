"""
Enhanced Celery tasks with retry logic and error handling
"""
from celery import Celery, Task
from celery.exceptions import MaxRetriesExceededError, SoftTimeLimitExceeded
from typing import Dict, Any, Optional
import logging
import traceback
from datetime import datetime
from config import get_settings
from models import SessionLocal, Task as TaskModel, TaskStatus, TaskLog
import json

settings = get_settings()
logger = logging.getLogger(__name__)

# Create Celery app
app = Celery('autoedit_tate')
app.config_from_object({
    'broker_url': settings.CELERY_BROKER_URL,
    'result_backend': settings.CELERY_RESULT_BACKEND,
    'task_serializer': 'json',
    'accept_content': ['json'],
    'result_serializer': 'json',
    'timezone': 'UTC',
    'enable_utc': True,
    'task_track_started': True,
    'task_time_limit': 3600,  # 1 hour hard limit
    'task_soft_time_limit': 3300,  # 55 minutes soft limit
    'task_acks_late': True,
    'worker_prefetch_multiplier': 1,
    'worker_max_tasks_per_child': 100,
})


class BaseTaskWithRetry(Task):
    """Base task class with automatic retry and error handling"""
    
    autoretry_for = (Exception,)
    max_retries = settings.CELERY_TASK_MAX_RETRIES
    default_retry_delay = settings.CELERY_TASK_RETRY_DELAY
    retry_backoff = True
    retry_backoff_max = 600  # Max 10 minutes between retries
    retry_jitter = True  # Add randomness to retry delay
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure"""
        logger.error(f"Task {task_id} failed: {exc}")
        self.update_task_status(
            kwargs.get('task_id'),
            TaskStatus.FAILED,
            error_message=str(exc)
        )
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Handle task retry"""
        logger.warning(f"Task {task_id} retrying: {exc}")
        self.add_task_log(
            kwargs.get('task_id'),
            level="WARNING",
            message=f"Task retry attempt {self.request.retries + 1}/{self.max_retries}: {exc}"
        )
    
    def on_success(self, retval, task_id, args, kwargs):
        """Handle task success"""
        logger.info(f"Task {task_id} completed successfully")
        self.update_task_status(
            kwargs.get('task_id'),
            TaskStatus.COMPLETED,
            progress=100.0
        )
    
    def update_task_status(
        self, 
        task_id: str, 
        status: TaskStatus, 
        progress: Optional[float] = None,
        error_message: Optional[str] = None
    ):
        """Update task status in database"""
        if not task_id:
            return
            
        db = SessionLocal()
        try:
            task = db.query(TaskModel).filter(TaskModel.task_id == task_id).first()
            if task:
                task.status = status
                if progress is not None:
                    task.progress = progress
                if error_message:
                    task.error_message = error_message
                if status == TaskStatus.COMPLETED:
                    task.completed_at = datetime.utcnow()
                    if task.started_at:
                        task.actual_time = (task.completed_at - task.started_at).total_seconds()
                db.commit()
        except Exception as e:
            logger.error(f"Failed to update task status: {e}")
            db.rollback()
        finally:
            db.close()
    
    def add_task_log(
        self,
        task_id: str,
        level: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Add log entry for task"""
        if not task_id:
            return
            
        db = SessionLocal()
        try:
            task = db.query(TaskModel).filter(TaskModel.task_id == task_id).first()
            if task:
                log = TaskLog(
                    task_id=task.id,
                    level=level,
                    message=message,
                    metadata=json.dumps(metadata) if metadata else None
                )
                db.add(log)
                db.commit()
        except Exception as e:
            logger.error(f"Failed to add task log: {e}")
            db.rollback()
        finally:
            db.close()


@app.task(base=BaseTaskWithRetry, bind=True, name='process_video')
def process_video_task(
    self,
    task_id: str,
    input_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Process video editing task with retry logic
    
    Args:
        task_id: Unique task identifier
        input_data: Task input parameters
    
    Returns:
        Processing result
    """
    try:
        # Update task status to processing
        self.update_task_status(task_id, TaskStatus.PROCESSING, progress=0)
        self.add_task_log(task_id, "INFO", "Starting video processing")
        
        # Simulate processing steps
        steps = [
            ("Loading video", 10),
            ("Analyzing content", 30),
            ("Applying edits", 60),
            ("Rendering output", 90),
            ("Finalizing", 100)
        ]
        
        for step_name, progress in steps:
            # Check for soft time limit
            if self.request.id:
                self.update_task_status(task_id, TaskStatus.PROCESSING, progress=progress)
                self.add_task_log(
                    task_id, 
                    "INFO", 
                    step_name,
                    metadata={"progress": progress}
                )
            
            # Simulate processing time
            import time
            time.sleep(2)  # Replace with actual processing
        
        # Return result
        result = {
            "status": "success",
            "output_path": f"/outputs/{task_id}.mp4",
            "duration": 60.0,
            "frames_processed": 1800
        }
        
        self.add_task_log(task_id, "INFO", "Processing completed", metadata=result)
        return result
        
    except SoftTimeLimitExceeded:
        # Handle soft time limit
        self.add_task_log(task_id, "ERROR", "Task exceeded time limit")
        raise self.retry(countdown=60)
        
    except Exception as exc:
        # Log full traceback
        self.add_task_log(
            task_id,
            "ERROR",
            f"Processing failed: {exc}",
            metadata={"traceback": traceback.format_exc()}
        )
        
        # Retry with exponential backoff
        raise self.retry(exc=exc)


@app.task(base=BaseTaskWithRetry, bind=True, name='analyze_audio')
def analyze_audio_task(
    self,
    task_id: str,
    input_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Analyze audio with retry logic
    """
    try:
        self.update_task_status(task_id, TaskStatus.PROCESSING, progress=0)
        self.add_task_log(task_id, "INFO", "Starting audio analysis")
        
        # Audio analysis steps
        steps = [
            ("Extracting audio", 20),
            ("Detecting beats", 40),
            ("Analyzing frequencies", 60),
            ("Identifying patterns", 80),
            ("Generating report", 100)
        ]
        
        for step_name, progress in steps:
            self.update_task_status(task_id, TaskStatus.PROCESSING, progress=progress)
            self.add_task_log(task_id, "INFO", step_name)
            
            # Simulate processing
            import time
            time.sleep(1)
        
        result = {
            "status": "success",
            "bpm": 120,
            "key": "C major",
            "energy": 0.75
        }
        
        return result
        
    except Exception as exc:
        raise self.retry(exc=exc)


@app.task(bind=True, name='batch_process')
def batch_process_task(
    self,
    task_ids: List[str],
    operation: str
) -> Dict[str, Any]:
    """
    Process multiple tasks in batch
    """
    results = {}
    failed = []
    
    for task_id in task_ids:
        try:
            if operation == "video":
                result = process_video_task.apply_async(
                    kwargs={"task_id": task_id, "input_data": {}}
                )
            elif operation == "audio":
                result = analyze_audio_task.apply_async(
                    kwargs={"task_id": task_id, "input_data": {}}
                )
            else:
                raise ValueError(f"Unknown operation: {operation}")
                
            results[task_id] = {"status": "queued", "task_id": result.id}
            
        except Exception as e:
            failed.append(task_id)
            results[task_id] = {"status": "failed", "error": str(e)}
    
    return {
        "processed": len(task_ids) - len(failed),
        "failed": len(failed),
        "results": results
    }


# Health check task
@app.task(name='health_check')
def health_check() -> Dict[str, Any]:
    """Simple health check task"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "worker": app.current_worker_task.request.hostname if hasattr(app, 'current_worker_task') else "unknown"
    }