from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from services.project_manager import project_manager
from services.opencut_engine import opencut_engine
from services.agent_editor import agent_editor

router = APIRouter(prefix="/api/opencut", tags=["opencut"])

class DetectSilenceRequest(BaseModel):
    project_id: str
    start_time: float
    end_time: float
    noise_db: Optional[int] = -30
    min_duration: Optional[float] = 0.5

class ManualTimelineSegment(BaseModel):
    start: float
    end: float
    speed: Optional[float] = 1.0

class RenderOpenCutRequest(BaseModel):
    project_id: str
    clip_id: str
    segments: List[ManualTimelineSegment]
    text_overlays: Optional[List[Dict[str, Any]]] = None
    target_aspect_ratio: Optional[str] = "9:16"
    color_grade: Optional[str] = "none"
    enable_audio_microfades: Optional[bool] = True

class AgentEditRequest(BaseModel):
    project_id: str
    clip_id: str
    instruction: str
    ai_provider: Optional[str] = None
    api_key: Optional[str] = None

@router.post("/silences")
def detect_clip_silences(req: DetectSilenceRequest):
    project = project_manager.get_project(req.project_id)
    if not project or not project.get("video_path"):
        raise HTTPException(status_code=404, detail="Project video not found")

    silences = opencut_engine.detect_silences(
        video_path=project["video_path"],
        start_time=req.start_time,
        end_time=req.end_time,
        noise_db=req.noise_db or -30,
        min_duration=req.min_duration or 0.5
    )
    return {"status": "success", "silences": silences}

@router.post("/render")
def render_manual_timeline(req: RenderOpenCutRequest):
    project = project_manager.get_project(req.project_id)
    if not project or not project.get("video_path"):
        raise HTTPException(status_code=404, detail="Project video not found")

    out_filename = f"opencut_{req.project_id}_{req.clip_id}.mp4"
    rendered_path = opencut_engine.render_manual_timeline(
        source_video_path=project["video_path"],
        output_filename=out_filename,
        segments=[s.model_dump() for s in req.segments],
        text_overlays=req.text_overlays,
        enable_audio_microfades=req.enable_audio_microfades if req.enable_audio_microfades is not None else True,
        target_aspect_ratio=req.target_aspect_ratio or "9:16",
        color_grade=req.color_grade
    )

    # Update project clip
    clips = project.get("clips", [])
    for c in clips:
        if c["id"] == req.clip_id:
            c["rendered_url"] = f"/api/clips/download/{out_filename}"
            c["rendered_file"] = out_filename
            c["is_manual_opencut_edit"] = True

    project_manager.update_project(req.project_id, {"clips": clips})

    return {
        "status": "success",
        "download_url": f"/api/clips/download/{out_filename}",
        "filename": out_filename
    }

@router.post("/agent-edit")
def execute_agent_edit(req: AgentEditRequest):
    """
    Video-Use style: User gives prompt like 'Cut pauses, apply cinematic grade, add text'
    and AI automatically applies the edits!
    """
    project = project_manager.get_project(req.project_id)
    if not project or not project.get("video_path"):
        raise HTTPException(status_code=404, detail="Project video not found")

    clip = next((c for c in project.get("clips", []) if c["id"] == req.clip_id), None)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    # 1. AI interprets the command
    ops = agent_editor.interpret_edit_command(
        command=req.instruction,
        clip_info=clip,
        provider=req.ai_provider,
        api_key=req.api_key
    )

    # 2. Check if silence removal is needed
    segments = ops.get("segments", [{"start": clip["start_time"], "end": clip["end_time"], "speed": 1.0}])
    if ops.get("remove_silence", False):
        silences = opencut_engine.detect_silences(
            video_path=project["video_path"],
            start_time=clip["start_time"],
            end_time=clip["end_time"],
            min_duration=0.5
        )
        if silences:
            # Cut around silences
            active_segments = []
            curr = clip["start_time"]
            for sil in silences:
                abs_sil_start = clip["start_time"] + sil["start"]
                abs_sil_end = clip["start_time"] + sil["end"]
                if abs_sil_start > curr + 0.3:
                    active_segments.append({"start": curr, "end": abs_sil_start, "speed": 1.0})
                curr = abs_sil_end
            if curr < clip["end_time"] - 0.3:
                active_segments.append({"start": curr, "end": clip["end_time"], "speed": 1.0})
            if active_segments:
                segments = active_segments

    # 3. Render final output
    out_filename = f"agent_edit_{req.project_id}_{req.clip_id}.mp4"
    rendered_path = opencut_engine.render_manual_timeline(
        source_video_path=project["video_path"],
        output_filename=out_filename,
        segments=segments,
        text_overlays=ops.get("text_overlays"),
        enable_audio_microfades=True,
        target_aspect_ratio=ops.get("target_aspect_ratio", "9:16"),
        color_grade=ops.get("color_grade", "none")
    )

    return {
        "status": "success",
        "explanation": ops.get("explanation", "تم تنفيذ التعديلات بنجاح"),
        "download_url": f"/api/clips/download/{out_filename}",
        "filename": out_filename,
        "operations": ops
    }
