import pytest
from fastapi.testclient import TestClient
from main import app
from models import Base, engine

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    """テスト用データベースのセットアップ"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def test_root():
    """ルートエンドポイントのテスト"""
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()
    assert response.json()["message"] == "AutoEditTATE Task Management API"

def test_health_check():
    """ヘルスチェックのテスト"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_create_task():
    """タスク作成のテスト"""
    task_data = {
        "task_type": "video_edit",
        "input_data": '{"test": "data"}',
        "estimated_time": 300
    }
    
    response = client.post("/api/tasks/", json=task_data)
    assert response.status_code == 200
    assert "task_id" in response.json()
    assert response.json()["status"] == "created"

def test_get_task():
    """タスク取得のテスト"""
    # まずタスクを作成
    task_data = {
        "task_type": "video_edit",
        "input_data": '{"test": "data"}'
    }
    create_response = client.post("/api/tasks/", json=task_data)
    task_id = create_response.json()["task_id"]
    
    # タスクを取得
    response = client.get(f"/api/tasks/{task_id}")
    assert response.status_code == 200
    assert response.json()["task_id"] == task_id
    assert response.json()["task_type"] == "video_edit"
    assert response.json()["status"] == "pending"

def test_update_task():
    """タスク更新のテスト"""
    # タスクを作成
    task_data = {
        "task_type": "video_edit"
    }
    create_response = client.post("/api/tasks/", json=task_data)
    task_id = create_response.json()["task_id"]
    
    # タスクを更新
    update_data = {
        "status": "processing",
        "progress": 50.0,
        "current_step": "Analyzing video"
    }
    response = client.put(f"/api/tasks/{task_id}", json=update_data)
    assert response.status_code == 200
    assert response.json()["current_status"] == "processing"
    assert response.json()["progress"] == 50.0

def test_list_tasks():
    """タスク一覧取得のテスト"""
    # 複数のタスクを作成
    for i in range(3):
        task_data = {
            "task_type": f"task_{i}"
        }
        client.post("/api/tasks/", json=task_data)
    
    # タスク一覧を取得
    response = client.get("/api/tasks/")
    assert response.status_code == 200
    assert "tasks" in response.json()
    assert len(response.json()["tasks"]) >= 3

def test_delete_task():
    """タスク削除のテスト"""
    # タスクを作成
    task_data = {
        "task_type": "video_edit"
    }
    create_response = client.post("/api/tasks/", json=task_data)
    task_id = create_response.json()["task_id"]
    
    # タスクを削除
    response = client.delete(f"/api/tasks/{task_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "deleted"
    
    # 削除されたタスクが見つからないことを確認
    get_response = client.get(f"/api/tasks/{task_id}")
    assert get_response.status_code == 404

def test_add_task_log():
    """タスクログ追加のテスト"""
    # タスクを作成
    task_data = {
        "task_type": "video_edit"
    }
    create_response = client.post("/api/tasks/", json=task_data)
    task_id = create_response.json()["task_id"]
    
    # ログを追加
    log_data = {
        "level": "INFO",
        "message": "Test log message",
        "step_name": "initialization",
        "step_progress": 10.0
    }
    response = client.post(f"/api/tasks/{task_id}/logs", json=log_data)
    assert response.status_code == 200
    assert response.json()["status"] == "logged"

def test_get_task_logs():
    """タスクログ取得のテスト"""
    # タスクを作成
    task_data = {
        "task_type": "video_edit"
    }
    create_response = client.post("/api/tasks/", json=task_data)
    task_id = create_response.json()["task_id"]
    
    # ログを追加
    for i in range(3):
        log_data = {
            "level": "INFO",
            "message": f"Log message {i}"
        }
        client.post(f"/api/tasks/{task_id}/logs", json=log_data)
    
    # ログを取得
    response = client.get(f"/api/tasks/{task_id}/logs")
    assert response.status_code == 200
    assert "logs" in response.json()
    assert len(response.json()["logs"]) == 3

def test_create_project():
    """プロジェクト作成のテスト"""
    project_data = {
        "name": "Test Project",
        "description": "Test description",
        "xml_path": "/path/to/xml",
        "audio_path": "/path/to/audio",
        "video_path": "/path/to/video",
        "output_dir": "/path/to/output"
    }
    
    response = client.post("/api/projects/", json=project_data)
    assert response.status_code == 200
    assert "project_id" in response.json()
    assert response.json()["status"] == "created"

def test_get_project():
    """プロジェクト取得のテスト"""
    # プロジェクトを作成
    project_data = {
        "name": "Test Project",
        "description": "Test description"
    }
    create_response = client.post("/api/projects/", json=project_data)
    project_id = create_response.json()["project_id"]
    
    # プロジェクトを取得
    response = client.get(f"/api/projects/{project_id}")
    assert response.status_code == 200
    assert response.json()["id"] == project_id
    assert response.json()["name"] == "Test Project"

def test_status_summary():
    """ステータスサマリー取得のテスト"""
    # いくつかのタスクを作成
    for status in ["pending", "processing", "completed"]:
        task_data = {
            "task_type": f"task_{status}"
        }
        create_response = client.post("/api/tasks/", json=task_data)
        
        if status != "pending":
            task_id = create_response.json()["task_id"]
            update_data = {"status": status}
            client.put(f"/api/tasks/{task_id}", json=update_data)
    
    # ステータスサマリーを取得
    response = client.get("/api/status/summary")
    assert response.status_code == 200
    assert "status_counts" in response.json()
    assert "total_tasks" in response.json()
    assert response.json()["total_tasks"] >= 3

def test_active_tasks():
    """アクティブタスク取得のテスト"""
    # アクティブなタスクを作成
    active_statuses = ["pending", "processing"]
    for status in active_statuses:
        task_data = {
            "task_type": f"active_task_{status}"
        }
        create_response = client.post("/api/tasks/", json=task_data)
        
        if status == "processing":
            task_id = create_response.json()["task_id"]
            update_data = {
                "status": "processing",
                "progress": 30.0,
                "current_step": "Processing"
            }
            client.put(f"/api/tasks/{task_id}", json=update_data)
    
    # アクティブタスクを取得
    response = client.get("/api/status/active")
    assert response.status_code == 200
    assert "active_tasks" in response.json()
    assert len(response.json()["active_tasks"]) >= 2