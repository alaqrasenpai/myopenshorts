from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from services.settings_manager import settings_manager
from openai import OpenAI

router = APIRouter(prefix="/api/settings", tags=["settings"])

class SettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    active_ai_provider: Optional[str] = None
    active_gemini_model: Optional[str] = None
    active_openai_model: Optional[str] = None
    active_groq_model: Optional[str] = None
    whisper_provider: Optional[str] = None
    whisper_model_size: Optional[str] = None
    default_layout: Optional[str] = None
    default_caption_style: Optional[str] = None
    auto_publish_webhook: Optional[str] = None

class KeyTestRequest(BaseModel):
    provider: str
    api_key: str

@router.get("")
def get_settings():
    settings = settings_manager.get_all()
    # Mask keys for security in UI display
    masked = settings.copy()
    for key in ["gemini_api_key", "openai_api_key", "groq_api_key", "elevenlabs_api_key"]:
        val = masked.get(key, "")
        if val and len(val) > 8:
            masked[f"{key}_masked"] = f"{val[:4]}...{val[-4:]}"
        else:
            masked[f"{key}_masked"] = ""
    return masked

@router.post("")
def update_settings(payload: SettingsUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    saved = settings_manager.save(updates)
    return {"status": "success", "settings": saved}

@router.post("/test-key")
def test_api_key(req: KeyTestRequest):
    key = req.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API Key cannot be empty")

    provider = req.provider.lower()
    try:
        if provider == "gemini":
            # Try official modern google.genai SDK first
            candidate_models = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-1.5-flash"]
            success = False
            last_err = None

            try:
                from google import genai
                client = genai.Client(api_key=key)
                
                # Try finding active flash model
                for model_name in candidate_models:
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents="Ping test. Reply with pong."
                        )
                        if response and response.text:
                            settings_manager.save({"active_gemini_model": model_name})
                            return {
                                "status": "success",
                                "message": f"تم التحقق بنجاح من مفتاح Gemini والموديل النشط: {model_name}"
                            }
                    except Exception as e:
                        last_err = e
                        continue
            except Exception as import_err:
                pass

            # Fallback to google.generativeai with candidates
            import google.generativeai as legacy_genai
            legacy_genai.configure(api_key=key)
            for model_name in candidate_models:
                try:
                    model = legacy_genai.GenerativeModel(model_name)
                    response = model.generate_content("Ping test. Reply with: pong")
                    if response and response.text:
                        settings_manager.save({"active_gemini_model": model_name})
                        return {
                            "status": "success",
                            "message": f"تم التحقق بنجاح من مفتاح Gemini والموديل النشط: {model_name}"
                        }
                except Exception as e:
                    last_err = e
                    continue

            raise Exception(f"{last_err}")

        elif provider == "openai":
            client = OpenAI(api_key=key)
            models = client.models.list()
            return {"status": "success", "message": "OpenAI API key is valid and working!"}

        elif provider == "groq":
            client = OpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
            models = client.models.list()
            return {"status": "success", "message": "Groq API key is valid and working!"}

        else:
            raise HTTPException(status_code=400, detail="Unsupported provider")

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")
