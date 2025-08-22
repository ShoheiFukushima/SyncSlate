"""
Structured logging configuration using structlog
"""
import structlog
import logging
import sys
import json
from typing import Any, Dict, Optional
from datetime import datetime
import traceback

# Configure structlog
def configure_structured_logging(
    log_level: str = "INFO",
    environment: str = "development"
) -> None:
    """Configure structured logging with JSON output"""
    
    # Set log level
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper()),
    )
    
    # Processors for structlog
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        add_environment,
        add_service_info,
    ]
    
    # Add JSON renderer for production
    if environment == "production":
        processors.append(structlog.processors.JSONRenderer())
    else:
        # Development uses colored output
        processors.append(
            structlog.dev.ConsoleRenderer(
                colors=True,
                exception_formatter=structlog.dev.RichTracebackFormatter(
                    show_locals=True
                )
            )
        )
    
    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def add_environment(logger, log_method, event_dict):
    """Add environment info to logs"""
    from config import get_settings
    settings = get_settings()
    event_dict["environment"] = settings.ENVIRONMENT
    event_dict["service"] = "autoedit-tate-backend"
    return event_dict


def add_service_info(logger, log_method, event_dict):
    """Add service metadata"""
    event_dict["version"] = "1.0.0"
    event_dict["component"] = "task-management"
    return event_dict


class StructuredLogger:
    """Wrapper for structured logging with common patterns"""
    
    def __init__(self, name: str):
        self.logger = structlog.get_logger(name)
    
    def log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        user_id: Optional[str] = None,
        **kwargs
    ):
        """Log HTTP request"""
        self.logger.info(
            "http_request",
            method=method,
            path=path,
            status_code=status_code,
            duration_ms=duration_ms,
            user_id=user_id,
            **kwargs
        )
    
    def log_task_event(
        self,
        task_id: str,
        event: str,
        task_type: str,
        status: str,
        **kwargs
    ):
        """Log task lifecycle event"""
        self.logger.info(
            "task_event",
            task_id=task_id,
            event=event,
            task_type=task_type,
            status=status,
            **kwargs
        )
    
    def log_database_query(
        self,
        operation: str,
        table: str,
        duration_ms: float,
        rows_affected: int = 0,
        **kwargs
    ):
        """Log database query"""
        self.logger.debug(
            "database_query",
            operation=operation,
            table=table,
            duration_ms=duration_ms,
            rows_affected=rows_affected,
            **kwargs
        )
    
    def log_cache_access(
        self,
        cache_name: str,
        key: str,
        hit: bool,
        duration_ms: float,
        **kwargs
    ):
        """Log cache access"""
        self.logger.debug(
            "cache_access",
            cache_name=cache_name,
            key=key,
            hit=hit,
            duration_ms=duration_ms,
            **kwargs
        )
    
    def log_error(
        self,
        error_type: str,
        message: str,
        component: str,
        exception: Optional[Exception] = None,
        **kwargs
    ):
        """Log error with context"""
        error_dict = {
            "error_type": error_type,
            "message": message,
            "component": component,
            **kwargs
        }
        
        if exception:
            error_dict["exception_class"] = exception.__class__.__name__
            error_dict["exception_message"] = str(exception)
            error_dict["traceback"] = traceback.format_exc()
        
        self.logger.error("error_occurred", **error_dict)
    
    def log_performance(
        self,
        operation: str,
        duration_ms: float,
        threshold_ms: float,
        **kwargs
    ):
        """Log performance metrics"""
        is_slow = duration_ms > threshold_ms
        log_method = self.logger.warning if is_slow else self.logger.debug
        
        log_method(
            "performance_metric",
            operation=operation,
            duration_ms=duration_ms,
            threshold_ms=threshold_ms,
            is_slow=is_slow,
            **kwargs
        )
    
    def log_security_event(
        self,
        event_type: str,
        user_id: Optional[str],
        ip_address: str,
        success: bool,
        **kwargs
    ):
        """Log security-related events"""
        self.logger.info(
            "security_event",
            event_type=event_type,
            user_id=user_id,
            ip_address=ip_address,
            success=success,
            **kwargs
        )
    
    def log_websocket_event(
        self,
        event: str,
        connection_id: str,
        message_type: Optional[str] = None,
        **kwargs
    ):
        """Log WebSocket events"""
        self.logger.info(
            "websocket_event",
            event=event,
            connection_id=connection_id,
            message_type=message_type,
            **kwargs
        )
    
    def log_audit(
        self,
        action: str,
        resource: str,
        user_id: str,
        changes: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        """Log audit trail"""
        self.logger.info(
            "audit_log",
            action=action,
            resource=resource,
            user_id=user_id,
            changes=changes,
            timestamp=datetime.utcnow().isoformat(),
            **kwargs
        )


# Create logger instances for different components
def get_logger(component: str) -> StructuredLogger:
    """Get a structured logger for a component"""
    return StructuredLogger(f"autoedit.{component}")


# Convenience loggers
api_logger = get_logger("api")
task_logger = get_logger("task")
database_logger = get_logger("database")
websocket_logger = get_logger("websocket")
security_logger = get_logger("security")
performance_logger = get_logger("performance")


# Middleware for request logging
from fastapi import Request, Response
from typing import Callable
import time


async def logging_middleware(request: Request, call_next: Callable) -> Response:
    """Middleware to log all HTTP requests"""
    start_time = time.time()
    
    # Generate request ID
    request_id = request.headers.get("X-Request-ID", str(time.time()))
    
    # Log request start
    api_logger.logger.bind(
        request_id=request_id
    ).info(
        "request_started",
        method=request.method,
        path=request.url.path,
        query_params=str(request.url.query),
        client_host=request.client.host if request.client else None
    )
    
    try:
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000
        
        # Log request completion
        api_logger.log_request(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            request_id=request_id
        )
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response
        
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        
        # Log error
        api_logger.log_error(
            error_type="request_error",
            message=str(e),
            component="api",
            exception=e,
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            duration_ms=duration_ms
        )
        
        raise