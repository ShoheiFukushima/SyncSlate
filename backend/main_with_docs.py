"""Main application with OpenAPI documentation"""
from fastapi import FastAPI, Response
from fastapi.openapi.utils import get_openapi
from fastapi.responses import HTMLResponse
import json

app = FastAPI(
    title="AutoEditTATE Task Management API",
    description="Comprehensive task management system with monitoring and logging",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="AutoEditTATE API",
        version="2.0.0",
        description="""
        ## Features
        - Task lifecycle management
        - Real-time progress tracking
        - Batch operations
        - Prometheus metrics
        - Structured logging
        - WebSocket support
        
        ## Authentication
        Bearer token required for all endpoints (except /health and /metrics)
        """,
        routes=app.routes,
    )
    
    # Add custom components
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.get("/", response_class=HTMLResponse)
async def root():
    """API documentation links"""
    return """
    <html>
        <head><title>AutoEditTATE API</title></head>
        <body>
            <h1>AutoEditTATE Task Management API v2.0</h1>
            <ul>
                <li><a href="/docs">Swagger UI Documentation</a></li>
                <li><a href="/redoc">ReDoc Documentation</a></li>
                <li><a href="/openapi.json">OpenAPI Schema</a></li>
                <li><a href="/metrics">Prometheus Metrics</a></li>
                <li><a href="/health">Health Check</a></li>
            </ul>
        </body>
    </html>
    """

# Export OpenAPI schema to file
@app.on_event("startup")
async def export_openapi_schema():
    """Export OpenAPI schema on startup"""
    schema = app.openapi()
    with open("openapi.json", "w") as f:
        json.dump(schema, f, indent=2)