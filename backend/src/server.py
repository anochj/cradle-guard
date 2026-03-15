import json
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


load_dotenv()

app = FastAPI(title="Cradle Guard Signaling Server")

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SignalingState:
    def __init__(self) -> None:
        self.frontend_ws: WebSocket | None = None
        self.camera_ws: WebSocket | None = None

    async def set_frontend(self, ws: WebSocket) -> None:
        await ws.accept()
        if self.frontend_ws and self.frontend_ws is not ws:
            await self._safe_close(self.frontend_ws)
        self.frontend_ws = ws

    async def set_camera(self, ws: WebSocket) -> None:
        await ws.accept()
        if self.camera_ws and self.camera_ws is not ws:
            await self._safe_close(self.camera_ws)
        self.camera_ws = ws

    def disconnect_frontend(self, ws: WebSocket) -> None:
        if self.frontend_ws is ws:
            self.frontend_ws = None

    def disconnect_camera(self, ws: WebSocket) -> None:
        if self.camera_ws is ws:
            self.camera_ws = None

    async def send_to_frontend(self, payload: dict[str, Any]) -> bool:
        if not self.frontend_ws:
            return False
        try:
            await self.frontend_ws.send_json(payload)
            return True
        except Exception:
            self.frontend_ws = None
            return False

    async def send_to_camera(self, payload: dict[str, Any]) -> bool:
        if not self.camera_ws:
            return False
        try:
            await self.camera_ws.send_json(payload)
            return True
        except Exception:
            self.camera_ws = None
            return False

    async def _safe_close(self, ws: WebSocket) -> None:
        try:
            await ws.close(code=1000)
        except Exception:
            pass


signaling = SignalingState()
legacy_clients: set[WebSocket] = set()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/signaling/frontend")
async def ws_signaling_frontend(websocket: WebSocket):
    await signaling.set_frontend(websocket)
    await signaling.send_to_frontend({"type": "frontend_connected"})

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await signaling.send_to_frontend({"type": "error", "message": "invalid_json"})
                continue

            msg_type = message.get("type")

            if msg_type in {"start_video", "offer", "ice-candidate"}:
                forwarded = await signaling.send_to_camera(message)
                if not forwarded:
                    await signaling.send_to_frontend(
                        {"type": "error", "message": "camera_not_connected"}
                    )
            else:
                await signaling.send_to_frontend(
                    {"type": "error", "message": f"unsupported_frontend_message:{msg_type}"}
                )
    except WebSocketDisconnect:
        signaling.disconnect_frontend(websocket)


@app.websocket("/ws/signaling/camera")
async def ws_signaling_camera(websocket: WebSocket):
    await signaling.set_camera(websocket)
    await signaling.send_to_frontend({"type": "camera_connected"})

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = message.get("type")
            if msg_type in {"answer", "ice-candidate", "camera_status"}:
                await signaling.send_to_frontend(message)
            else:
                await signaling.send_to_frontend(
                    {"type": "error", "message": f"unsupported_camera_message:{msg_type}"}
                )
    except WebSocketDisconnect:
        signaling.disconnect_camera(websocket)
        await signaling.send_to_frontend({"type": "camera_disconnected"})


# Legacy endpoint retained so existing UI alert hook can stay connected.
@app.websocket("/ws")
async def ws_legacy(websocket: WebSocket):
    await websocket.accept()
    legacy_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        legacy_clients.discard(websocket)