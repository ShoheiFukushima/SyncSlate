"""
Load testing for API endpoints using locust
"""
from locust import HttpUser, task, between, events
from locust.env import Environment
from locust.stats import stats_printer, stats_history
from locust.log import setup_logging
import random
import json
import time
import gevent

# Setup logging
setup_logging("INFO")


class TaskAPILoadTest(HttpUser):
    """Load test for Task Management API"""
    
    wait_time = between(1, 3)  # Wait 1-3 seconds between requests
    
    def on_start(self):
        """Initialize test data on start"""
        self.task_ids = []
        self.project_ids = []
        self.task_types = ["video_edit", "audio_process", "image_process", "transcription", "analysis"]
        self.priorities = list(range(1, 11))
        
        # Create some initial projects
        for i in range(5):
            response = self.client.post(
                "/api/projects/",
                json={
                    "name": f"Load Test Project {i}",
                    "description": f"Project for load testing {i}"
                }
            )
            if response.status_code == 200:
                self.project_ids.append(response.json()["id"])
    
    @task(10)
    def create_task(self):
        """Create a new task - High frequency"""
        task_data = {
            "task_type": random.choice(self.task_types),
            "project_id": random.choice(self.project_ids) if self.project_ids else None,
            "input_data": {
                "test": "data",
                "timestamp": time.time()
            },
            "estimated_time": random.randint(60, 3600),
            "priority": random.choice(self.priorities)
        }
        
        with self.client.post(
            "/api/tasks/",
            json=task_data,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                task_id = response.json()["task_id"]
                self.task_ids.append(task_id)
                response.success()
            else:
                response.failure(f"Failed to create task: {response.text}")
    
    @task(8)
    def get_task_list(self):
        """Get list of tasks - High frequency"""
        params = {
            "limit": random.choice([10, 20, 50, 100]),
            "offset": random.randint(0, 100)
        }
        
        # Sometimes add filters
        if random.random() > 0.5:
            params["status"] = random.choice(["pending", "processing", "completed"])
        
        if random.random() > 0.7 and self.project_ids:
            params["project_id"] = random.choice(self.project_ids)
        
        with self.client.get(
            "/api/tasks/",
            params=params,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed to get tasks: {response.text}")
    
    @task(6)
    def get_task_details(self):
        """Get specific task details - Medium frequency"""
        if not self.task_ids:
            return
        
        task_id = random.choice(self.task_ids)
        
        with self.client.get(
            f"/api/tasks/{task_id}",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 404:
                # Remove deleted task from list
                self.task_ids.remove(task_id)
                response.success()
            else:
                response.failure(f"Failed to get task {task_id}: {response.text}")
    
    @task(5)
    def update_task(self):
        """Update task status - Medium frequency"""
        if not self.task_ids:
            return
        
        task_id = random.choice(self.task_ids)
        
        update_data = {
            "progress": random.randint(0, 100),
            "current_step": f"Step {random.randint(1, 10)}"
        }
        
        # Sometimes update status
        if random.random() > 0.5:
            update_data["status"] = random.choice(["processing", "completed", "failed"])
        
        with self.client.put(
            f"/api/tasks/{task_id}",
            json=update_data,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed to update task {task_id}: {response.text}")
    
    @task(3)
    def add_task_log(self):
        """Add log to task - Low frequency"""
        if not self.task_ids:
            return
        
        task_id = random.choice(self.task_ids)
        
        log_data = {
            "level": random.choice(["DEBUG", "INFO", "WARNING", "ERROR"]),
            "message": f"Load test log message at {time.time()}",
            "step_name": f"step_{random.randint(1, 10)}",
            "step_progress": random.randint(0, 100)
        }
        
        with self.client.post(
            f"/api/tasks/{task_id}/logs",
            json=log_data,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed to add log to task {task_id}: {response.text}")
    
    @task(2)
    def batch_create_tasks(self):
        """Create multiple tasks in batch - Low frequency"""
        batch_size = random.randint(5, 20)
        
        tasks = [
            {
                "task_type": random.choice(self.task_types),
                "priority": random.choice(self.priorities)
            }
            for _ in range(batch_size)
        ]
        
        with self.client.post(
            "/api/tasks/batch",
            json=tasks,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                created_tasks = response.json()
                for task in created_tasks:
                    self.task_ids.append(task["task_id"])
                response.success()
            else:
                response.failure(f"Failed to batch create tasks: {response.text}")
    
    @task(1)
    def get_metrics(self):
        """Get Prometheus metrics - Very low frequency"""
        with self.client.get(
            "/metrics",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed to get metrics: {response.text}")
    
    @task(1)
    def cancel_task(self):
        """Cancel a task - Very low frequency"""
        if not self.task_ids:
            return
        
        task_id = random.choice(self.task_ids)
        
        with self.client.delete(
            f"/api/tasks/{task_id}",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                self.task_ids.remove(task_id)
                response.success()
            elif response.status_code == 400:
                # Task already completed, can't cancel
                response.success()
            else:
                response.failure(f"Failed to cancel task {task_id}: {response.text}")


class WebSocketLoadTest(HttpUser):
    """Load test for WebSocket connections"""
    
    wait_time = between(2, 5)
    
    @task
    def websocket_connection(self):
        """Test WebSocket connection and message exchange"""
        # Note: Locust doesn't have built-in WebSocket support
        # This is a placeholder for WebSocket testing
        # You would use a library like websocket-client or locust-plugins
        pass


class StressTest(HttpUser):
    """Stress test with aggressive parameters"""
    
    wait_time = between(0.1, 0.5)  # Very short wait times
    
    @task(20)
    def aggressive_task_creation(self):
        """Create tasks aggressively"""
        task_data = {
            "task_type": "stress_test",
            "input_data": {"timestamp": time.time()},
            "priority": 10
        }
        
        self.client.post("/api/tasks/", json=task_data)
    
    @task(10)
    def aggressive_queries(self):
        """Query tasks aggressively"""
        self.client.get("/api/tasks/?limit=1000")


# Custom test runner for programmatic execution
def run_load_test(
    host: str = "http://localhost:8000",
    users: int = 100,
    spawn_rate: int = 10,
    run_time: int = 60
):
    """
    Run load test programmatically
    
    Args:
        host: Target host URL
        users: Number of concurrent users
        spawn_rate: Users spawned per second
        run_time: Test duration in seconds
    """
    
    # Setup Environment
    env = Environment(user_classes=[TaskAPILoadTest])
    env.create_local_runner()
    
    # Start test
    env.runner.start(users, spawn_rate=spawn_rate)
    
    # Run for specified time
    gevent.spawn_later(run_time, lambda: env.runner.quit())
    
    # Start stats printer
    gevent.spawn(stats_printer(env.stats))
    
    # Wait for test to complete
    env.runner.greenlet.join()
    
    # Print final stats
    print("\n=== Load Test Results ===")
    print(f"Total Requests: {env.stats.total.num_requests}")
    print(f"Total Failures: {env.stats.total.num_failures}")
    print(f"Average Response Time: {env.stats.total.avg_response_time:.2f}ms")
    print(f"Min Response Time: {env.stats.total.min_response_time:.2f}ms")
    print(f"Max Response Time: {env.stats.total.max_response_time:.2f}ms")
    print(f"RPS: {env.stats.total.current_rps:.2f}")
    
    return env.stats


# Performance test scenarios
class PerformanceScenarios:
    """Different performance test scenarios"""
    
    @staticmethod
    def normal_load():
        """Normal load scenario"""
        return {
            "users": 50,
            "spawn_rate": 5,
            "run_time": 300  # 5 minutes
        }
    
    @staticmethod
    def peak_load():
        """Peak load scenario"""
        return {
            "users": 200,
            "spawn_rate": 20,
            "run_time": 600  # 10 minutes
        }
    
    @staticmethod
    def stress_test():
        """Stress test scenario"""
        return {
            "users": 500,
            "spawn_rate": 50,
            "run_time": 300  # 5 minutes
        }
    
    @staticmethod
    def endurance_test():
        """Endurance test scenario"""
        return {
            "users": 100,
            "spawn_rate": 10,
            "run_time": 3600  # 1 hour
        }
    
    @staticmethod
    def spike_test():
        """Spike test scenario"""
        return {
            "users": 1000,
            "spawn_rate": 100,
            "run_time": 60  # 1 minute spike
        }


if __name__ == "__main__":
    # Run a normal load test
    scenario = PerformanceScenarios.normal_load()
    stats = run_load_test(**scenario)
    
    # Check if performance meets requirements
    assert stats.total.avg_response_time < 200, "Average response time exceeds 200ms"
    assert stats.total.num_failures / stats.total.num_requests < 0.01, "Error rate exceeds 1%"