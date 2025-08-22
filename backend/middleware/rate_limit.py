"""
Rate limiting middleware using slowapi
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from config import get_settings

settings = get_settings()

# Create limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_DEFAULT] if settings.RATE_LIMIT_ENABLED else [],
    storage_uri=settings.RATE_LIMIT_STORAGE_URL,
    enabled=settings.RATE_LIMIT_ENABLED
)

# Custom rate limit error handler
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded"""
    response = {
        "error": "Rate limit exceeded",
        "message": f"Too many requests. {exc.detail}",
        "retry_after": exc.retry_after if hasattr(exc, 'retry_after') else None
    }
    return response

# Export for use in main app
__all__ = ["limiter", "custom_rate_limit_handler", "RateLimitExceeded"]