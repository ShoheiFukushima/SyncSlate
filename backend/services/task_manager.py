from sqlalchemy.orm import Session
from models import SessionLocal, Task, TaskStatus, TaskLog
from datetime import datetime
import requests
import json
import logging

logger = logging.getLogger(__name__)

class TaskManager:
    """タスク管理のヘルパークラス"""
    
    def __init__(self):
        self.api_base_url = "http://localhost:8000/api"
    
    def get_db(self):
        """データベースセッションを取得"""
        return SessionLocal()
    
    def update_task_status(
        self,
        task_id: str,
        status: str = None,
        progress: float = None,
        current_step: str = None,
        completed_steps: int = None,
        total_steps: int = None,
        error_message: str = None,
        output_data: str = None
    ):
        """タスクステータスを更新"""
        db = self.get_db()
        
        try:
            task = db.query(Task).filter(Task.task_id == task_id).first()
            
            if not task:
                logger.error(f"Task {task_id} not found")
                return False
            
            # ステータスの更新
            if status:
                try:
                    task.status = TaskStatus(status)
                    
                    if status == 'processing' and not task.started_at:
                        task.started_at = datetime.utcnow()
                    
                    if status in ['completed', 'failed', 'cancelled']:
                        task.completed_at = datetime.utcnow()
                        if task.started_at:
                            task.actual_time = (task.completed_at - task.started_at).total_seconds()
                except ValueError:
                    logger.error(f"Invalid status: {status}")
            
            # その他のフィールドの更新
            if progress is not None:
                task.progress = min(100.0, max(0.0, progress))
            
            if current_step is not None:
                task.current_step = current_step
            
            if completed_steps is not None:
                task.completed_steps = completed_steps
                if task.total_steps and task.total_steps > 0:
                    task.progress = (completed_steps / task.total_steps) * 100
            
            if total_steps is not None:
                task.total_steps = total_steps
            
            if error_message is not None:
                task.error_message = error_message
            
            if output_data is not None:
                task.output_data = output_data
            
            task.updated_at = datetime.utcnow()
            
            db.commit()
            
            # WebSocket通知を送信
            self._notify_update(task_id)
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating task {task_id}: {e}")
            db.rollback()
            return False
        
        finally:
            db.close()
    
    def add_task_log(
        self,
        task_id: str,
        message: str,
        level: str = "INFO",
        step_name: str = None,
        step_progress: float = None,
        metadata: dict = None
    ):
        """タスクログを追加"""
        db = self.get_db()
        
        try:
            task = db.query(Task).filter(Task.task_id == task_id).first()
            
            if not task:
                logger.error(f"Task {task_id} not found")
                return False
            
            log = TaskLog(
                task_id=task.id,
                level=level,
                message=message,
                step_name=step_name,
                step_progress=step_progress,
                metadata=json.dumps(metadata) if metadata else None
            )
            
            db.add(log)
            db.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error adding log for task {task_id}: {e}")
            db.rollback()
            return False
        
        finally:
            db.close()
    
    def _notify_update(self, task_id: str):
        """WebSocket経由で更新を通知"""
        try:
            requests.post(
                f"{self.api_base_url}/status/notify/{task_id}",
                timeout=1
            )
        except Exception as e:
            logger.warning(f"Failed to send WebSocket notification: {e}")