import os
import asyncio
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from config import CLIPS_DIR, AUDIO_DIR
from services.project_manager import project_manager
from services.audio_extractor import audio_extractor
from services.transcriber import transcriber
from services.face_tracker import face_tracker
from services.ai_analyzer import ai_analyzer
from services.subtitle_generator import subtitle_generator
from services.video_composer import video_composer

router = APIRouter(prefix="/api/clips", tags=["clips"])

class ProcessProjectRequest(BaseModel):
    project_id: str
    ai_provider: Optional[str] = None
    api_key: Optional[str] = None
    target_clips_count: Optional[int] = 5

class DetectFacecamRequest(BaseModel):
    project_id: str
    clip_id: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None

class RenderClipRequest(BaseModel):
    project_id: str
    clip_id: str
    start_time: float
    end_time: float
    layout: Optional[str] = "split_screen"  # split_screen, blur_background, face_track, custom_sample
    caption_style: Optional[str] = "hormozi"  # hormozi, neon, karaoke, minimal, none
    face_box: Optional[Dict[str, Any]] = None
    game_box: Optional[Dict[str, Any]] = None

async def _bg_process_project(project_id: str, ai_provider: Optional[str], api_key: Optional[str], target_count: int):
    project = project_manager.get_project(project_id)
    if not project or not project.get("video_path"):
        return

    video_path = project["video_path"]

    try:
        # Step 1: Extract Audio (10% - 25%)
        project_manager.update_project(project_id, {
            "status": "processing",
            "progress": 15,
            "status_message": "Extracting audio and analyzing sound frequencies..."
        })
        audio_path = audio_extractor.extract_audio(video_path, project_id)
        energy_spikes = audio_extractor.analyze_energy_spikes(audio_path)
        project_manager.update_project(project_id, {"audio_path": audio_path})

        # Step 2: Transcribe Speech with word-level timestamps (25% - 60%)
        def on_whisper_progress(percent: float, message: str):
            project_manager.update_project(project_id, {
                "progress": round(percent, 1),
                "status_message": message
            })

        project_manager.update_project(project_id, {
            "progress": 35,
            "status_message": "Transcribing speech and aligning word timestamps (Whisper)..."
        })
        transcript_segments = await transcriber.transcribe(
            audio_path=audio_path,
            provider="groq" if (ai_provider == "groq" and api_key) else None,
            api_key=api_key,
            progress_callback=on_whisper_progress
        )

        # Step 3: Computer Vision & Facecam Detection (60% - 75%)
        project_manager.update_project(project_id, {
            "progress": 65,
            "status_message": "Analyzing video frames & detecting streamer webcam location..."
        })
        facecam_info = face_tracker.detect_streamer_facecam(video_path)
        project_manager.update_project(project_id, {"facecam_info": facecam_info})

        # Step 4: AI Highlight & Virality Detection (75% - 95%)
        project_manager.update_project(project_id, {
            "progress": 80,
            "status_message": "AI analyzing viral moments, hooks, and punchlines..."
        })
        clips = ai_analyzer.analyze_highlights(
            transcript_segments=transcript_segments,
            video_metadata=project.get("metadata", {}),
            energy_spikes=energy_spikes,
            provider=ai_provider,
            api_key=api_key,
            target_clips_count=target_count
        )

        # Attach detected facecam to each clip
        for c in clips:
            c["face_box"] = facecam_info

        # Step 5: Ready!
        project_manager.update_project(project_id, {
            "status": "ready",
            "progress": 100,
            "status_message": f"Successfully generated {len(clips)} viral clips!",
            "clips": clips,
            "transcript": transcript_segments
        })

    except Exception as e:
        project_manager.update_project(project_id, {
            "status": "error",
            "status_message": f"Processing error: {str(e)}"
        })

