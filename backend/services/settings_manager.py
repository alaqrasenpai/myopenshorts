import json
from pathlib import Path
from typing import Dict, Any, Optional
from config import SETTINGS_FILE

DEFAULT_SETTINGS = {
    "gemini_api_key": "",
    "openai_api_key": "",
    "groq_api_key": "",
    "elevenlabs_api_key": "",
    "active_ai_provider": "gemini",  # gemini, openai, groq
    "active_gemini_model": "gemini-3.8-flash",
    "active_openai_model": "gpt-4o-mini",
    "active_groq_model": "llama-3.3-70b-versatile",
    "whisper_provider": "local",  # local, groq, openai
    "whisper_model_size": "base",  # tiny, base, small, medium
    "default_layout": "split_screen",  # split_screen, blur_background, face_track, custom
    "default_caption_style": "hormozi",  # hormozi, neon, karaoke, minimal
    "auto_publish_webhook": ""
}

class SettingsManager:
    def __init__(self, filepath: Path = SETTINGS_FILE):
        self.filepath = filepath
        self._ensure_settings()

    def _ensure_settings(self):
        if not self.filepath.exists():
            self.save(DEFAULT_SETTINGS)
        else:
            # Migration check: update legacy gemini-2.0-flash to gemini-3.8-flash
            current = self.get_all()
            if current.get("active_gemini_model") in ["gemini-2.0-flash", "models/gemini-2.0-flash"]:
                current["active_gemini_model"] = "gemini-3.8-flash"
                self.save(current)

    def get_all(self) -> Dict[str, Any]:
        try:
            if self.filepath.exists():
                with open(self.filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    merged = {**DEFAULT_SETTINGS, **data}
                    return merged
        except Exception:
            pass
        return DEFAULT_SETTINGS.copy()

    def get(self, key: str, default: Any = None) -> Any:
        settings = self.get_all()
        return settings.get(key, default)

    def save(self, settings_update: Dict[str, Any]) -> Dict[str, Any]:
        current = self.get_all()
        current.update(settings_update)
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2, ensure_ascii=False)
        return current

    def get_effective_key(self, provider: Optional[str] = None, user_provided_key: Optional[str] = None) -> str:
        if user_provided_key and user_provided_key.strip():
            return user_provided_key.strip()
        
        provider = provider or self.get("active_ai_provider", "gemini")
        if provider == "gemini":
            return self.get("gemini_api_key", "")
        elif provider == "openai":
            return self.get("openai_api_key", "")
        elif provider == "groq":
            return self.get("groq_api_key", "")
        return ""

settings_manager = SettingsManager()
