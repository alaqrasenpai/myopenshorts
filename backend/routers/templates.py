from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import shutil
import json
from config import TEMPLATES_DIR

router = APIRouter(prefix="/api/templates", tags=["templates"])

TEMPLATES_CONFIG_FILE = TEMPLATES_DIR / "templates.json"

DEFAULT_TEMPLATES = [
    {
        "id": "split_streamer_gaming",
        "name": "Streamer Split (Gaming)",
        "description": "Facecam on top (38%), gameplay on bottom (62%). Ideal for Twitch & Kick streams.",
        "layout_type": "split_screen",
        "icon": "split-vertical",
        "face_box": {"x": 0.68, "y": 0.05, "w": 0.28, "h": 0.35},
        "game_box": {"x": 0.0, "y": 0.15, "w": 1.0, "h": 0.85},
        "is_default": True
    },
    {
        "id": "blur_cinematic",
        "name": "Cinematic Blurred Background",
        "description": "Full 16:9 stream centered with ultra-smooth blurred background fill. Keeps all gameplay visible.",
        "layout_type": "blur_background",
        "icon": "maximize",
        "face_box": None,
        "game_box": None,
        "is_default": False
    },
    {
        "id": "face_track_smart",
        "name": "Smart Face Tracking (9:16)",
        "description": "Dynamic vertical crop that automatically keeps the streamer centered in the frame.",
        "layout_type": "face_track",
        "icon": "user-check",
        "face_box": None,
        "game_box": None,
        "is_default": False
    },
    {
        "id": "equal_split_reaction",
        "name": "Equal 50/50 Dual Split",
        "description": "Balanced split screen: top half streamer, bottom half screen/chat/gameplay.",
        "layout_type": "split_screen",
        "icon": "columns",
        "face_box": {"x": 0.65, "y": 0.05, "w": 0.32, "h": 0.45},
        "game_box": {"x": 0.0, "y": 0.1, "w": 1.0, "h": 0.9},
        "is_default": False
    }
]

def _load_templates() -> List[Dict[str, Any]]:
    if not TEMPLATES_CONFIG_FILE.exists():
        _save_templates(DEFAULT_TEMPLATES)
        return DEFAULT_TEMPLATES
    try:
        with open(TEMPLATES_CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_TEMPLATES

def _save_templates(templates: List[Dict[str, Any]]):
    with open(TEMPLATES_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(templates, f, indent=2, ensure_ascii=False)

@router.get("")
def list_templates():
    return _load_templates()

class CreateTemplateRequest(BaseModel):
    name: str
    description: str
    layout_type: str
    face_box: Optional[Dict[str, float]] = None
    game_box: Optional[Dict[str, float]] = None

@router.post("")
def create_template(req: CreateTemplateRequest):
    templates = _load_templates()
    template_id = f"custom_{len(templates) + 1}"
    new_template = {
        "id": template_id,
        "name": req.name,
        "description": req.description,
        "layout_type": req.layout_type,
        "icon": "sparkles",
        "face_box": req.face_box or {"x": 0.7, "y": 0.05, "w": 0.25, "h": 0.35},
        "game_box": req.game_box or {"x": 0.0, "y": 0.1, "w": 1.0, "h": 0.9},
        "is_default": False
    }
    templates.append(new_template)
    _save_templates(templates)
    return {"status": "success", "template": new_template}

@router.post("/upload-sample")
async def upload_sample_frame(sample_image: UploadFile = File(...), name: Optional[str] = Form("Custom Sample Edit")):
    """Upload a sample edit mockup or frame layout to define a new template style"""
    ext = Path(sample_image.filename or "sample.png").suffix or ".png"
    sample_id = f"sample_{int(Path(sample_image.filename or '1').stat().st_mtime if False else 101)}"
    file_path = TEMPLATES_DIR / f"{sample_id}{ext}"
    
    with open(file_path, "wb") as f:
        shutil.copyfileobj(sample_image.file, f)

    templates = _load_templates()
    new_template = {
        "id": sample_id,
        "name": name,
        "description": "User uploaded layout sample preset",
        "layout_type": "custom_sample",
        "icon": "image",
        "sample_preview": f"/api/templates/sample-file/{file_path.name}",
        "face_box": {"x": 0.65, "y": 0.05, "w": 0.30, "h": 0.38},
        "game_box": {"x": 0.0, "y": 0.15, "w": 1.0, "h": 0.85},
        "is_default": False
    }
    templates.append(new_template)
    _save_templates(templates)

    return {"status": "success", "template": new_template}
