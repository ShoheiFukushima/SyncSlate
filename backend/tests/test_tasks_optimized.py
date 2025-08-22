"""
Tests for optimized task API
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
from datetime import datetime
import json

from main import app
from models import Base, engine, Task, TaskStatus
from schemas.task import TaskCreate, TaskUpdate, TaskType

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    """Setup test database"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


class TestTaskAPI:
    """Test suite for task API endpoints"""
    
    def test_create_task_with_validation(self):
        """Test task creation with input validation"""
        task_data = {
            "task_type": "video_edit",
            "project_id": 1,
            "input_data": {"source": "test.mp4"},
            "estimated_time": 300,
            "priority": 5
        }
        
        response = client.post("/api/tasks/", json=task_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "task_id" in data
        assert data["task_type"] == "video_edit"
        assert data["status"] == "pending"
        assert data["priority"] == 5
    
    def test_create_task_invalid_input(self):
        """Test task creation with invalid input"""
        # Test with sensitive data
        task_data = {
            "task_type": "video_edit",
            "input_data": {"password": "secret123"}
        }
        
        response = client.post("/api/tasks/", json=task_data)
        assert response.status_code == 422
        assert "sensitive information" in response.text.lower()
    
    def test_create_task_invalid_priority(self):
        """Test task creation with invalid priority"""
        task_data = {
            "task_type": "video_edit",
            "priority": 15  # Max is 10
        }
        
        response = client.post("/api/tasks/", json=task_data)
        assert response.status_code == 422
    
    def test_list_tasks_with_pagination(self):
        """Test task listing with pagination"""
        # Create multiple tasks
        for i in range(15):
            task_data = {
                "task_type": "video_edit",
                "priority": i % 10 + 1
            }
            client.post("/api/tasks/", json=task_data)
        
        # Test pagination
        response = client.get("/api/tasks/?limit=10&offset=0")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["tasks"]) == 10
        assert data["limit"] == 10
        assert data["offset"] == 0
        assert data["has_more"] is True
        
        # Test second page
        response = client.get("/api/tasks/?limit=10&offset=10")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["tasks"]) == 5
        assert data["has_more"] is False
    
    def test_list_tasks_with_filters(self):
        """Test task listing with filters"""
        # Create tasks with different statuses
        task1 = client.post("/api/tasks/", json={
            "task_type": "video_edit",
            "project_id": 1
        }).json()
        
        task2 = client.post("/api/tasks/", json={
            "task_type": "audio_process",
            "project_id": 2
        }).json()
        
        # Filter by project
        response = client.get("/api/tasks/?project_id=1")
        assert response.status_code == 200
        data = response.json()
        assert len(data["tasks"]) == 1
        assert data["tasks"][0]["project_id"] == 1
        
        # Filter by status
        response = client.get("/api/tasks/?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert all(t["status"] == "pending" for t in data["tasks"])
    
    def test_list_tasks_performance_mode(self):
        """Test task listing without count for better performance"""
        # Create tasks
        for i in range(5):
            client.post("/api/tasks/", json={"task_type": "video_edit"})
        
        # Without count (faster)
        response = client.get("/api/tasks/?include_count=false")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert data["total"] >= 5  # Estimated count
        
        # With count (slower but accurate)
        response = client.get("/api/tasks/?include_count=true")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5  # Exact count
    
    def test_update_task_with_validation(self):
        """Test task update with validation"""
        # Create task
        task = client.post("/api/tasks/", json={
            "task_type": "video_edit"
        }).json()
        
        task_id = task["task_id"]
        
        # Valid update
        update_data = {
            "status": "processing",
            "progress": 50.0,
            "current_step": "Analyzing video"
        }
        
        response = client.put(f"/api/tasks/{task_id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "processing"
        assert data["progress"] == 50.0
        assert data["current_step"] == "Analyzing video"
        assert data["started_at"] is not None
    
    def test_update_task_progress_validation(self):
        """Test task progress validation"""
        task = client.post("/api/tasks/", json={
            "task_type": "video_edit"
        }).json()
        
        task_id = task["task_id"]
        
        # Invalid progress (> 100)
        response = client.put(f"/api/tasks/{task_id}", json={
            "progress": 150.0
        })
        assert response.status_code == 422
        
        # Valid progress
        response = client.put(f"/api/tasks/{task_id}", json={
            "progress": 75.0
        })
        assert response.status_code == 200
        assert response.json()["progress"] == 75.0
    
    def test_task_status_transitions(self):
        """Test task status transition timestamps"""
        task = client.post("/api/tasks/", json={
            "task_type": "video_edit"
        }).json()
        
        task_id = task["task_id"]
        
        # Start processing
        response = client.put(f"/api/tasks/{task_id}", json={
            "status": "processing"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["started_at"] is not None
        
        # Complete task
        response = client.put(f"/api/tasks/{task_id}", json={
            "status": "completed"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["completed_at"] is not None
        assert data["actual_time"] is not None
    
    def test_cancel_task(self):
        """Test task cancellation"""
        task = client.post("/api/tasks/", json={
            "task_type": "video_edit"
        }).json()
        
        task_id = task["task_id"]
        
        # Cancel task
        response = client.delete(f"/api/tasks/{task_id}")
        assert response.status_code == 200
        
        # Verify status
        response = client.get(f"/api/tasks/{task_id}")
        assert response.json()["status"] == "cancelled"
    
    def test_cancel_completed_task(self):
        """Test cancelling a completed task (should fail)"""
        task = client.post("/api/tasks/", json={
            "task_type": "video_edit"
        }).json()
        
        task_id = task["task_id"]
        
        # Complete task
        client.put(f"/api/tasks/{task_id}", json={"status": "completed"})
        
        # Try to cancel
        response = client.delete(f"/api/tasks/{task_id}")
        assert response.status_code == 400
        assert "Cannot cancel" in response.json()["detail"]
    
    def test_batch_task_creation(self):
        """Test creating multiple tasks in batch"""
        tasks_data = [
            {"task_type": "video_edit", "priority": 5},
            {"task_type": "audio_process", "priority": 3},
            {"task_type": "image_process", "priority": 7}
        ]
        
        response = client.post("/api/tasks/batch", json=tasks_data)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 3
        assert data[0]["task_type"] == "video_edit"
        assert data[1]["task_type"] == "audio_process"
        assert data[2]["task_type"] == "image_process"
    
    def test_batch_task_creation_limit(self):
        """Test batch creation limit"""
        # Create 101 tasks (exceeds limit)
        tasks_data = [
            {"task_type": "video_edit"} for _ in range(101)
        ]
        
        response = client.post("/api/tasks/batch", json=tasks_data)
        assert response.status_code == 400
        assert "Maximum 100 tasks" in response.json()["detail"]
    
    def test_task_logs(self):
        """Test task log functionality"""
        # Create task
        task = client.post("/api/tasks/", json={
            "task_type": "video_edit"
        }).json()
        
        task_id = task["task_id"]
        
        # Add log
        log_data = {
            "level": "INFO",
            "message": "Processing started",
            "step_name": "initialization",
            "step_progress": 10.0,
            "metadata": {"key": "value"}
        }
        
        response = client.post(f"/api/tasks/{task_id}/logs", json=log_data)
        assert response.status_code == 200
        
        # Get logs
        response = client.get(f"/api/tasks/{task_id}/logs")
        assert response.status_code == 200
        
        logs = response.json()
        assert len(logs) == 1
        assert logs[0]["level"] == "INFO"
        assert logs[0]["message"] == "Processing started"
    
    def test_task_log_validation(self):
        """Test task log validation"""
        task = client.post("/api/tasks/", json={
            "task_type": "video_edit"
        }).json()
        
        task_id = task["task_id"]
        
        # Invalid log level
        response = client.post(f"/api/tasks/{task_id}/logs", json={
            "level": "INVALID",
            "message": "Test"
        })
        assert response.status_code == 422
        
        # Valid log levels
        for level in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
            response = client.post(f"/api/tasks/{task_id}/logs", json={
                "level": level,
                "message": f"Test {level}"
            })
            assert response.status_code == 200


class TestRateLimiting:
    """Test rate limiting functionality"""
    
    @patch('middleware.rate_limit.limiter.enabled', True)
    def test_rate_limit_create_task(self):
        """Test rate limiting on task creation"""
        # Note: This is a simplified test. In production, you'd test with actual Redis
        pass
    
    @patch('middleware.rate_limit.limiter.enabled', False)
    def test_rate_limit_disabled(self):
        """Test with rate limiting disabled"""
        # Create many tasks quickly
        for i in range(20):
            response = client.post("/api/tasks/", json={
                "task_type": "video_edit"
            })
            assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])