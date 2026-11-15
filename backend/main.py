import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from config import CLIPS_DIR, UPLOADS_DIR, DOWNLOADS_DIR, HOST, PORT, PROJECT_ROOT
from routers import streams, clips, settings, templates, opencut, autoclip
from services.project_manager import project_manager

app = FastAPI(
    title="StreamClip Studio AI",
    description="AI-powered long-form stream clipping and automated video editing for Twitch, Kick, and YouTube",
    version="1.1.0"
)

# Enable CORS for frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount media storage directories
app.mount("/storage/clips", StaticFiles(directory=str(CLIPS_DIR)), name="clips_static")
app.mount("/storage/downloads", StaticFiles(directory=str(DOWNLOADS_DIR)), name="downloads_static")
app.mount("/storage/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads_static")

# Include Routers
app.include_router(streams.router)
app.include_router(clips.router)
app.include_router(settings.router)
app.include_router(templates.router)
app.include_router(opencut.router)
app.include_router(autoclip.router)

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "service": "StreamClip Studio AI API",
        "version": "1.1.0",
        "modules": ["OpenShorts", "Chopify", "OpenCut", "Video-Use", "AutoClip"]
    }

@app.get("/api/projects")
def list_projects():
    return project_manager.list_projects()

# Serve Frontend SPA if built
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="frontend_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("storage/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
