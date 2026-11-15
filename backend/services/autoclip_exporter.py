import os
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from config import CLIPS_DIR, FFMPEG_PATH

class AutoClipExporter:
    """
    Inspired by 'zhouxiaoka/autoclip':
    Generates multi-platform packaging:
    1. High-impact video cover / thumbnail image
    2. Platform-specific metadata (TikTok, YouTube Shorts, Instagram Reels)
    """
    def __init__(self, output_dir: Path = CLIPS_DIR):
        self.output_dir = output_dir

    def generate_cover_thumbnail(
        self,
        video_path: str,
        output_filename: str,
        timestamp_sec: float,
        headline_text: Optional[str] = None
    ) -> str:
        """
        Extracts a keyframe from the clip and burns a high-impact headline for a viral cover.
        """
        output_path = str(self.output_dir / output_filename)
        
        # Build filter for extracting crisp frame and burning title
        vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
        if headline_text:
            clean_text = headline_text.replace("'", "\\'").replace(":", "\\:")[:45]
            vf += f",drawtext=text='{clean_text}':fontsize=64:fontcolor=yellow:bordercolor=black:borderw=6:x=(w-text_w)/2:y=350"

        cmd = [
            FFMPEG_PATH, "-y",
            "-ss", str(timestamp_sec),
            "-i", video_path,
            "-vframes", "1",
            "-vf", vf,
            "-q:v", "2",
            output_path
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return output_path

    def generate_platform_package(self, clip: Dict[str, Any], streamer_name: str = "Streamer") -> Dict[str, Any]:
        """
        Builds ready-to-publish titles, descriptions, and hashtags for TikTok, YouTube Shorts, and Reels.
        """
        hook = clip.get("hook_title", "Unbelievable Moment")
        tags = clip.get("tags", ["#gaming", "#twitch", "#kick", "#viral"])
        category = clip.get("category", "Highlight")
        duration = clip.get("duration", 30)

        tag_string = " ".join([t if t.startswith("#") else f"#{t}" for t in tags])

        # TikTok Package
        tiktok = {
            "title": f"{hook} 😱🔥",
            "caption": f"{hook}\n\nتابع للمزيد من اللقطات اليومية! 🚀\n\n{tag_string} #fyp #viral #foryou",
            "recommended_sound": "Original Audio (Voice + Stream)",
            "character_count": len(hook)
        }

        # YouTube Shorts Package
        yt_title = f"{hook} #shorts #gaming"[:70]
        youtube = {
            "title": yt_title,
            "description": f"{hook}\n\nStream Highlight from {streamer_name}\nCategory: {category}\n\nSubscribe for daily stream clips!\n\n{tag_string} #Shorts #YouTubeShorts",
            "tags": [t.replace("#", "") for t in tags] + ["shorts", "stream highlights", "twitch clips", "kick clips"],
            "visibility": "Public",
            "audience": "Not for kids"
        }

        # Instagram Reels Package
        instagram = {
            "caption": f"{hook} 🤯\n.\n.\nDrop a comment if you saw this live! 👇\nFollow @clips for the best moments\n.\n.\n{tag_string} #reels #viralvideos #streamer",
            "share_to_feed": True
        }

        return {
            "hook_title": hook,
            "category": category,
            "duration": duration,
            "tiktok": tiktok,
            "youtube_shorts": youtube,
            "instagram_reels": instagram
        }

autoclip_exporter = AutoClipExporter()
