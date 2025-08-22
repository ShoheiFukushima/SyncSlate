"""
Configuration management for AutoEditTATE backend
"""
import os
from typing import List
from pydantic import BaseSettings, validator
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with validation"""
    
    # API Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = []
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    
    # Database Configuration
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/autoedit_tate"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40
    
    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Celery Configuration
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_TASK_MAX_RETRIES: int = 3
    CELERY_TASK_RETRY_DELAY: int = 60
    
    # Security Configuration
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_STORAGE_URL: str = "redis://localhost:6379/1"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    
    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
    
    @validator("SECRET_KEY", pre=True)
    def validate_secret_key(cls, v, values):
        """Ensure secret key is set in production"""
        env = values.get("ENVIRONMENT", "development")
        if env == "production" and not v:
            raise ValueError("SECRET_KEY must be set in production")
        return v or "dev-secret-key-change-in-production"
    
    @validator("DEBUG", pre=True)
    def set_debug_mode(cls, v, values):
        """Disable debug in production"""
        env = values.get("ENVIRONMENT", "development")
        if env == "production":
            return False
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()