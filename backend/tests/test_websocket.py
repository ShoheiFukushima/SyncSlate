"""WebSocket unit tests"""
import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
import json

from main import app

def test_websocket_connection():
    """Test WebSocket connection establishment"""
    client = TestClient(app)
    
    with client.websocket_connect("/ws/tasks") as websocket:
        # Send initial message
        websocket.send_json({"type": "subscribe", "task_id": "test-123"})
        
        # Receive acknowledgment
        data = websocket.receive_json()
        assert data["type"] == "subscribed"
        assert data["task_id"] == "test-123"

def test_websocket_task_updates():
    """Test receiving task updates via WebSocket"""
    client = TestClient(app)
    
    with client.websocket_connect("/ws/tasks") as websocket:
        websocket.send_json({"type": "subscribe", "task_id": "test-456"})
        websocket.receive_json()  # Ack
        
        # Simulate task update
        update_msg = {
            "type": "task_update",
            "task_id": "test-456",
            "status": "processing",
            "progress": 50
        }
        
        # In real scenario, this would be triggered by task update
        websocket.send_json(update_msg)
        received = websocket.receive_json()
        
        assert received["type"] == "task_update"
        assert received["progress"] == 50

def test_websocket_error_handling():
    """Test WebSocket error handling"""
    client = TestClient(app)
    
    with client.websocket_connect("/ws/tasks") as websocket:
        # Send invalid message
        websocket.send_json({"invalid": "message"})
        
        # Should receive error
        error = websocket.receive_json()
        assert error["type"] == "error"
        assert "message" in error