from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import tasks, projects, status
import uvicorn
import os

app = FastAPI(
    title="AutoEditTATE Task Management API",
    description="Task status management system for AutoEditTATE",
    version="1.0.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターの登録
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(status.router, prefix="/api/status", tags=["status"])

@app.get("/")
async def root():
    return {
        "message": "AutoEditTATE Task Management API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "AutoEditTATE API",
        "timestamp": os.popen("date").read().strip()
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )