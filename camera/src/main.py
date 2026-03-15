import asyncio
import base64
import contextlib
import json
import os
import time

from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.sdp import candidate_from_sdp, candidate_to_sdp
from av import VideoFrame
import cv2 as cv
import numpy as np
import websockets

from camera import get_camera


SIGNALING_URL = os.getenv(
    "SIGNALING_URL",
    "wss://makayla-stomatological-nonmiraculously.ngrok-free.dev/ws/signaling/camera",
)
JPEG_QUALITY = int(os.getenv("CLASSIFY_JPEG_QUALITY", "50"))
FRAME_DELAY = float(os.getenv("CLASSIFY_FRAME_DELAY", "0.25"))


class PiCameraTrack(VideoStreamTrack):
    def __init__(self, camera):
        super().__init__()
        self.camera = camera

    async def recv(self):
        # print("track recv called")
        pts, time_base = await self.next_timestamp()
        frame_bgr = await asyncio.to_thread(self.camera.capture_array)
        frame = VideoFrame.from_ndarray(frame_bgr, format="bgr24")
        frame.pts = pts
        frame.time_base = time_base
        return frame


def _encode_jpeg_base64(frame_bgr: np.ndarray, jpeg_quality: int = 75) -> str | None:
    ok, encoded = cv.imencode(
        ".jpg",
        frame_bgr,
        [int(cv.IMWRITE_JPEG_QUALITY), int(max(1, min(100, jpeg_quality)))],
    )
    if not ok:
        return None
    return base64.b64encode(encoded.tobytes()).decode("ascii")


async def send_classify_feed(websocket, camera) -> None:
    # print("classify task started")

    while True:
        await asyncio.sleep(FRAME_DELAY)

        frame_bgr = await asyncio.to_thread(camera.capture_array)
        image_b64 = await asyncio.to_thread(_encode_jpeg_base64, frame_bgr, JPEG_QUALITY)

        if not image_b64:
            # print("failed to encode classify frame")
            continue

        # print("sending classify message")

        await websocket.send(
            json.dumps(
                {
                    "type": "classify",
                    "image": image_b64,
                    "encoding": "base64",
                    "mime_type": "image/jpeg",
                    "timestamp_ms": int(time.time() * 1000),
                }
            )
        )


async def run_camera_peer() -> None:
    camera = get_camera()

    while True:
        pc: RTCPeerConnection | None = None
        classify_task: asyncio.Task[None] | None = None
        websocket = None
        try:
            async with websockets.connect(SIGNALING_URL, max_size=None) as websocket:
                # print(f"Connected to signaling server: {SIGNALING_URL}")

                pc = RTCPeerConnection()
                video_track = PiCameraTrack(camera)
                pc.addTrack(video_track)

                @pc.on("icecandidate")
                async def on_icecandidate(candidate):
                    if candidate is None or websocket is None:
                        return

                    await websocket.send(
                        json.dumps(
                            {
                                "type": "ice-candidate",
                                "candidate": {
                                    "candidate": candidate_to_sdp(candidate),
                                    "sdpMid": candidate.sdpMid,
                                    "sdpMLineIndex": candidate.sdpMLineIndex,
                                },
                            }
                        )
                    )

                await websocket.send(json.dumps({"type": "camera_status", "status": "ready"}))

                classify_task = asyncio.create_task(send_classify_feed(websocket, camera))

                async for raw_message in websocket:
                    message = json.loads(raw_message)
                    msg_type = message.get("type")

                    if msg_type == "start_video":
                        continue

                    if msg_type == "offer":
                        offer = RTCSessionDescription(sdp=message["sdp"], type="offer")
                        await pc.setRemoteDescription(offer)

                        answer = await pc.createAnswer()
                        await pc.setLocalDescription(answer)

                        await websocket.send(
                            json.dumps(
                                {
                                    "type": "answer",
                                    "sdp": pc.localDescription.sdp,
                                }
                            )
                        )
                        continue

                    if msg_type == "ice-candidate":
                        payload = message.get("candidate")
                        if not payload:
                            continue

                        candidate = candidate_from_sdp(payload["candidate"])
                        candidate.sdpMid = payload.get("sdpMid")
                        candidate.sdpMLineIndex = payload.get("sdpMLineIndex")
                        await pc.addIceCandidate(candidate)

        except Exception as exc:
            print(f"Camera peer error: {exc}")
        finally:
            if classify_task is not None:
                classify_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await classify_task

            if pc is not None:
                await pc.close()

        await asyncio.sleep(3)


def main() -> None:
    try:
        asyncio.run(run_camera_peer())
    except KeyboardInterrupt:
        print("Stopped camera peer")


if __name__ == "__main__":
    main()
