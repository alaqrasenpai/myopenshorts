import subprocess
import json
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Tuple
from config import AUDIO_DIR, FFMPEG_PATH, FFPROBE_PATH

class AudioExtractor:
    def __init__(self, output_dir: Path = AUDIO_DIR):
        self.output_dir = output_dir

    def extract_audio(self, video_path: str, video_id: str) -> str:
        """Extract 16kHz mono WAV audio from video file for Whisper and energy analysis"""
        audio_path = str(self.output_dir / f"{video_id}.wav")
        cmd = [
            FFMPEG_PATH, "-y",
            "-i", video_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            audio_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg audio extraction failed: {result.stderr.decode('utf-8', errors='ignore')}")
        return audio_path

    def analyze_energy_spikes(self, audio_wav_path: str, window_sec: float = 1.0) -> List[Dict[str, Any]]:
        """
        Analyzes audio volume and energy levels over time to detect hype, screaming, laughter, or sudden spikes.
        Returns a timeline of energy values and detected spike regions.
        """
        try:
            import wave
            with wave.open(audio_wav_path, "rb") as wf:
                framerate = wf.getframerate()
                nframes = wf.getnframes()
                audio_bytes = wf.readframes(nframes)
                
            samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
            # Normalize to 0.0 - 1.0
            if len(samples) == 0:
                return []
            
            samples_per_window = int(framerate * window_sec)
            num_windows = len(samples) // samples_per_window
            
            energy_timeline = []
            for i in range(num_windows):
                start_sec = i * window_sec
                chunk = samples[i * samples_per_window : (i + 1) * samples_per_window]
                # RMS (Root Mean Square) energy
                rms = np.sqrt(np.mean(chunk**2)) if len(chunk) > 0 else 0
                energy_timeline.append({
                    "timestamp": round(start_sec, 2),
                    "energy": float(rms)
                })

            # Calculate baseline and threshold for hype/screaming spikes
            if not energy_timeline:
                return []
                
            energies = [e["energy"] for e in energy_timeline]
            mean_energy = float(np.mean(energies))
            std_energy = float(np.std(energies))
            spike_threshold = mean_energy + (1.2 * std_energy)

            spikes = []
            for item in energy_timeline:
                if item["energy"] >= spike_threshold and item["energy"] > 2500: # above noise floor
                    spikes.append({
                        "timestamp": item["timestamp"],
                        "intensity": min(100, int((item["energy"] / (spike_threshold + 1)) * 50))
                    })
                    
            return spikes
        except Exception as e:
            print(f"Energy analysis warning: {e}")
            return []

audio_extractor = AudioExtractor()
