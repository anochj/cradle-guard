"""
Camera service.

- Keeps the live video feed running (MJPEG stream for the frontend).
- Every 3 seconds: screenshots the feed and POSTs it to server.py's
  /analyze endpoint, which handles all YOLO + proximity + Gemini logic.
- Every 60 seconds: sends force_deep_scan=true so Gemini gets woken up
  regardless of what YOLO sees.
"""

from __future__ import annotations

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor

import cv2
import requests

# ── Timing ───────────────────────────────────────────────────────────
SNAPSHOT_INTERVAL = 3.0       # seconds between /analyze POSTs
DEEP_SCAN_INTERVAL = 60.0    # seconds between forced Gemini scans
JPEG_QUALITY = 70

# ── Server config ────────────────────────────────────────────────────
ANALYZE_URL = "http://localhost:8000/analyze"

# ── Internal state ───────────────────────────────────────────────────
_cap: cv2.VideoCapture | None = None
_latest_frame: bytes | None = None
_running: bool = False

_snapshot_timestamp: float = 0.0
_deep_scan_timestamp: float = 0.0

custom_dangers: str = "knife, hot stove, fire"
latest_result: dict | None = None

_executor = ThreadPoolExecutor(max_workers=1)


# ── Camera lifecycle ─────────────────────────────────────────────────
def start_camera(source: int = 0) -> None:
    global _cap, _running
    if _cap is not None and _cap.isOpened():
        return
    _cap = cv2.VideoCapture(source)
    if not _cap.isOpened():
        raise RuntimeError(f"Cannot open camera source {source}")
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


# ── POST to /analyze ─────────────────────────────────────────────────
def _post_to_analyze(frame_bytes: bytes, deep_scan: bool) -> dict | None:
    """Blocking POST -- runs in a thread so it doesn't stall the async loop."""
    try:
        resp = requests.post(
            ANALYZE_URL,
            files={"file": ("frame.jpg", frame_bytes, "image/jpeg")},
            data={
                "custom_dangers": custom_dangers,
                "force_deep_scan": "true" if deep_scan else "false",
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"[CAMERA] Failed to POST to /analyze: {e}")
        return None


# ── Main loop ────────────────────────────────────────────────────────
async def camera_loop() -> None:
    """Continuous loop:
       - Every ~100 ms: grab a frame for the MJPEG stream.
       - Every 3 s:     POST the frame to /analyze.
       - Every 60 s:    include force_deep_scan=true in the POST.
    """
    global _latest_frame, _snapshot_timestamp
    global _deep_scan_timestamp, latest_result

    loop = asyncio.get_event_loop()

    while _running:
        frame_bytes = _grab_frame()
        if frame_bytes is not None:
            _latest_frame = frame_bytes

            now = time.monotonic()

            if now - _snapshot_timestamp >= SNAPSHOT_INTERVAL:
                _snapshot_timestamp = now

                deep_scan = now - _deep_scan_timestamp >= DEEP_SCAN_INTERVAL
                if deep_scan:
                    _deep_scan_timestamp = now
                    print("[CAMERA] 60s mark — sending force_deep_scan=true")

                result = await loop.run_in_executor(
                    _executor, _post_to_analyze, frame_bytes, deep_scan
                )

                if result is not None:
                    latest_result = result
                    status = result.get("status", "?")
                    pipeline = result.get("pipeline_used", "?")
                    print(f"[CAMERA] /analyze → {status} ({pipeline})")

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
