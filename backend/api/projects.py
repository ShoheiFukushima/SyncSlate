from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from models import get_db, Project
from pydantic import BaseModel

router = APIRouter()

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    xml_path: Optional[str] = None
    audio_path: Optional[str] = None
    video_path: Optional[str] = None
    output_dir: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    xml_path: Optional[str] = None
    audio_path: Optional[str] = None
    video_path: Optional[str] = None
    output_dir: Optional[str] = None

@router.post("/")
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """新しいプロジェクトを作成"""
    db_project = Project(
        name=project.name,
        description=project.description,
        xml_path=project.xml_path,
        audio_path=project.audio_path,
        video_path=project.video_path,
        output_dir=project.output_dir
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    return {
        "project_id": db_project.id,
        "status": "created",
        "message": f"Project '{project.name}' created successfully"
    }

@router.get("/")
async def list_projects(
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    """プロジェクト一覧を取得"""
    projects = db.query(Project).offset(offset).limit(limit).all()
    
    return {
        "projects": [project.to_dict() for project in projects],
        "total": db.query(Project).count(),
        "limit": limit,
        "offset": offset
    }

@router.get("/{project_id}")
async def get_project(project_id: int, db: Session = Depends(get_db)):
    """特定のプロジェクトの詳細を取得"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    return project.to_dict()

@router.put("/{project_id}")
async def update_project(
    project_id: int,
    update: ProjectUpdate,
    db: Session = Depends(get_db)
):
    """プロジェクトを更新"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    if update.name is not None:
        project.name = update.name
    
    if update.description is not None:
        project.description = update.description
    
    if update.xml_path is not None:
        project.xml_path = update.xml_path
    
    if update.audio_path is not None:
        project.audio_path = update.audio_path
    
    if update.video_path is not None:
        project.video_path = update.video_path
    
    if update.output_dir is not None:
        project.output_dir = update.output_dir
    
    db.commit()
    db.refresh(project)
    
    return {
        "project_id": project.id,
        "status": "updated",
        "message": f"Project '{project.name}' updated successfully"
    }

@router.delete("/{project_id}")
async def delete_project(project_id: int, db: Session = Depends(get_db)):
    """プロジェクトを削除（関連するタスクも削除）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    project_name = project.name
    db.delete(project)
    db.commit()
    
    return {
        "project_id": project_id,
        "status": "deleted",
        "message": f"Project '{project_name}' and all related tasks deleted successfully"
    }

@router.get("/{project_id}/tasks")
async def get_project_tasks(
    project_id: int,
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    """プロジェクトに関連するタスクを取得"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    from models import Task, TaskStatus
    
    query = db.query(Task).filter(Task.project_id == project_id)
    
    if status:
        try:
            status_enum = TaskStatus(status)
            query = query.filter(Task.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    tasks = query.offset(offset).limit(limit).all()
    
    return {
        "project_id": project_id,
        "project_name": project.name,
        "tasks": [task.to_dict() for task in tasks],
        "total": query.count(),
        "limit": limit,
        "offset": offset
    }