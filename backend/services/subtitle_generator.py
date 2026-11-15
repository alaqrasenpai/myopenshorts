from pathlib import Path
from typing import List, Dict, Any

class SubtitleGenerator:
    def __init__(self):
        pass

    def generate_ass(
        self,
        words: List[Dict[str, Any]],
        output_path: str,
        style_preset: str = "hormozi",
        font_name: str = "Arial",
        font_size: int = 24
    ) -> str:
        """
        Generates an ASS subtitle file formatted for 9:16 vertical video (1080x1920)
        with word-level highlight animation.
        """
        # Define style presets
        # Colors are in &HAABBGGRR format (ASS format)
        styles = {
            "hormozi": {
                "font": "Impact",
                "primary_color": "&H00FFFFFF",  # White
                "highlight_color": "&H0000FFFF",  # Bright Yellow (&H0000FFFF)
                "outline_color": "&H00000000",  # Black
                "outline": 4,
                "shadow": 2,
                "margin_v": 450,  # Center-bottom
                "case": "uppercase"
            },
            "neon": {
                "font": "Arial Black",
                "primary_color": "&H00FFFFFF",
                "highlight_color": "&H00FF00FF",  # Magenta/Neon
                "outline_color": "&H00FF8800",  # Electric Blue outline
                "outline": 5,
                "shadow": 0,
                "margin_v": 460,
                "case": "uppercase"
            },
            "karaoke": {
                "font": "Helvetica",
                "primary_color": "&H00EEEEEE",
                "highlight_color": "&H0000FF00",  # Green
                "outline_color": "&H00000000",
                "outline": 3,
                "shadow": 1,
                "margin_v": 480,
                "case": "normal"
            },
            "minimal": {
                "font": "Arial",
                "primary_color": "&H00FFFFFF",
                "highlight_color": "&H00FFFFFF",
                "outline_color": "&H00000000",
                "outline": 2,
                "shadow": 1,
                "margin_v": 420,
                "case": "normal"
            }
        }

        cfg = styles.get(style_preset, styles["hormozi"])

        header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{cfg['font']},{font_size * 2},{cfg['primary_color']},&H000000FF,{cfg['outline_color']},{cfg['outline_color']},-1,0,0,0,100,100,0,0,1,{cfg['outline']},{cfg['shadow']},2,40,40,{cfg['margin_v']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        dialogue_lines = []

        # Group words into chunks of 3-5 words for fast short-form readability
        chunk_size = 4
        i = 0
        while i < len(words):
            chunk = words[i : i + chunk_size]
            if not chunk:
                break
                
            chunk_start = chunk[0]["start"]
            chunk_end = chunk[-1]["end"]

            # Format start & end as H:MM:SS.cs
            start_str = self._format_ass_time(chunk_start)
            end_str = self._format_ass_time(chunk_end)

            # Build word animation string
            # Each word highlights in bright color while active
            for target_idx, active_w in enumerate(chunk):
                w_start = self._format_ass_time(active_w["start"])
                w_end = self._format_ass_time(active_w["end"])
                
                parts = []
                for idx, w in enumerate(chunk):
                    w_text = w["word"].upper() if cfg["case"] == "uppercase" else w["word"]
                    if idx == target_idx:
                        # Highlight active word
                        parts.append(f"{{\\c{cfg['highlight_color']}}}{w_text}{{\\c{cfg['primary_color']}}}")
                    else:
                        parts.append(w_text)
                        
                line_text = " ".join(parts)
                dialogue_lines.append(f"Dialogue: 0,{w_start},{w_end},Default,,0,0,0,,{line_text}")

            i += chunk_size

        full_content = header + "\n".join(dialogue_lines)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(full_content)

        return output_path

    def _format_ass_time(self, seconds: float) -> str:
        s = max(0.0, float(seconds))
        h = int(s // 3600)
        m = int((s % 3600) // 60)
        sec = int(s % 60)
        cs = int(round((s - int(s)) * 100))
        if cs >= 100:
            cs = 99
        return f"{h}:{m:02d}:{sec:02d}.{cs:02d}"

subtitle_generator = SubtitleGenerator()