@router.post("/process")
def process_project(req: ProcessProjectRequest, bg_tasks: BackgroundTasks):
    project = project_manager.get_project(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.get("video_path") or not Path(project["video_path"]).exists():
        raise HTTPException(status_code=400, detail="Video file is not yet downloaded or missing")

    project_manager.update_project(req.project_id, {
        "status": "processing",
        "progress": 5,
        "status_message": "Queueing AI highlight extraction..."
    })

    bg_tasks.add_task(
        _bg_process_project,
        req.project_id,
        req.ai_provider,
        req.api_key,
        req.target_clips_count or 5
    )

    return {"status": "success", "message": "Processing started in background", "project": project_manager.get_project(req.project_id)}

@router.get("/project/{project_id}")
def get_project_clips(project_id: str):
    project = project_manager.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/detect-facecam")
def detect_facecam(req: DetectFacecamRequest):
    project = project_manager.get_project(req.project_id)
    if not project or not project.get("video_path"):
        raise HTTPException(status_code=404, detail="Project video not found")

    video_path = project["video_path"]
    start_time = req.start_time
    end_time = req.end_time

    if req.clip_id and (start_time is None or end_time is None):
        clip = next((c for c in project.get("clips", []) if c["id"] == req.clip_id), None)
        if clip:
            start_time = clip.get("start_time")
            end_time = clip.get("end_time")

    face_info = face_tracker.detect_streamer_facecam(
        video_path=video_path,
        start_time=start_time,
        end_time=end_time
    )

    # Save to clip if clip_id is provided
    if req.clip_id:
        clips = project.get("clips", [])
        for c in clips:
            if c["id"] == req.clip_id:
                c["face_box"] = face_info
        project_manager.update_project(req.project_id, {"clips": clips})

    return {"status": "success", "facecam_info": face_info}

@router.post("/render")
def render_clip(req: RenderClipRequest):
    project = project_manager.get_project(req.project_id)
    if not project or not project.get("video_path"):
        raise HTTPException(status_code=404, detail="Project video not found")

    video_path = project["video_path"]
    clip = next((c for c in project.get("clips", []) if c["id"] == req.clip_id), None)

    # Determine facecam coordinates
    face_box = req.face_box
    if not face_box and clip and clip.get("face_box"):
        face_box = clip["face_box"]
    if not face_box and project.get("facecam_info"):
        face_box = project["facecam_info"]
    
    # Auto-detect on the fly if still missing
    if not face_box:
        face_box = face_tracker.detect_streamer_facecam(
            video_path=video_path,
            start_time=req.start_time,
            end_time=req.end_time
        )

    game_box = req.game_box

    # Generate subtitles if requested
    subtitles_path = None
    if req.caption_style and req.caption_style != "none" and clip and clip.get("words"):
        sub_filename = f"sub_{req.project_id}_{req.clip_id}.ass"
        sub_file_path = str(AUDIO_DIR / sub_filename)
        subtitle_generator.generate_ass(
            words=clip["words"],
            output_path=sub_file_path,
            style_preset=req.caption_style
        )
        subtitles_path = sub_file_path

    out_filename = f"render_{req.project_id}_{req.clip_id}_{req.layout}.mp4"
    rendered_path = video_composer.compose_clip(
        source_video_path=video_path,
        output_filename=out_filename,
        start_time=req.start_time,
        end_time=req.end_time,
        layout=req.layout or "split_screen",
        face_box=face_box,
        game_box=game_box,
        subtitles_path=subtitles_path
    )

    # Update clip in project with rendered file url
    clips = project.get("clips", [])
    for c in clips:
        if c["id"] == req.clip_id:
            c["rendered_url"] = f"/api/clips/download/{out_filename}"
            c["rendered_file"] = out_filename
            c["selected_layout"] = req.layout
            c["selected_caption_style"] = req.caption_style
            c["face_box"] = face_box

    project_manager.update_project(req.project_id, {"clips": clips})

    return {
        "status": "success",
        "download_url": f"/api/clips/download/{out_filename}",
        "filename": out_filename,
        "face_box": face_box
    }

@router.get("/download/{filename}")
def download_clip(filename: str):
    file_path = CLIPS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Rendered clip not found")
    return FileResponse(path=str(file_path), media_type="video/mp4", filename=filename)
