import cv2
import numpy as np
from typing import Dict, Any, Optional, Tuple, List

class FaceTracker:
    def __init__(self):
        # Load OpenCV Haar cascades for frontal and profile face detection
        cascade_frontal = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        cascade_profile = cv2.data.haarcascades + 'haarcascade_profileface.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_frontal)
        self.profile_cascade = cv2.CascadeClassifier(cascade_profile)

    def detect_streamer_facecam(
        self, 
        video_path: str, 
        start_time: Optional[float] = None, 
        end_time: Optional[float] = None,
        sample_count: int = 25
    ) -> Dict[str, Any]:
        """
        Intelligently detects the streamer's webcam location using spatial density clustering.
        If start_time and end_time are provided, analyzes frames within that range.
        Otherwise, samples distributed frames across the stream (skipping intros).
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"quadrant": "top_left", "x": 0.0, "y": 0.12, "w": 0.26, "h": 0.35, "confidence": 0.5}

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        width = cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920.0
        height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 300)
        duration = total_frames / fps if fps > 0 else 300.0

        # Determine timestamps to sample
        if start_time is not None and end_time is not None and end_time > start_time:
            sample_times = np.linspace(start_time, end_time, sample_count)
        else:
            # For whole stream: skip the first 60 seconds (intro/countdown) and sample across duration
            safe_start = min(60.0, max(0.0, duration * 0.05))
            safe_end = max(safe_start + 10.0, duration * 0.85)
            sample_times = np.linspace(safe_start, safe_end, sample_count)

        detections = []
        min_face_dim = int(height * 0.035) # Ignore tiny HUD icons (< 3.5% of height)
        max_face_dim = int(height * 0.45)  # Ignore full screen splash graphics (> 45%)

        for t in sample_times:
            cap.set(cv2.CAP_PROP_POS_MSEC, float(t * 1000.0))
            ret, frame = cap.read()
            if not ret or frame is None:
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            # 1. Frontal faces
            faces = self.face_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1, 
                minNeighbors=4, 
                minSize=(min_face_dim, min_face_dim),
                maxSize=(max_face_dim, max_face_dim)
            )
            for (x, y, w, h) in faces:
                detections.append({
                    "x": x / width,
                    "y": y / height,
                    "w": w / width,
                    "h": h / height,
                    "cx": (x + w / 2) / width,
                    "cy": (y + h / 2) / height
                })

            # 2. Profile faces (streamers looking at side monitor/chat)
            pfaces = self.profile_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1, 
                minNeighbors=4, 
                minSize=(min_face_dim, min_face_dim),
                maxSize=(max_face_dim, max_face_dim)
            )
            for (x, y, w, h) in pfaces:
                detections.append({
                    "x": x / width,
                    "y": y / height,
                    "w": w / width,
                    "h": h / height,
                    "cx": (x + w / 2) / width,
                    "cy": (y + h / 2) / height
                })

        cap.release()

        # If no face detected, return standard streamer webcam corner
        if not detections:
            return {
                "quadrant": "top_left", 
                "x": 0.0, 
                "y": 0.12, 
                "w": 0.26, 
                "h": 0.35, 
                "confidence": 0.0
            }

        # Spatial Density Clustering:
        # Group detections by spatial proximity (distance < 0.12 in normalized space)
        clusters: List[Dict[str, Any]] = []
        for d in detections:
            matched = False
            for c in clusters:
                dist = np.hypot(d["cx"] - c["cx"], d["cy"] - c["cy"])
                if dist < 0.12:
                    c["items"].append(d)
                    c["cx"] = float(np.mean([it["cx"] for it in c["items"]]))
                    c["cy"] = float(np.mean([it["cy"] for it in c["items"]]))
                    c["w"] = float(np.mean([it["w"] for it in c["items"]]))
                    c["h"] = float(np.mean([it["h"] for it in c["items"]]))
                    matched = True
                    break
            if not matched:
                clusters.append({
                    "cx": d["cx"], 
                    "cy": d["cy"], 
                    "w": d["w"], 
                    "h": d["h"], 
                    "items": [d]
                })

        # Score clusters:
        # Stationary webcams have high frequency count and are usually not in dead center
        for c in clusters:
            freq = len(c["items"])
            dist_from_center = np.hypot(c["cx"] - 0.5, c["cy"] - 0.5)
            # Edge bonus: streamer webcams are situated around edges/corners
            c["score"] = freq * (1.0 + dist_from_center)

        clusters.sort(key=lambda c: c["score"], reverse=True)
        best = clusters[0]

        # Expand box around face to capture the full webcam border/body
        # Target aspect ratio for top section in 1080x1920 is 1080:720 = 1.5
        box_h = min(0.48, max(0.30, best["h"] * 2.4))
        # Normalized width considering frame aspect ratio (16:9):
        # 1.5 * (1080 / 1920) = ~0.84 aspect ratio in normalized units
        box_w = min(0.36, max(0.24, box_h * 1.5 * (height / width)))

        box_x = max(0.0, min(1.0 - box_w, best["cx"] - box_w / 2.0))
        box_y = max(0.0, min(1.0 - box_h, best["cy"] - box_h / 2.0))

        # Classify Quadrant / Position Name
        if best["cy"] < 0.35:
            vert = "top"
        elif best["cy"] > 0.65:
            vert = "bottom"
        else:
            vert = "center"

        if best["cx"] < 0.5:
            horiz = "left"
        else:
            horiz = "right"

        quadrant = f"{vert}_{horiz}"

        confidence = round(min(1.0, len(best["items"]) / max(1, len(sample_times))), 2)

        return {
            "quadrant": quadrant,
            "x": round(float(box_x), 3),
            "y": round(float(box_y), 3),
            "w": round(float(box_w), 3),
            "h": round(float(box_h), 3),
            "confidence": confidence
        }

face_tracker = FaceTracker()
