"""
Camera service.

- Keeps the live video feed running (MJPEG stream for the frontend).
- Every 3 seconds: screenshots the feed, runs YOLO detection, checks
  if any dangerous object is too close to the baby.
- Every 60 seconds: sets force_deep_scan so the Gemini prompt layer
  can pick it up.
"""

from __future__ import annotations

import asyncio
import math
import time
import cv2
import numpy as np
from ultralytics import YOLO

# ── Timing ───────────────────────────────────────────────────────────
SNAPSHOT_INTERVAL = 3.0       # seconds between YOLO checks
DEEP_SCAN_INTERVAL = 60.0    # seconds between Gemini deep scans
JPEG_QUALITY = 70

# ── YOLO config ──────────────────────────────────────────────────────
YOLO_MODEL_NAME = "yolov8n.pt"
TARGET_LABELS = ["person", "blanket", "bottle", "cat"]
BABY_LABEL = "person"
DISTANCE_THRESHOLD = 100     # pixels – objects closer than this = danger

# ── Internal state ───────────────────────────────────────────────────
_cap: cv2.VideoCapture | None = None
_model: YOLO | None = None
_latest_frame: bytes | None = None
_latest_snapshot: bytes | None = None
_running: bool = False

_snapshot_timestamp: float = 0.0
_deep_scan_timestamp: float = 0.0

force_deep_scan: bool = False
latest_alerts: list[dict] = []


# ── Camera lifecycle ─────────────────────────────────────────────────
def start_camera(source: int = 0) -> None:
    global _cap, _model, _running
    if _cap is not None and _cap.isOpened():
        return
    _cap = cv2.VideoCapture(source)
    if not _cap.isOpened():
        raise RuntimeError(f"Cannot open camera source {source}")
    _model = YOLO(YOLO_MODEL_NAME)
    _running = True


def stop_camera() -> None:
    global _cap, _running
    _running = False
    if _cap is not None:
        _cap.release()
        _cap = None


# ── Frame capture ────────────────────────────────────────────────────
def _grab_frame() -> bytes | None:
    if _cap is None or not _cap.isOpened():
        return None
    ret, frame = _cap.read()
    if not ret:
        return None
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    return buf.tobytes()


def get_latest_snapshot() -> bytes | None:
    return _latest_snapshot


# ── Bounding-box math ────────────────────────────────────────────────
def _edge_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Minimum pixel gap between two bbox edges.  0 when they overlap."""
    dx = max(float(a[0] - b[2]), float(b[0] - a[2]), 0.0)
    dy = max(float(a[1] - b[3]), float(b[1] - a[3]), 0.0)
    return math.hypot(dx, dy)


def _center(box: np.ndarray) -> tuple[int, int]:
    return (int((box[0] + box[2]) / 2), int((box[1] + box[3]) / 2))


# ── YOLO + proximity check ──────────────────────────────────────────
def _analyze_snapshot(frame_bytes: bytes) -> list[dict]:
    """Run YOLO on a JPEG snapshot, return proximity alerts."""
    if _model is None:
        return []

    arr = np.frombuffer(frame_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return []

    results = _model(frame, verbose=False)[0]

    detections = []
    for box in results.boxes:
        label = _model.names[int(box.cls[0])]
        if label in TARGET_LABELS:
            detections.append({
                "label": label,
                "coords": box.xyxy[0].cpu().numpy(),
                "conf": float(box.conf[0].cpu().numpy()),
            })

    babies = [d for d in detections if d["label"] == BABY_LABEL]
    if not babies:
        return []
    baby = max(babies, key=lambda d: d["conf"])

    dangers = [d for d in detections if d["label"] != BABY_LABEL]

    alerts: list[dict] = []
    for obj in dangers:
        dist = _edge_distance(baby["coords"], obj["coords"])
        if dist >= DISTANCE_THRESHOLD:
            continue

        overlapping = dist == 0.0
        alerts.append({
            "object": obj["label"],
            "distance_px": round(dist, 1),
            "overlapping": overlapping,
            "severity": "high" if overlapping or dist < DISTANCE_THRESHOLD / 3 else "medium",
            "baby_center": _center(baby["coords"]),
            "object_center": _center(obj["coords"]),
        })

    return alerts


# ── Main loop ────────────────────────────────────────────────────────
async def camera_loop() -> None:
    """Continuous loop:
       - Every ~100 ms: grab frame for the MJPEG stream.
       - Every 3 s:     screenshot → YOLO → proximity check.
       - Every 60 s:    set force_deep_scan flag for Gemini.
    """
    global _latest_frame, _latest_snapshot, _snapshot_timestamp
    global _deep_scan_timestamp, force_deep_scan, latest_alerts

    while _running:
        frame_bytes = _grab_frame()
        if frame_bytes is not None:
            _latest_frame = frame_bytes

            now = time.monotonic()

            if now - _snapshot_timestamp >= SNAPSHOT_INTERVAL:
                _latest_snapshot = frame_bytes
                _snapshot_timestamp = now

                alerts = _analyze_snapshot(frame_bytes)
                latest_alerts = alerts
                if alerts:
                    print(f"[YOLO] {len(alerts)} alert(s): "
                          + ", ".join(a['object'] for a in alerts))
                else:
                    print("[YOLO] Clear")

            if now - _deep_scan_timestamp >= DEEP_SCAN_INTERVAL:
                _deep_scan_timestamp = now
                force_deep_scan = True
                print("[CAMERA] 60s mark — force_deep_scan set to True")

        await asyncio.sleep(0.1)


# ── MJPEG stream for the frontend ───────────────────────────────────
async def mjpeg_stream():
    """Async generator yielding MJPEG chunks for a StreamingResponse."""
    while _running:
        if _latest_frame is not None:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + _latest_frame
                + b"\r\n"
            )
        await asyncio.sleep(0.1)
