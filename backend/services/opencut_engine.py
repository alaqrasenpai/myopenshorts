import os
import subprocess
import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
from config import CLIPS_DIR, FFMPEG_PATH, FFPROBE_PATH

class OpenCutEngine:
    """
    OpenCut & Video-Use execution engine:
    Handles multi-track manual editing, audio micro-fades, silence removal,
    and prompt-driven FFmpeg rendering.
    """
    def __init__(self, output_dir: Path = CLIPS_DIR):
        self.output_dir = output_dir

    def detect_silences(self, video_path: str, start_time: float, end_time: float, noise_db: int = -30, min_duration: float = 0.5) -> List[Dict[str, float]]:
        """
        Detects silent pauses / dead space in the video using FFmpeg silencedetect.
        Returns list of silence intervals: [{"start": 2.1, "end": 3.4, "duration": 1.3}]
        """
        duration = max(0.5, end_time - start_time)
        cmd = [
            FFMPEG_PATH,
            "-ss", str(start_time),
            "-t", str(duration),
            "-i", video_path,
            "-af", f"silencedetect=noise={noise_db}dB:d={min_duration}",
            "-f", "null",
            "-"
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        output = res.stderr.decode("utf-8", errors="ignore")

        silences = []
        silence_start = None
        for line in output.splitlines():
            start_match = re.search(r"silence_start:\s*([\d\.]+)", line)
            if start_match:
                silence_start = float(start_match.group(1))

            end_match = re.search(r"silence_end:\s*([\d\.]+)\s*\|\s*silence_duration:\s*([\d\.]+)", line)
            if end_match and silence_start is not None:
                s_end = float(end_match.group(1))
                s_dur = float(end_match.group(2))
                silences.append({
                    "start": round(silence_start, 2),
                    "end": round(s_end, 2),
                    "duration": round(s_dur, 2)
                })
                silence_start = None

        return silences

    def render_manual_timeline(
        self,
        source_video_path: str,
        output_filename: str,
        segments: List[Dict[str, float]], # List of [{"start": 12.0, "end": 18.5, "speed": 1.0}]
        text_overlays: Optional[List[Dict[str, Any]]] = None, # [{"text": "LOL", "start": 1.0, "end": 4.0, "x": 100, "y": 200}]
        enable_audio_microfades: bool = True, # 30ms fade from video-use to prevent popping
        target_aspect_ratio: str = "9:16", # "9:16", "16:9", "1:1"
        color_grade: Optional[str] = None # "cinematic", "vibrant", "warm", "none"
    ) -> str:
        """
        Renders a manual timeline with precise cuts, audio smoothing, text overlays, and optional color grade.
        """
        output_path = str(self.output_dir / output_filename)

        if not segments:
            raise ValueError("Timeline must contain at least one segment")

        # Color grading filter definitions
        color_filter_map = {
            "cinematic": "eq=contrast=1.12:brightness=-0.02:saturation=1.2,colorbalance=rs=0.05:bs=-0.03",
            "vibrant": "eq=saturation=1.35:contrast=1.08",
            "warm": "colorbalance=rs=0.1:gs=0.03:bs=-0.08,eq=saturation=1.15",
        }
        color_fx = color_filter_map.get(color_grade, "")

        # Target dimensions
        if target_aspect_ratio == "9:16":
            scale_filter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
        elif target_aspect_ratio == "1:1":
            scale_filter = "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080"
        else:
            scale_filter = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080"

        # Build filter_complex for multi-segment cuts
        filter_parts = []
        concat_v_inputs = []
        concat_a_inputs = []

        for i, seg in enumerate(segments):
            s_start = max(0.0, float(seg["start"]))
            s_end = max(s_start + 0.1, float(seg["end"]))
            duration = s_end - s_start
            speed = float(seg.get("speed", 1.0))

            # Trim video
            v_label = f"v{i}"
            v_processed = f"v{i}_proc"
            filter_parts.append(f"[0:v]trim=start={s_start}:end={s_end},setpts=PTS-STARTPTS/{speed}[{v_label}]")

            # Apply scale/color to segment
            fx_chain = scale_filter
            if color_fx:
                fx_chain += f",{color_fx}"
            filter_parts.append(f"[{v_label}]{fx_chain}[{v_processed}]")
            concat_v_inputs.append(f"[{v_processed}]")

            # Trim audio with video-use 30ms anti-pop micro-fades
            a_label = f"a{i}"
            a_processed = f"a{i}_proc"
            fade_filter = ""
            if enable_audio_microfades and duration > 0.15:
                # 30ms fade-in and 30ms fade-out
                fade_out_start = max(0.01, (duration / speed) - 0.03)
                fade_filter = f",afade=t=in:ss=0:d=0.03,afade=t=out:st={fade_out_start:.3f}:d=0.03"

            filter_parts.append(f"[0:a]atrim=start={s_start}:end={s_end},asetpts=PTS-STARTPTS{fade_filter}[{a_processed}]")
            concat_a_inputs.append(f"[{a_processed}]")

        # Concat segments
        num_segments = len(segments)
        filter_parts.append(
            f"{''.join(concat_v_inputs)}{''.join(concat_a_inputs)}concat=n={num_segments}:v=1:a=1[v_concat][a_concat]"
        )

        final_v_label = "[v_concat]"

        # Add text overlays if any
        if text_overlays:
            drawtext_filters = []
            for t_item in text_overlays:
                text = t_item.get("text", "").replace("'", "\\'").replace(":", "\\:")
                t_start = t_item.get("start", 0)
                t_end = t_item.get("end", 9999)
                x = t_item.get("x", "(w-text_w)/2")
                y = t_item.get("y", "h-text_h-200")
                font_size = t_item.get("font_size", 48)
                font_color = t_item.get("font_color", "white")
                drawtext_filters.append(
                    f"drawtext=text='{text}':fontsize={font_size}:fontcolor={font_color}:bordercolor=black:borderw=4:x={x}:y={y}:enable='between(t,{t_start},{t_end})'"
                )
            if drawtext_filters:
                filter_parts.append(f"{final_v_label}{','.join(drawtext_filters)}[v_text]")
                final_v_label = "[v_text]"

        filter_complex = ";".join(filter_parts)

        cmd = [
            FFMPEG_PATH, "-y",
            "-i", source_video_path,
            "-filter_complex", filter_complex,
            "-map", final_v_label,
            "-map", "[a_concat]",
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
            print(f"OpenCut render error: {err}")
            raise RuntimeError(f"OpenCut FFmpeg render failed: {err[-400:]}")

        return output_path

opencut_engine = OpenCutEngine()
