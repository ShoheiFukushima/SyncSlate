"""
End-to-end tests for the complete task workflow
"""
import pytest
import asyncio
import time
from typing import Dict, Any
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import json

from main import app
from models import Base
from config import get_settings

# Test configuration
settings = get_settings()
client = TestClient(app)


class TestE2ETaskWorkflow:
    """End-to-end test for complete task lifecycle"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test environment"""
        # Create test database
        engine = create_engine(settings.DATABASE_URL.replace("autoedit_tate", "autoedit_test"))
        Base.metadata.create_all(bind=engine)
        yield
        Base.metadata.drop_all(bind=engine)
    
    def test_complete_video_editing_workflow(self):
        """Test complete video editing workflow from creation to completion"""
        
        # Step 1: Create a project
        project_data = {
            "name": "Test Video Project",
            "description": "E2E test project",
            "settings": {"quality": "high", "format": "mp4"}
        }
        
        project_response = client.post("/api/projects/", json=project_data)
        assert project_response.status_code == 200
        project = project_response.json()
        project_id = project["id"]
        
        # Step 2: Create a video editing task
        task_data = {
            "task_type": "video_edit",
            "project_id": project_id,
            "input_data": {
                "source_video": "/test/video.mp4",
                "edit_points": [10, 20, 30],
                "effects": ["fade_in", "fade_out"]
            },
            "estimated_time": 300,
            "priority": 8
        }
        
        task_response = client.post("/api/tasks/", json=task_data)
        assert task_response.status_code == 200
        task = task_response.json()
        task_id = task["task_id"]
        
        # Step 3: Verify task is created with correct status
        get_response = client.get(f"/api/tasks/{task_id}")
        assert get_response.status_code == 200
        task_details = get_response.json()
        assert task_details["status"] == "pending"
        assert task_details["progress"] == 0
        
        # Step 4: Start processing the task
        update_data = {
            "status": "processing",
            "current_step": "Loading video"
        }
        
        update_response = client.put(f"/api/tasks/{task_id}", json=update_data)
        assert update_response.status_code == 200
        assert update_response.json()["started_at"] is not None
        
        # Step 5: Add task logs during processing
        log_entries = [
            {
                "level": "INFO",
                "message": "Video loaded successfully",
                "step_name": "load_video",
                "step_progress": 20
            },
            {
                "level": "INFO",
                "message": "Analyzing edit points",
                "step_name": "analyze",
                "step_progress": 40
            },
            {
                "level": "INFO",
                "message": "Applying effects",
                "step_name": "effects",
                "step_progress": 60
            },
            {
                "level": "INFO",
                "message": "Rendering output",
                "step_name": "render",
                "step_progress": 80
            }
        ]
        
        for log_entry in log_entries:
            log_response = client.post(f"/api/tasks/{task_id}/logs", json=log_entry)
            assert log_response.status_code == 200
            
            # Update task progress
            progress_update = {
                "progress": log_entry["step_progress"],
                "current_step": log_entry["step_name"]
            }
            client.put(f"/api/tasks/{task_id}", json=progress_update)
        
        # Step 6: Complete the task
        completion_data = {
            "status": "completed",
            "progress": 100,
            "output_data": {
                "output_file": "/output/edited_video.mp4",
                "duration": 120,
                "file_size": 104857600
            }
        }
        
        complete_response = client.put(f"/api/tasks/{task_id}", json=completion_data)
        assert complete_response.status_code == 200
        completed_task = complete_response.json()
        assert completed_task["status"] == "completed"
        assert completed_task["completed_at"] is not None
        assert completed_task["actual_time"] is not None
        
        # Step 7: Verify task logs
        logs_response = client.get(f"/api/tasks/{task_id}/logs")
        assert logs_response.status_code == 200
        logs = logs_response.json()
        assert len(logs) >= 4
        
        # Step 8: Verify project has the completed task
        project_tasks_response = client.get(f"/api/tasks/?project_id={project_id}")
        assert project_tasks_response.status_code == 200
        project_tasks = project_tasks_response.json()
        assert len(project_tasks["tasks"]) == 1
        assert project_tasks["tasks"][0]["status"] == "completed"
    
    def test_task_failure_and_retry_workflow(self):
        """Test task failure and retry workflow"""
        
        # Create a task that will fail
        task_data = {
            "task_type": "audio_process",
            "input_data": {"source": "/invalid/audio.mp3"},
            "priority": 5
        }
        
        task_response = client.post("/api/tasks/", json=task_data)
        assert task_response.status_code == 200
        task_id = task_response.json()["task_id"]
        
        # Start processing
        client.put(f"/api/tasks/{task_id}", json={"status": "processing"})
        
        # Simulate failure
        failure_data = {
            "status": "failed",
            "error_message": "File not found: /invalid/audio.mp3"
        }
        
        failure_response = client.put(f"/api/tasks/{task_id}", json=failure_data)
        assert failure_response.status_code == 200
        failed_task = failure_response.json()
        assert failed_task["status"] == "failed"
        assert failed_task["error_message"] is not None
        
        # Log the error
        error_log = {
            "level": "ERROR",
            "message": "Task failed: File not found",
            "metadata": {"error_code": "FILE_NOT_FOUND"}
        }
        
        log_response = client.post(f"/api/tasks/{task_id}/logs", json=error_log)
        assert log_response.status_code == 200
        
        # Create a retry task
        retry_data = {
            "task_type": "audio_process",
            "input_data": {"source": "/valid/audio.mp3"},
            "priority": 10  # Higher priority for retry
        }
        
        retry_response = client.post("/api/tasks/", json=retry_data)
        assert retry_response.status_code == 200
        retry_task_id = retry_response.json()["task_id"]
        
        # Verify retry task has higher priority
        retry_task = client.get(f"/api/tasks/{retry_task_id}").json()
        assert retry_task["priority"] == 10
    
    def test_batch_task_processing(self):
        """Test batch task creation and processing"""
        
        # Create multiple tasks in batch
        batch_tasks = [
            {
                "task_type": "image_process",
                "input_data": {"image": f"image_{i}.jpg"},
                "priority": i % 10 + 1
            }
            for i in range(10)
        ]
        
        batch_response = client.post("/api/tasks/batch", json=batch_tasks)
        assert batch_response.status_code == 200
        created_tasks = batch_response.json()
        assert len(created_tasks) == 10
        
        # Process all tasks
        for task in created_tasks:
            task_id = task["task_id"]
            
            # Start processing
            client.put(f"/api/tasks/{task_id}", json={
                "status": "processing",
                "progress": 50
            })
            
            # Complete task
            client.put(f"/api/tasks/{task_id}", json={
                "status": "completed",
                "progress": 100
            })
        
        # Verify all tasks are completed
        all_tasks_response = client.get("/api/tasks/?status=completed&limit=100")
        assert all_tasks_response.status_code == 200
        completed_tasks = all_tasks_response.json()["tasks"]
        assert len(completed_tasks) >= 10
    
    def test_task_cancellation_workflow(self):
        """Test task cancellation workflow"""
        
        # Create a long-running task
        task_data = {
            "task_type": "transcription",
            "input_data": {"audio": "long_audio.wav"},
            "estimated_time": 3600
        }
        
        task_response = client.post("/api/tasks/", json=task_data)
        task_id = task_response.json()["task_id"]
        
        # Start processing
        client.put(f"/api/tasks/{task_id}", json={
            "status": "processing",
            "progress": 25
        })
        
        # Cancel the task
        cancel_response = client.delete(f"/api/tasks/{task_id}")
        assert cancel_response.status_code == 200
        
        # Verify task is cancelled
        cancelled_task = client.get(f"/api/tasks/{task_id}").json()
        assert cancelled_task["status"] == "cancelled"
        assert cancelled_task["completed_at"] is not None
    
    def test_concurrent_task_updates(self):
        """Test concurrent updates to the same task"""
        
        # Create a task
        task_data = {"task_type": "analysis"}
        task_response = client.post("/api/tasks/", json=task_data)
        task_id = task_response.json()["task_id"]
        
        # Simulate concurrent updates
        updates = [
            {"progress": 10, "current_step": "step1"},
            {"progress": 20, "current_step": "step2"},
            {"progress": 30, "current_step": "step3"},
            {"progress": 40, "current_step": "step4"},
            {"progress": 50, "current_step": "step5"}
        ]
        
        # Send updates rapidly
        for update in updates:
            response = client.put(f"/api/tasks/{task_id}", json=update)
            assert response.status_code == 200
        
        # Verify final state
        final_task = client.get(f"/api/tasks/{task_id}").json()
        assert final_task["progress"] == 50
        assert final_task["current_step"] == "step5"
    
    @pytest.mark.asyncio
    async def test_websocket_task_updates(self):
        """Test WebSocket updates for task progress"""
        from fastapi.testclient import TestClient
        
        # This would require WebSocket implementation
        # Placeholder for WebSocket test
        pass
    
    def test_task_priority_ordering(self):
        """Test tasks are processed in priority order"""
        
        # Create tasks with different priorities
        priorities = [1, 5, 10, 3, 7, 2, 9, 4, 6, 8]
        task_ids = []
        
        for priority in priorities:
            task_data = {
                "task_type": "video_edit",
                "priority": priority
            }
            response = client.post("/api/tasks/", json=task_data)
            task_ids.append(response.json()["task_id"])
        
        # Get tasks ordered by priority
        tasks_response = client.get("/api/tasks/?limit=100")
        tasks = tasks_response.json()["tasks"]
        
        # Verify tasks are ordered by priority (descending)
        priorities_returned = [task["priority"] for task in tasks]
        assert priorities_returned == sorted(priorities_returned, reverse=True)
    
    def test_task_metrics_collection(self):
        """Test that metrics are collected during task processing"""
        
        # Get initial metrics
        metrics_response = client.get("/metrics")
        assert metrics_response.status_code == 200
        initial_metrics = metrics_response.text
        
        # Create and complete a task
        task_data = {"task_type": "video_edit"}
        task_response = client.post("/api/tasks/", json=task_data)
        task_id = task_response.json()["task_id"]
        
        # Process task
        client.put(f"/api/tasks/{task_id}", json={"status": "processing"})
        time.sleep(0.1)  # Simulate processing time
        client.put(f"/api/tasks/{task_id}", json={"status": "completed"})
        
        # Get updated metrics
        updated_metrics_response = client.get("/metrics")
        updated_metrics = updated_metrics_response.text
        
        # Verify metrics were updated
        assert "tasks_created_total" in updated_metrics
        assert "tasks_completed_total" in updated_metrics
        assert updated_metrics != initial_metrics


if __name__ == "__main__":
    pytest.main([__file__, "-v"])