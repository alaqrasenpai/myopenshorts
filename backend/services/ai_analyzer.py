import os
import json
import re
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from openai import OpenAI
from services.settings_manager import settings_manager

ANALYSIS_SYSTEM_PROMPT = """
You are an elite short-form content director and viral video editor for platforms like TikTok, YouTube Shorts, and Instagram Reels.
Your expertise is analyzing long streams (Twitch, Kick, YouTube) and gaming/podcast VODs to extract high-retention, high-virality clips.

For any clip you select:
1. Duration MUST be between 18 and 65 seconds.
2. It MUST start with an instant hook (a punchy statement, high-action moment, or curiosity gap in the first 3 seconds).
3. It MUST have a coherent punchline, climax, gaming triumph/fail, or resolution.
4. Calculate a 'virality_score' from 1 to 100 based on emotional intensity, humor, pacing, and shareability.
5. Provide a catchy, viral headline/hook for the clip title.
6. Provide exact start_time and end_time (in seconds) matching the transcript boundaries.
7. Note why this clip will perform well.

Output strictly valid JSON with this structure:
{
  "clips": [
    {
      "start_time": 124.5,
      "end_time": 168.0,
      "hook_title": "HE COULD NOT BELIEVE THIS HEADSHOT 😱",
      "virality_score": 94,
      "category": "Gaming Highlight",
      "reason": "Extreme tension followed by an impossible clutch and genuine streamer disbelief reaction.",
      "tags": ["#twitch", "#gaming", "#clutch", "#viral", "#funny"],
      "suggested_layout": "split_screen"
    }
  ]
}
"""

