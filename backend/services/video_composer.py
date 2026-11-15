import os
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional
from config import CLIPS_DIR, FFMPEG_PATH, FFPROBE_PATH

class VideoComposer:
    def __init__(self, output_dir: Path = CLIPS_DIR):
        self.output_dir = output_dir

    def compose_clip(
        self,
        source_video_path: str,
        output_filename: str,
        start_time: float,
        end_time: float,
        layout: str = "split_screen",
        face_box: Optional[Dict[str, float]] = None,
        game_box: Optional[Dict[str, float]] = None,
        subtitles_path: Optional[str] = None,
        show_watermark: bool = False,
    ) -> str:
        """
        Renders a 9:16 vertical video (1080x1920) for TikTok/Reels/Shorts from the source stream.
        """
        output_path = str(self.output_dir / output_filename)
        duration = max(1.0, end_time - start_time)

        # Build FFmpeg filter complex based on layout preset
        filter_complex = self._build_filter_complex(
            layout=layout,
            face_box=face_box,
            game_box=game_box,
            subtitles_path=subtitles_path
        )

        cmd = [
            FFMPEG_PATH, "-y",
            "-ss", str(start_time),
            "-t", str(duration),
            "-i", source_video_path,
            "-filter_complex", filter_complex,
            "-map", "[outv]",
            "-map", "0:a?",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "22",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            output_path
        ]

        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            err = result.stderr.decode("utf-8", errors="ignore")
            print(f"FFmpeg error: {err}")
            # Fallback to simple crop if complex filter fails
            return self._fallback_render(source_video_path, output_path, start_time, duration, subtitles_path)

        return output_path

    def _build_filter_complex(
        self,
        layout: str,
        face_box: Optional[Dict[str, float]],
        game_box: Optional[Dict[str, float]],
        subtitles_path: Optional[str]
    ) -> str:
        """Constructs filter_complex string for FFmpeg"""

        # 1. Preset: Streamer Split (Facecam on top 720px, Gameplay on bottom 1200px)
        if layout == "split_screen":
            # Default face box if not provided: top-left corner
            fb = face_box or {"x": 0.0, "y": 0.12, "w": 0.27, "h": 0.35}
            
            # Safe clamping of facecam coordinates
            fx = max(0.0, min(0.95, float(fb.get("x", 0.0))))
            fy = max(0.0, min(0.95, float(fb.get("y", 0.12))))
            fw = max(0.05, min(1.0 - fx, float(fb.get("w", 0.27))))
            fh = max(0.05, min(1.0 - fy, float(fb.get("h", 0.35))))

            fc_crop = f"crop=iw*{fw}:ih*{fh}:iw*{fx}:ih*{fy},scale=1080:720:force_original_aspect_ratio=increase,crop=1080:720"

            # Gameplay crop
            if game_box:
                gx = max(0.0, min(0.95, float(game_box.get("x", 0.1))))
                gy = max(0.0, min(0.95, float(game_box.get("y", 0.0))))
                gw = max(0.1, min(1.0 - gx, float(game_box.get("w", 0.8))))
                gh = max(0.1, min(1.0 - gy, float(game_box.get("h", 1.0))))
                game_crop = f"crop=iw*{gw}:ih*{gh}:iw*{gx}:ih*{gy},scale=1080:1200:force_original_aspect_ratio=increase,crop=1080:1200"
            else:
                # Aspect ratio for 1080:1200 is 9:10
                # If facecam is on left, shift gameplay slightly right (0.65) so webcam doesn't bleed into gameplay
                # If facecam is on right, shift gameplay slightly left (0.35)
                if fx < 0.35:
                    game_crop = "crop=ih*9/10:ih:(iw-ih*9/10)*0.65:0,scale=1080:1200:force_original_aspect_ratio=increase,crop=1080:1200"
                elif fx > 0.45:
                    game_crop = "crop=ih*9/10:ih:(iw-ih*9/10)*0.35:0,scale=1080:1200:force_original_aspect_ratio=increase,crop=1080:1200"
                else:
                    game_crop = "crop=ih*9/10:ih:(iw-ih*9/10)/2:0,scale=1080:1200:force_original_aspect_ratio=increase,crop=1080:1200"

            filter_str = (
                f"[0:v]split=2[in_fc][in_game];"
                f"[in_fc]{fc_crop}[fc];"
                f"[in_game]{game_crop}[game];"
                f"[fc][game]vstack=inputs=2[stacked]"
            )
            base_label = "[stacked]"

        # 2. Preset: Fullscreen with Blurred Background
        elif layout == "blur_background":
            filter_str = (
                f"[0:v]split=2[bg_in][fg_in];"
                f"[bg_in]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];"
                f"[fg_in]scale=1080:-1[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2[merged]"
            )
            base_label = "[merged]"

        # 3. Preset: Dynamic Face / Speaker Track (Centered 9:16)
        elif layout == "face_track":
            filter_str = (
                f"[0:v]crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920[cropped]"
            )
            base_label = "[cropped]"

        # 4. Preset: Custom Sample / Custom Coordinates
        elif layout == "custom_sample" and face_box and game_box:
            fc_crop = f"crop=iw*{face_box['w']}:ih*{face_box['h']}:iw*{face_box['x']}:ih*{face_box['y']},scale=1080:760:force_original_aspect_ratio=increase,crop=1080:760"
            game_crop = f"crop=iw*{game_box['w']}:ih*{game_box['h']}:iw*{game_box['x']}:ih*{game_box['y']},scale=1080:1160:force_original_aspect_ratio=increase,crop=1080:1160"
            filter_str = (
                f"[0:v]split=2[in_fc][in_game];"
                f"[in_fc]{fc_crop}[fc];"
                f"[in_game]{game_crop}[game];"
                f"[fc][game]vstack=inputs=2[custom_stacked]"
            )
            base_label = "[custom_stacked]"

        else:
            # Default blur
            filter_str = (
                f"[0:v]split=2[bg_in][fg_in];"
                f"[bg_in]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];"
                f"[fg_in]scale=1080:-1[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2[merged]"
            )
            base_label = "[merged]"

        # Add subtitles filter if ASS file is provided
        if subtitles_path and Path(subtitles_path).exists():
            # Escape path for FFmpeg filter on Windows
            clean_sub_path = str(Path(subtitles_path).resolve()).replace("\\", "/").replace(":", "\\:")
            filter_str += f";{base_label}subtitles='{clean_sub_path}'[outv]"
        else:
            filter_str += f";{base_label}copy[outv]"

        return filter_str

    def _fallback_render(
        self,
        source_path: str,
        output_path: str,
        start_time: float,
        duration: float,
        subtitles_path: Optional[str]
    ) -> str:
        """Simple reliable fallback crop to 9:16"""
        sub_filter = ""
        if subtitles_path and Path(subtitles_path).exists():
            clean_sub_path = str(Path(subtitles_path).resolve()).replace("\\", "/").replace(":", "\\:")
            sub_filter = f",subtitles='{clean_sub_path}'"

        vf = f"crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920{sub_filter}"
        cmd = [
            FFMPEG_PATH, "-y",
            "-ss", str(start_time),
            "-t", str(duration),
            "-i", source_path,
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "22",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            output_path
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return output_path

video_composer = VideoComposer()
