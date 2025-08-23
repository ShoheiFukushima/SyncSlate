"""
Prometheus metrics for monitoring
"""
from prometheus_client import (
    Counter, Histogram, Gauge, Summary,
    generate_latest, CONTENT_TYPE_LATEST,
    CollectorRegistry
)
from fastapi import Response
import time
from functools import wraps
from typing import Callable, Optional
import psutil
import os

# Create custom registry
registry = CollectorRegistry()

# Request metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status'],
    registry=registry
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint'],
    registry=registry,
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
)

http_request_size_bytes = Summary(
    'http_request_size_bytes',
    'HTTP request size',
    ['method', 'endpoint'],
    registry=registry
)

http_response_size_bytes = Summary(
    'http_response_size_bytes',
    'HTTP response size',
    ['method', 'endpoint'],
    registry=registry
)

# Task metrics
tasks_created_total = Counter(
    'tasks_created_total',
    'Total tasks created',
    ['task_type'],
    registry=registry
)

tasks_completed_total = Counter(
    'tasks_completed_total',
    'Total tasks completed',
    ['task_type', 'status'],
    registry=registry
)

task_processing_duration_seconds = Histogram(
    'task_processing_duration_seconds',
    'Task processing duration',
    ['task_type'],
    registry=registry,
    buckets=(1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600)
)

tasks_in_progress = Gauge(
    'tasks_in_progress',
    'Number of tasks currently in progress',
    ['task_type'],
    registry=registry
)

task_queue_size = Gauge(
    'task_queue_size',
    'Number of tasks in queue',
    ['priority'],
    registry=registry
)

# Database metrics
database_connections_active = Gauge(
    'database_connections_active',
    'Active database connections',
    registry=registry
)

database_connections_idle = Gauge(
    'database_connections_idle',
    'Idle database connections',
    registry=registry
)

database_query_duration_seconds = Histogram(
    'database_query_duration_seconds',
    'Database query duration',
    ['operation', 'table'],
    registry=registry,
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0)
)

# System metrics
system_cpu_usage_percent = Gauge(
    'system_cpu_usage_percent',
    'System CPU usage percentage',
    registry=registry
)

system_memory_usage_percent = Gauge(
    'system_memory_usage_percent',
    'System memory usage percentage',
    registry=registry
)

system_disk_usage_percent = Gauge(
    'system_disk_usage_percent',
    'System disk usage percentage',
    registry=registry
)

process_memory_bytes = Gauge(
    'process_memory_bytes',
    'Process memory usage in bytes',
    registry=registry
)

process_cpu_seconds_total = Counter(
    'process_cpu_seconds_total',
    'Total CPU seconds used by process',
    registry=registry
)

# WebSocket metrics
websocket_connections_active = Gauge(
    'websocket_connections_active',
    'Active WebSocket connections',
    registry=registry
)

websocket_messages_sent_total = Counter(
    'websocket_messages_sent_total',
    'Total WebSocket messages sent',
    ['message_type'],
    registry=registry
)

websocket_messages_received_total = Counter(
    'websocket_messages_received_total',
    'Total WebSocket messages received',
    ['message_type'],
    registry=registry
)

# Error metrics
errors_total = Counter(
    'errors_total',
    'Total errors',
    ['error_type', 'component'],
    registry=registry
)

# Cache metrics
cache_hits_total = Counter(
    'cache_hits_total',
    'Total cache hits',
    ['cache_name'],
    registry=registry
)

cache_misses_total = Counter(
    'cache_misses_total',
    'Total cache misses',
    ['cache_name'],
    registry=registry
)


def track_request_metrics(method: str, endpoint: str, status_code: int, duration: float, request_size: int, response_size: int):
    """Track HTTP request metrics"""
    http_requests_total.labels(method=method, endpoint=endpoint, status=status_code).inc()
    http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(duration)
    http_request_size_bytes.labels(method=method, endpoint=endpoint).observe(request_size)
    http_response_size_bytes.labels(method=method, endpoint=endpoint).observe(response_size)


def track_task_created(task_type: str):
    """Track task creation"""
    tasks_created_total.labels(task_type=task_type).inc()


def track_task_completed(task_type: str, status: str, duration: float):
    """Track task completion"""
    tasks_completed_total.labels(task_type=task_type, status=status).inc()
    if duration:
        task_processing_duration_seconds.labels(task_type=task_type).observe(duration)


def track_task_progress(task_type: str, delta: int):
    """Track tasks in progress"""
    tasks_in_progress.labels(task_type=task_type).inc(delta)


def track_database_query(operation: str, table: str, duration: float):
    """Track database query metrics"""
    database_query_duration_seconds.labels(operation=operation, table=table).observe(duration)


def track_websocket_connection(delta: int):
    """Track WebSocket connections"""
    websocket_connections_active.inc(delta)


def track_websocket_message(direction: str, message_type: str):
    """Track WebSocket messages"""
    if direction == "sent":
        websocket_messages_sent_total.labels(message_type=message_type).inc()
    else:
        websocket_messages_received_total.labels(message_type=message_type).inc()


def track_error(error_type: str, component: str):
    """Track errors"""
    errors_total.labels(error_type=error_type, component=component).inc()


def track_cache_access(cache_name: str, hit: bool):
    """Track cache access"""
    if hit:
        cache_hits_total.labels(cache_name=cache_name).inc()
    else:
        cache_misses_total.labels(cache_name=cache_name).inc()


def update_system_metrics():
    """Update system metrics"""
    # CPU usage
    cpu_percent = psutil.cpu_percent(interval=1)
    system_cpu_usage_percent.set(cpu_percent)
    
    # Memory usage
    memory = psutil.virtual_memory()
    system_memory_usage_percent.set(memory.percent)
    
    # Disk usage
    disk = psutil.disk_usage('/')
    system_disk_usage_percent.set(disk.percent)
    
    # Process metrics
    process = psutil.Process(os.getpid())
    process_memory_bytes.set(process.memory_info().rss)
    process_cpu_seconds_total.inc(process.cpu_times().user + process.cpu_times().system)


def metrics_middleware(func: Callable) -> Callable:
    """Decorator to track function metrics"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            duration = time.time() - start_time
            # Track metrics based on function name
            if "task" in func.__name__.lower():
                track_task_completed("unknown", "success", duration)
        return result
    return wrapper


async def get_metrics() -> Response:
    """Generate Prometheus metrics"""
    # Update system metrics before generating
    update_system_metrics()
    
    # Generate metrics
    metrics = generate_latest(registry)
    
    return Response(
        content=metrics,
        media_type=CONTENT_TYPE_LATEST
    )


# Health check metrics
health_check_total = Counter(
    'health_check_total',
    'Total health checks',
    ['service'],
    registry=registry
)

health_check_duration_seconds = Histogram(
    'health_check_duration_seconds',
    'Health check duration',
    ['service'],
    registry=registry
)


def track_health_check(service: str, duration: float):
    """Track health check metrics"""
    health_check_total.labels(service=service).inc()
    health_check_duration_seconds.labels(service=service).observe(duration)