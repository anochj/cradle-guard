import asyncio
import json
import os

from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.sdp import candidate_from_sdp, candidate_to_sdp
from av import VideoFrame
import websockets

from camera import get_camera


SIGNALING_URL = os.getenv("SIGNALING_URL", "ws://localhost:8000/ws/signaling/camera")


class PiCameraTrack(VideoStreamTrack):
    def __init__(self, camera):
        super().__init__()
        self.camera = camera

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        frame_rgb = await asyncio.to_thread(self.camera.capture_array)
        frame = VideoFrame.from_ndarray(frame_rgb, format="rgb24")
        frame.pts = pts
        frame.time_base = time_base
        return frame


async def run_camera_peer() -> None:
    camera = get_camera()

    while True:
        pc: RTCPeerConnection | None = None
        websocket = None
        try:
            async with websockets.connect(SIGNALING_URL, max_size=None) as websocket:
                print(f"Connected to signaling server: {SIGNALING_URL}")
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