class AIHighlightAnalyzer:
    def __init__(self):
        pass

    def analyze_highlights(
        self,
        transcript_segments: List[Dict[str, Any]],
        video_metadata: Dict[str, Any],
        energy_spikes: Optional[List[Dict[str, Any]]] = None,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        target_clips_count: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Extracts high-impact clips from the transcript and audio energy.
        Supports BYO API key for Gemini, OpenAI, or Groq, with an intelligent heuristic fallback.
        """
        provider = provider or settings_manager.get("active_ai_provider", "gemini")
        effective_key = settings_manager.get_effective_key(provider, api_key)

        # 1. Format the transcript into timestamped lines
        transcript_text = self._format_transcript(transcript_segments, energy_spikes)

        clips = []
        if effective_key:
            try:
                if provider == "gemini":
                    clips = self._analyze_with_gemini(transcript_text, video_metadata, effective_key, target_clips_count)
                elif provider in ["openai", "groq"]:
                    clips = self._analyze_with_openai_compatible(
                        transcript_text, video_metadata, effective_key, provider, target_clips_count
                    )
            except Exception as e:
                print(f"AI API analysis error: {e}. Falling back to heuristic highlight detector.")

        # If no API key or API call failed, use intelligent acoustic & speech heuristic
        if not clips:
            clips = self._heuristic_highlight_detection(transcript_segments, energy_spikes, video_metadata, target_clips_count)

        # Attach corresponding transcript words & format metadata for each clip
        for i, clip in enumerate(clips):
            clip["id"] = f"clip_{i+1}_{int(clip['start_time'])}"
            clip["duration"] = round(clip["end_time"] - clip["start_time"], 1)
            clip["formatted_start"] = self._format_timestamp(clip["start_time"])
            clip["formatted_end"] = self._format_timestamp(clip["end_time"])
            clip["timeline_range"] = f"{clip['formatted_start']} - {clip['formatted_end']}"
            
            # Extract words for this specific segment
            clip["words"] = self._extract_clip_words(transcript_segments, clip["start_time"], clip["end_time"])

        # Sort by virality score descending
        clips.sort(key=lambda x: x.get("virality_score", 0), reverse=True)
        return clips

    def _format_transcript(self, segments: List[Dict[str, Any]], energy_spikes: Optional[List[Dict[str, Any]]] = None) -> str:
        lines = []
        spike_times = set(int(s["timestamp"]) for s in (energy_spikes or []))
        
        for s in segments:
            start_str = self._format_timestamp(s["start"])
            end_str = self._format_timestamp(s["end"])
            has_spike = any(int(s["start"]) <= st <= int(s["end"]) for st in spike_times)
            spike_marker = " [🔥 HIGH ENERGY / REACTION DETECTED]" if has_spike else ""
            lines.append(f"[{start_str} -> {end_str}] {s['text']}{spike_marker}")
            
        return "\n".join(lines)

    def _analyze_with_gemini(self, transcript_text: str, meta: Dict[str, Any], api_key: str, count: int) -> List[Dict[str, Any]]:
        model_name = settings_manager.get("active_gemini_model", "gemini-3.8-flash")
        
        prompt = f"""
Stream/Video Title: {meta.get('title', 'Stream')}
Streamer / Channel: {meta.get('uploader', 'Streamer')}
Platform: {meta.get('platform', 'Twitch/Kick/YouTube')}
Total Duration: {meta.get('duration', 0)} seconds

Here is the timecoded transcript of the video, including markers for audio volume/excitement spikes:
{transcript_text[:35000]}

Find the top {count} most viral, entertaining, or dramatic clip candidates.
Respond with pure JSON only matching the specified format.
"""
        # Try modern google.genai first
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=model_name,
                contents=f"{ANALYSIS_SYSTEM_PROMPT}\n\n{prompt}",
                config={
                    "response_mime_type": "application/json",
                }
            )
            data = json.loads(response.text)
            return data.get("clips", [])
        except Exception as e:
            print(f"Modern google.genai call attempt: {e}")

        # Try fast HTTP REST with strict 15s timeout
        try:
            import httpx
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": f"{ANALYSIS_SYSTEM_PROMPT}\n\n{prompt}"}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            with httpx.Client(timeout=15.0) as http_client:
                r = http_client.post(url, json=payload)
                if r.status_code == 200:
                    res_json = r.json()
                    raw_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
                    data = json.loads(raw_text)
                    return data.get("clips", [])
        except Exception as http_err:
            print(f"HTTP REST gemini attempt: {http_err}")

        # Fallback to legacy SDK if needed with timeout
        try:
            import google.generativeai as genai_legacy
            genai_legacy.configure(api_key=api_key)
            model = genai_legacy.GenerativeModel(
                model_name=model_name,
                system_instruction=ANALYSIS_SYSTEM_PROMPT,
                generation_config={"response_mime_type": "application/json"}
            )
            response = model.generate_content(prompt, request_options={"timeout": 15})
            data = json.loads(response.text)
            return data.get("clips", [])
        except Exception as e:
            print(f"Legacy gemini call attempt: {e}")
            raise e

    def _analyze_with_openai_compatible(self, transcript_text: str, meta: Dict[str, Any], api_key: str, provider: str, count: int) -> List[Dict[str, Any]]:
        base_url = "https://api.groq.com/openai/v1" if provider == "groq" else None
        model_name = (
            settings_manager.get("active_groq_model", "llama-3.3-70b-versatile")
            if provider == "groq"
            else settings_manager.get("active_openai_model", "gpt-4o-mini")
        )

        client = OpenAI(api_key=api_key, base_url=base_url)
        prompt = f"""
Stream/Video Title: {meta.get('title', 'Stream')}
Streamer / Channel: {meta.get('uploader', 'Streamer')}
Platform: {meta.get('platform', 'Twitch/Kick/YouTube')}

Timecoded Transcript:
{transcript_text[:35000]}

Find the top {count} most viral clips. Output pure JSON.
"""
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"} if provider != "groq" else None,
            temperature=0.7
        )
        content = response.choices[0].message.content
        # parse json
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            return data.get("clips", [])
        return []

    def _heuristic_highlight_detection(
        self,
        segments: List[Dict[str, Any]],
        energy_spikes: Optional[List[Dict[str, Any]]],
        meta: Dict[str, Any],
        count: int
    ) -> List[Dict[str, Any]]:
        """Intelligent fallback based on speech density, exclamation words, and audio energy spikes"""
        if not segments:
            # Fallback for video with no speech (e.g. music/pure gameplay)
            total_duration = meta.get("duration", 180)
            clips = []
            step = max(30, total_duration // count)
            for i in range(min(count, int(total_duration // 30))):
                start = i * step
                end = min(total_duration, start + 35)
                clips.append({
                    "start_time": float(start),
                    "end_time": float(end),
                    "hook_title": f"Epic Gameplay Moment #{i+1}",
                    "virality_score": 85 - (i * 3),
                    "category": "Gaming Highlight",
                    "reason": "High pacing gameplay action detected.",
                    "tags": ["#stream", "#clips", "#gaming"],
                    "suggested_layout": "split_screen"
                })
            return clips

        # Score segments
        scored_windows = []
        spike_set = set(int(s["timestamp"]) for s in (energy_spikes or []))
        
        hype_keywords = ["omg", "no way", "what", "bro", "insane", "clip that", "let's go", "impossible", "dead", "win", "clutch", "look", "wait"]

        i = 0
        while i < len(segments):
            window_start = segments[i]["start"]
            window_text = []
            j = i
            while j < len(segments) and (segments[j]["end"] - window_start) <= 45:
                window_text.append(segments[j]["text"])
                j += 1
                
            combined_text = " ".join(window_text)
            window_end = segments[min(j - 1, len(segments) - 1)]["end"]
            duration = window_end - window_start

            if duration >= 15:
                # Score factors
                score = 65
                # Keyword factor
                for kw in hype_keywords:
                    if kw in combined_text.lower():
                        score += 5
                # Audio spike factor
                has_spike = any(int(window_start) <= st <= int(window_end) for st in spike_set)
                if has_spike:
                    score += 15

                scored_windows.append({
                    "start_time": window_start,
                    "end_time": window_end,
                    "hook_title": f"Streamer Reaction: {combined_text[:35]}...",
                    "virality_score": min(98, score),
                    "category": "Streamer Reaction" if has_spike else "Entertaining Moment",
                    "reason": "High energy speech density and reactive commentary.",
                    "tags": ["#twitch", "#kick", "#viral", "#streamer"],
                    "suggested_layout": "split_screen"
                })
            i += max(1, (j - i) // 2 + 1)

        scored_windows.sort(key=lambda x: x["virality_score"], reverse=True)
        return scored_windows[:count]

    def _extract_clip_words(self, segments: List[Dict[str, Any]], start_time: float, end_time: float) -> List[Dict[str, Any]]:
        clip_words = []
        for seg in segments:
            for w in seg.get("words", []):
                if start_time <= w["start"] <= end_time:
                    # Adjust timestamp relative to clip start
                    clip_words.append({
                        "word": w["word"],
                        "start": round(w["start"] - start_time, 2),
                        "end": round(w["end"] - start_time, 2),
                        "abs_start": w["start"],
                        "abs_end": w["end"]
                    })
        return clip_words

    def _format_timestamp(self, seconds: float) -> str:
        s = int(seconds)
        h = s // 3600
        m = (s % 3600) // 60
        sec = s % 60
        if h > 0:
            return f"{h:02d}:{m:02d}:{sec:02d}"
        return f"{m:02d}:{sec:02d}"

ai_analyzer = AIHighlightAnalyzer()
