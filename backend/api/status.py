from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict, List
import json
import asyncio
from models import get_db, Task, TaskStatus

router = APIRouter()

# WebSocket接続を管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, task_id: str):
        await websocket.accept()
        if task_id not in self.active_connections:
            self.active_connections[task_id] = []
        self.active_connections[task_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, task_id: str):
        if task_id in self.active_connections:
            self.active_connections[task_id].remove(websocket)
            if not self.active_connections[task_id]:
                del self.active_connections[task_id]
    
    async def send_update(self, task_id: str, data: dict):
        if task_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[task_id]:
                try:
                    await connection.send_json(data)
                except:
                    disconnected.append(connection)
            
            # 切断された接続を削除
            for conn in disconnected:
                self.active_connections[task_id].remove(conn)

manager = ConnectionManager()

@router.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    """WebSocket接続でリアルタイムステータス更新を配信"""
    await manager.connect(websocket, task_id)
    
    try:
        while True:
            # クライアントからのメッセージを待機
            data = await websocket.receive_text()
            
            # pingメッセージへの応答
            if data == "ping":
                await websocket.send_text("pong")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, task_id)

@router.get("/summary")
async def get_status_summary(db: Session = Depends(get_db)):
    """全体のステータスサマリーを取得"""
    
    # 各ステータスのタスク数を集計
    status_counts = {}
    for status in TaskStatus:
        count = db.query(Task).filter(Task.status == status).count()
        status_counts[status.value] = count
    
    # 実行中のタスクの詳細
    processing_tasks = db.query(Task).filter(
        Task.status == TaskStatus.PROCESSING
    ).all()
    
    # 最近完了したタスク（最新10件）
    recent_completed = db.query(Task).filter(
        Task.status == TaskStatus.COMPLETED
    ).order_by(Task.completed_at.desc()).limit(10).all()
    
    # 最近失敗したタスク（最新5件）
    recent_failed = db.query(Task).filter(
        Task.status == TaskStatus.FAILED
    ).order_by(Task.completed_at.desc()).limit(5).all()
    
    return {
        "status_counts": status_counts,
        "total_tasks": sum(status_counts.values()),
        "processing_tasks": [
            {
                "task_id": task.task_id,
                "task_type": task.task_type,
                "progress": task.progress,
                "current_step": task.current_step,
                "started_at": task.started_at.isoformat() if task.started_at else None
            }
            for task in processing_tasks
        ],
        "recent_completed": [
            {
                "task_id": task.task_id,
                "task_type": task.task_type,
                "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                "actual_time": task.actual_time
            }
            for task in recent_completed
        ],
        "recent_failed": [
            {
                "task_id": task.task_id,
                "task_type": task.task_type,
                "error_message": task.error_message,
                "failed_at": task.completed_at.isoformat() if task.completed_at else None
            }
            for task in recent_failed
        ]
    }

@router.get("/active")
async def get_active_tasks(db: Session = Depends(get_db)):
    """アクティブなタスク（実行中・保留中）を取得"""
    
    active_tasks = db.query(Task).filter(
        Task.status.in_([TaskStatus.PENDING, TaskStatus.PROCESSING])
    ).order_by(Task.created_at.asc()).all()
    
    return {
        "active_tasks": [
            {
                "task_id": task.task_id,
                "task_type": task.task_type,
                "status": task.status.value,
                "progress": task.progress,
                "current_step": task.current_step,
                "total_steps": task.total_steps,
                "completed_steps": task.completed_steps,
                "created_at": task.created_at.isoformat() if task.created_at else None,
                "started_at": task.started_at.isoformat() if task.started_at else None,
                "estimated_time": task.estimated_time
            }
            for task in active_tasks
        ],
        "total": len(active_tasks)
    }

@router.post("/notify/{task_id}")
async def notify_task_update(
    task_id: str,
    db: Session = Depends(get_db)
):
    """タスク更新をWebSocketクライアントに通知"""
    
    task = db.query(Task).filter(Task.task_id == task_id).first()
    
    if not task:
        return {"error": f"Task {task_id} not found"}
    
    # WebSocketで接続中のクライアントに更新を送信
    await manager.send_update(task_id, {
        "task_id": task.task_id,
        "status": task.status.value,
        "progress": task.progress,
        "current_step": task.current_step,
        "total_steps": task.total_steps,
        "completed_steps": task.completed_steps,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None
    })
    
    return {
        "task_id": task_id,
        "status": "notified",
        "connections": len(manager.active_connections.get(task_id, []))
    }