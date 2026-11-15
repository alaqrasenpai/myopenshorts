import shutil
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from config import UPLOADS_DIR, DOWNLOADS_DIR
from services.downloader import downloader
from services.project_manager import project_manager

router = APIRouter(prefix="/api/streams", tags=["streams"])

class InspectRequest(BaseModel):
    url: str

class IngestRequest(BaseModel):
    url: str
    max_duration_minutes: Optional[int] = 60

@router.post("/inspect")
def inspect_url(req: InspectRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    try:
        info = downloader.extract_info(url)
        return {"status": "success", "info": info}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to inspect stream/VOD: {str(e)}")

async def _bg_download_task(project_id: str, url: str, max_duration_sec: Optional[int]):
    def on_progress(percent: float, message: str):
        project_manager.update_project(project_id, {
            "status": "downloading",
            "progress": round(percent, 1),
            "status_message": message
        })

    try:
        on_progress(5.0, "Starting stream download...")
        video_path = await downloader.download_video(
            url=url,
            video_id=project_id,
            progress_callback=on_progress,
            max_duration_seconds=max_duration_sec
        )
        project_manager.update_project(project_id, {
            "status": "downloaded",
            "progress": 100,
            "status_message": "Stream downloaded successfully",
            "video_path": video_path
        })
    except Exception as e:
        project_manager.update_project(project_id, {
            "status": "error",
            "status_message": f"Download failed: {str(e)}"
        })

@router.post("/ingest")
async def ingest_stream(req: IngestRequest, bg_tasks: BackgroundTasks):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    try:
        info = downloader.extract_info(url)
    except Exception:
        info = {"title": "Stream Source", "platform": "stream", "duration": 0}

    project = project_manager.create_project(
        title=info.get("title", "New Stream Clip Project"),
        source_type="url",
        source_url=url,
        metadata=info
    )

    max_sec = req.max_duration_minutes * 60 if req.max_duration_minutes else None
    bg_tasks.add_task(_bg_download_task, project["id"], url, max_sec)

    return {"status": "success", "project": project}

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), title: Optional[str] = Form(None)):
    ext = Path(file.filename or "video.mp4").suffix or ".mp4"
    project = project_manager.create_project(
        title=title or (Path(file.filename or "Uploaded Video").stem),
        source_type="upload",
        source_url="",
        metadata={"filename": file.filename, "platform": "upload"}
    )
    
    file_path = UPLOADS_DIR / f"{project['id']}{ext}"
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    project_manager.update_project(project["id"], {
        "status": "downloaded",
        "progress": 100,
        "status_message": "Video uploaded successfully",
        "video_path": str(file_path)
    })

    return {"status": "success", "project": project_manager.get_project(project["id"])}
