import json
import re
from typing import Dict, Any, List, Optional
import google.generativeai as genai
from openai import OpenAI
from services.settings_manager import settings_manager
from services.opencut_engine import opencut_engine

AGENT_SYSTEM_PROMPT = """
You are an expert AI video editor agent modeled after 'video-use'.
Your job is to translate user natural language editing commands into concrete timeline operations.

Available actions you can specify in JSON:
1. "segments": List of intervals to KEEP from the clip, each with:
   - "start": float (seconds)
   - "end": float (seconds)
   - "speed": float (e.g. 1.0, 1.25, 1.5)
2. "remove_silence": boolean (if user asked to remove pauses, dead air, or hesitations)
3. "color_grade": string ("cinematic", "vibrant", "warm", or "none")
4. "target_aspect_ratio": string ("9:16", "16:9", "1:1")
5. "text_overlays": List of text items:
   - "text": string
   - "start": float
   - "end": float
   - "font_size": int
   - "font_color": string

Clip Total Duration: {duration} seconds.
Initial Clip Boundaries: from {start_time} to {end_time}.

Output strictly valid JSON with this structure:
{
  "explanation": "Brief Arabic explanation of what cuts and edits were applied",
  "segments": [
    {"start": 12.0, "end": 25.5, "speed": 1.0}
  ],
  "remove_silence": true,
  "color_grade": "cinematic",
  "target_aspect_ratio": "9:16",
  "text_overlays": []
}
"""

class AgentVideoEditor:
    def __init__(self):
        pass

    def interpret_edit_command(
        self,
        command: str,
        clip_info: Dict[str, Any],
        provider: Optional[str] = None,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Interprets natural language editing command into timeline operations.
        """
        provider = provider or settings_manager.get("active_ai_provider", "gemini")
        effective_key = settings_manager.get_effective_key(provider, api_key)

        start_t = float(clip_info.get("start_time", 0))
        end_t = float(clip_info.get("end_time", start_t + 30))
        duration = max(1.0, end_t - start_t)

        sys_prompt = AGENT_SYSTEM_PROMPT.format(
            duration=duration,
            start_time=start_t,
            end_time=end_t
        )

        user_prompt = f"""
User Editing Instruction: "{command}"
Clip Words/Transcript:
{json.dumps(clip_info.get('words', [])[:50], ensure_ascii=False)}

Convert the instruction into timeline operations:
"""
        if effective_key and provider == "gemini":
            model_name = settings_manager.get("active_gemini_model", "gemini-3.8-flash")
            try:
                from google import genai
                client = genai.Client(api_key=effective_key)
                resp = client.models.generate_content(
                    model=model_name,
                    contents=f"{sys_prompt}\n\n{user_prompt}",
                    config={"response_mime_type": "application/json"}
                )
                return json.loads(resp.text)
            except Exception as e:
                print(f"Modern google.genai agent edit attempt: {e}")

            try:
                import google.generativeai as genai_legacy
                genai_legacy.configure(api_key=effective_key)
                model = genai_legacy.GenerativeModel(
                    model_name=model_name,
                    system_instruction=sys_prompt,
                    generation_config={"response_mime_type": "application/json"}
                )
                resp = model.generate_content(user_prompt)
                return json.loads(resp.text)
            except Exception as e:
                print(f"Gemini agent edit failed: {e}")

        elif effective_key and provider in ["openai", "groq"]:
            try:
                base_url = "https://api.groq.com/openai/v1" if provider == "groq" else None
                model_name = settings_manager.get("active_groq_model", "llama-3.3-70b-versatile") if provider == "groq" else settings_manager.get("active_openai_model", "gpt-4o-mini")
                client = OpenAI(api_key=effective_key, base_url=base_url)
                resp = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": sys_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"} if provider != "groq" else None
                )
                content = resp.choices[0].message.content
                match = re.search(r"\{.*\}", content, re.DOTALL)
                if match:
                    return json.loads(match.group(0))
            except Exception as e:
                print(f"OpenAI/Groq agent edit failed: {e}")

        # Smart rule-based fallback if no API key is available
        return self._heuristic_command_parser(command, start_t, end_t)

    def _heuristic_command_parser(self, command: str, start_time: float, end_time: float) -> Dict[str, Any]:
        cmd_lower = command.lower()
        color_grade = "none"
        if "سينمائي" in cmd_lower or "cinematic" in cmd_lower:
            color_grade = "cinematic"
        elif "حيوي" in cmd_lower or "vibrant" in cmd_lower:
            color_grade = "vibrant"

        remove_silence = any(w in cmd_lower for w in ["صمت", "silence", "pause", "وقفات", "فراغ"])

        # Check for trim beginning
        s_start = start_time
        if "احذف البداية" in cmd_lower or "cut intro" in cmd_lower:
            s_start += 3.0

        return {
            "explanation": f"تم تطبيق التعديلات بناءً على الأمر: {command}",
            "segments": [
                {"start": s_start, "end": end_time, "speed": 1.0}
            ],
            "remove_silence": remove_silence,
            "color_grade": color_grade,
            "target_aspect_ratio": "9:16",
            "text_overlays": []
        }

agent_editor = AgentVideoEditor()
