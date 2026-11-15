import os
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
import httpx
from services.settings_manager import settings_manager

class Transcriber:
    def __init__(self):
        self._local_model = None

    def _get_local_model(self, model_size: str = "base"):
        if self._local_model is None:
            from faster_whisper import WhisperModel
            # Run on CPU with int8 quantization for high speed on any system
            self._local_model = WhisperModel(model_size, device="cpu", compute_type="int8")
        return self._local_model

    async def transcribe(
        self,
        audio_path: str,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        language: Optional[str] = None,
        progress_callback: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        Transcribes audio into word-level segments:
        Returns list of segments:
        [
            {
                "id": 0,
                "start": 12.4,
                "end": 18.2,
                "text": "Oh my god, look at that headshot!",
                "words": [
                    {"word": "Oh", "start": 12.4, "end": 12.6},
                    {"word": "my", "start": 12.7, "end": 12.9},
                    {"word": "god,", "start": 13.0, "end": 13.5},
                    ...
                ]
            }
        ]
        """
        provider = provider or settings_manager.get("whisper_provider", "local")
        
        # 1. Try Groq Whisper if provider is groq or key is available
        groq_key = api_key if provider == "groq" else settings_manager.get("groq_api_key")
        if provider == "groq" and groq_key:
            try:
                return await self._transcribe_groq(audio_path, groq_key, language)
            except Exception as e:
                print(f"Groq whisper failed, falling back to local: {e}")

        # 2. Try OpenAI Whisper if provider is openai or key is available
        openai_key = api_key if provider == "openai" else settings_manager.get("openai_api_key")
        if provider == "openai" and openai_key:
            try:
                return await self._transcribe_openai(audio_path, openai_key, language)
            except Exception as e:
                print(f"OpenAI whisper failed, falling back to local: {e}")

        # 3. Default / Local Faster-Whisper
        return await self._transcribe_local(audio_path, language, progress_callback)

    async def _transcribe_local(
        self, 
        audio_path: str, 
        language: Optional[str] = None, 
        progress_callback: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        loop = asyncio.get_event_loop()

        def _run():
            model_size = settings_manager.get("whisper_model_size", "base")
            model = self._get_local_model(model_size)
            
            # Fast beam_size=1 and compute int8
            segments, info = model.transcribe(
                audio_path,
                beam_size=1,
                word_timestamps=True,
                language=language
            )
            
            total_duration = info.duration or 1.0
            result = []
            seg_id = 0
            for seg in segments:
                words = []
                if seg.words:
                    for w in seg.words:
                        words.append({
                            "word": w.word.strip(),
                            "start": round(w.start, 2),
                            "end": round(w.end, 2),
                            "probability": round(w.probability, 2)
                        })
                
                result.append({
                    "id": seg_id,
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": seg.text.strip(),
                    "words": words
                })
                seg_id += 1
                
                if progress_callback and seg_id % 3 == 0:
                    pct = min(60.0, 35.0 + ((seg.end / total_duration) * 25.0))
                    msg = f"Transcribing speech: {int(seg.end)}s / {int(total_duration)}s ({int((seg.end/total_duration)*100)}%)"
                    progress_callback(pct, msg)

            return result

        return await loop.run_in_executor(None, _run)

    async def _transcribe_groq(self, audio_path: str, api_key: str, language: Optional[str] = None) -> List[Dict[str, Any]]:
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {api_key}"}
        
        async with httpx.AsyncClient(timeout=180.0) as client:
            with open(audio_path, "rb") as f:
                files = {"file": (Path(audio_path).name, f, "audio/wav")}
                data = {
                    "model": "whisper-large-v3-turbo",
                    "response_format": "verbose_json",
                    "timestamp_granularities[]": ["word", "segment"]
                }
                if language:
                    data["language"] = language
                    
                resp = await client.post(url, headers=headers, files=files, data=data)
                resp.raise_for_status()
                res_data = resp.json()

        segments = []
        for i, s in enumerate(res_data.get("segments", [])):
            words = []
            for w in res_data.get("words", []):
                if s["start"] <= w["start"] <= s["end"]:
                    words.append({
                        "word": w["word"].strip(),
                        "start": round(w["start"], 2),
                        "end": round(w["end"], 2)
                    })
            segments.append({
                "id": i,
                "start": round(s["start"], 2),
                "end": round(s["end"], 2),
                "text": s["text"].strip(),
                "words": words
            })
        return segments

    async def _transcribe_openai(self, audio_path: str, api_key: str, language: Optional[str] = None) -> List[Dict[str, Any]]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        
        with open(audio_path, "rb") as f:
            transcription = await client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"],
                language=language
            )

        segments = []
        for i, s in enumerate(getattr(transcription, "segments", [])):
            words = []
            for w in getattr(transcription, "words", []):
                w_start = getattr(w, "start", 0)
                s_start = getattr(s, "start", 0)
                s_end = getattr(s, "end", 0)
                if s_start <= w_start <= s_end:
                    words.append({
                        "word": getattr(w, "word", "").strip(),
                        "start": round(w_start, 2),
                        "end": round(getattr(w, "end", 0), 2)
                    })
            segments.append({
                "id": i,
                "start": round(getattr(s, "start", 0), 2),
                "end": round(getattr(s, "end", 0), 2),
                "text": getattr(s, "text", "").strip(),
                "words": words
            })
        return segments

transcriber = Transcriber()
