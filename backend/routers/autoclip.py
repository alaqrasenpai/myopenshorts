from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.project_manager import project_manager
from services.autoclip_exporter import autoclip_exporter

router = APIRouter(prefix="/api/autoclip", tags=["autoclip"])

class GenerateCoverRequest(BaseModel):
    project_id: str
    clip_id: str
    timestamp_sec: Optional[float] = None
    headline_text: Optional[str] = None

@router.get("/package/{project_id}/{clip_id}")
def get_social_package(project_id: str, clip_id: str):
    project = project_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    clip = next((c for c in project.get("clips", []) if c["id"] == clip_id), None)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    streamer = project.get("metadata", {}).get("uploader", "Streamer")
    package = autoclip_exporter.generate_platform_package(clip, streamer)
    return {"status": "success", "package": package}

@router.post("/generate-cover")
def generate_cover_thumbnail(req: GenerateCoverRequest):
    project = project_manager.get_project(req.project_id)
    if not project or not project.get("video_path"):
        raise HTTPException(status_code=404, detail="Project video not found")

    clip = next((c for c in project.get("clips", []) if c["id"] == req.clip_id), None)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    target_time = req.timestamp_sec or (clip["start_time"] + 2.0)
    headline = req.headline_text or clip.get("hook_title", "MUST WATCH")

    cover_filename = f"cover_{req.project_id}_{req.clip_id}.jpg"
    cover_path = autoclip_exporter.generate_cover_thumbnail(
        video_path=project["video_path"],
        output_filename=cover_filename,
        timestamp_sec=target_time,
        headline_text=headline
    )

    return {
        "status": "success",
        "cover_url": f"/api/clips/download/{cover_filename}",
        "filename": cover_filename
    }
