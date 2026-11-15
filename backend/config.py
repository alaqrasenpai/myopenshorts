import os
import shutil
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
STORAGE_DIR = PROJECT_ROOT / "storage"

# Sub-storage directories
UPLOADS_DIR = STORAGE_DIR / "uploads"
DOWNLOADS_DIR = STORAGE_DIR / "downloads"
AUDIO_DIR = STORAGE_DIR / "audio"
CLIPS_DIR = STORAGE_DIR / "clips"
TEMPLATES_DIR = STORAGE_DIR / "templates"
DATA_DIR = STORAGE_DIR / "data"

for directory in [STORAGE_DIR, UPLOADS_DIR, DOWNLOADS_DIR, AUDIO_DIR, CLIPS_DIR, TEMPLATES_DIR, DATA_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Settings config file
SETTINGS_FILE = DATA_DIR / "settings.json"
PROJECTS_FILE = DATA_DIR / "projects.json"

# Server configuration
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

# Locate FFmpeg and FFprobe with absolute path fallback
resolved_ffmpeg = shutil.which("ffmpeg")
resolved_ffprobe = shutil.which("ffprobe")

# Common fallback paths on Windows if which() misses
if not resolved_ffmpeg:
    for fallback in [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/WinGet/Packages",
        Path("C:/Program Files/ffmpeg/bin"),
        Path("C:/ffmpeg/bin"),
    ]:
        for candidate in fallback.glob("**/ffmpeg.exe"):
            resolved_ffmpeg = str(candidate)
            break
        if resolved_ffmpeg:
            break

if not resolved_ffprobe and resolved_ffmpeg:
    ffprobe_candidate = Path(resolved_ffmpeg).parent / "ffprobe.exe"
    if ffprobe_candidate.exists():
        resolved_ffprobe = str(ffprobe_candidate)

FFMPEG_PATH = os.getenv("FFMPEG_PATH") or resolved_ffmpeg or "ffmpeg"
FFPROBE_PATH = os.getenv("FFPROBE_PATH") or resolved_ffprobe or "ffprobe"
FFMPEG_DIR = str(Path(FFMPEG_PATH).parent) if Path(FFMPEG_PATH).is_file() else None

print(f"[FFmpeg] Resolved executable: {FFMPEG_PATH}")
