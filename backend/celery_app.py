from celery import Celery
from celery.signals import task_prerun, task_postrun, task_failure
import os
from dotenv import load_dotenv

load_dotenv()

# Celeryアプリケーションの作成
celery_app = Celery(
    'autoedit_tate',
    broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    backend=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    include=['services.tasks']
)

# Celery設定
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1時間のタイムアウト
    task_soft_time_limit=3300,  # 55分のソフトタイムアウト
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

# タスク開始時のシグナル
@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **extras):
    """タスク開始時の処理"""
    from services.task_manager import TaskManager
    manager = TaskManager()
    manager.update_task_status(
        task_id=kwargs.get('task_id'),
        status='processing',
        current_step='Task started'
    )

# タスク完了時のシグナル
@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, retval=None, state=None, **extras):
    """タスク完了時の処理"""
    from services.task_manager import TaskManager
    manager = TaskManager()
    
    if state == 'SUCCESS':
        manager.update_task_status(
            task_id=kwargs.get('task_id'),
            status='completed',
            progress=100.0,
            current_step='Task completed successfully'
        )

# タスク失敗時のシグナル
@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, args=None, kwargs=None, traceback=None, einfo=None, **extras):
    """タスク失敗時の処理"""
    from services.task_manager import TaskManager
    manager = TaskManager()
    
    manager.update_task_status(
        task_id=kwargs.get('task_id'),
        status='failed',
        error_message=str(exception),
        current_step='Task failed'
    )

if __name__ == '__main__':
    celery_app.start()