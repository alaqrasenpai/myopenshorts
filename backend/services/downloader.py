import os
import re
import json
import asyncio
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, Callable
import yt_dlp
from config import DOWNLOADS_DIR, FFMPEG_PATH, FFMPEG_DIR

class VideoDownloader:
    def __init__(self, output_dir: Path = DOWNLOADS_DIR):
        self.output_dir = output_dir

    def extract_info(self, url: str) -> Dict[str, Any]:
        """Extract metadata without full download"""
        ydl_opts = {
            "skip_download": True,
            "quiet": True,
            "no_warnings": True,
            "ffmpeg_location": FFMPEG_PATH,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Detect platform
            platform = "unknown"
            if "twitch.tv" in url:
                platform = "twitch"
            elif "kick.com" in url:
                platform = "kick"
            elif "youtube.com" in url or "youtu.be" in url:
                platform = "youtube"
                
            return {
                "id": info.get("id"),
                "title": info.get("title", "Untitled Stream"),
                "uploader": info.get("uploader") or info.get("channel", "Unknown Creator"),
                "duration": info.get("duration", 0),  # in seconds
                "thumbnail": info.get("thumbnail"),
                "platform": platform,
                "is_live": info.get("is_live", False),
                "resolution": f"{info.get('width', 1920)}x{info.get('height', 1080)}",
                "fps": info.get("fps", 60),
                "description": (info.get("description") or "")[:200]
            }

    async def download_video(
        self, 
        url: str, 
        video_id: str,
        progress_callback: Optional[Callable[[float, str], None]] = None,
        max_duration_seconds: Optional[int] = None
    ) -> str:
        """
        Downloads a video/VOD/stream segment (Twitch, Kick, YouTube, m3u8).
        Returns the local path to the downloaded MP4.
        """
        out_template = str(self.output_dir / f"{video_id}.%(ext)s")
        target_path = str(self.output_dir / f"{video_id}.mp4")

        # Custom hook for download progress
        def ydl_hook(d):
            if d['status'] == 'downloading' and progress_callback:
                total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate') or 1
                downloaded = d.get('downloaded_bytes', 0)
                percent = min(99.0, (downloaded / total_bytes) * 100) if total_bytes > 1 else 50.0
                speed = d.get('speed', 0)
                speed_mb = (speed or 0) / (1024 * 1024)
                
                # Check for fragment progress (m3u8 live streams)
                frag_index = d.get('fragment_index')
                frag_count = d.get('fragment_count')
                if frag_index and frag_count:
                    percent = min(99.0, (frag_index / frag_count) * 100)
                    progress_callback(percent, f"Downloading stream segment {frag_index}/{frag_count} ({speed_mb:.1f} MB/s)")
                else:
                    progress_callback(percent, f"Downloading: {percent:.1f}% ({speed_mb:.1f} MB/s)")
            elif d['status'] == 'finished' and progress_callback:
                progress_callback(99.0, "Stream download finished. Merging video tracks...")

        ydl_opts = {
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "outtmpl": out_template,
            "merge_output_format": "mp4",
            "ffmpeg_location": FFMPEG_PATH,  # Absolute path to Gyan FFmpeg executable
            "progress_hooks": [ydl_hook],
            "quiet": True,
            "no_warnings": True,
            "hls_prefer_native": False,      # Let FFmpeg process m3u8 streams smoothly
            "retries": 10,
            "fragment_retries": 10,
            "concurrent_fragment_downloads": 4,
        }

        # If live stream or duration capped
        if max_duration_seconds:
            ydl_opts["download_ranges"] = yt_dlp.utils.download_range_func(None, [(0, max_duration_seconds)])

        loop = asyncio.get_event_loop()
        
        def _run_download():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
                
        await loop.run_in_executor(None, _run_download)
        
        # Verify file exists
        for file in self.output_dir.glob(f"{video_id}.*"):
            if file.suffix in [".mp4", ".mkv", ".webm"]:
                return str(file)

        return target_path

downloader = VideoDownloader()
