import json
import os
from typing import Any
import base64
import cv2
import numpy as np
from google import genai
from types_defs import SituationAnalysisResult, ObjectRelationship, SpecialInstructionRequest, RelationMapRequest, RelationMapResult
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from prompts import get_relation_map_prompt
from ultralytics import YOLOWorld
from database import init_db, insert_object_relationship, insert_ai_object_relationship, get_all_relationships, insert_special_instruction, get_all_special_instructions
import asyncio


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
YOLO_MODEL_NAME = os.getenv("YOLO_MODEL_NAME", "yolov8s-world.pt")
LONG_CONTEXT_BUFFER_SIZE = int(os.getenv("LONG_CONTEXT_BUFFER_SIZE", "50"))
DEFAULT_CLASSES = os.getenv(
    "DEFAULT_CLASSES",
    "baby,person,bed,crib,blanket,bottle,toy,chair,table,sofa,stairs,window,knife,scissors"
).split(",")


def _create_gemini_client() -> genai.Client | None:
    if not GEMINI_API_KEY:
        print("GEMINI_API_KEY is not set. Long-term Gemini analysis is disabled.")
        return None

    try:
        return genai.Client(api_key=GEMINI_API_KEY)
    except ValueError as exc:
        print(f"Failed to initialize Gemini client: {exc}. Long-term Gemini analysis is disabled.")
        return None


gemini_client = _create_gemini_client()

app = FastAPI(title="Cradle Guard Signaling Server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

YOLO_MODEL = YOLOWorld(YOLO_MODEL_NAME, verbose=False)

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

    async def send_immediate_alert(
        self,
        signal: str,
        descriptor: str,
        metadata: dict[str, Any],
    ) -> bool:
        payload: dict[str, Any] = {
            "type": "immediate_alert",
            "signal": signal,
            "descriptor": descriptor,
            "metadata": metadata,
        }
        return await self.send_to_frontend(payload)

    async def _safe_close(self, ws: WebSocket) -> None:
        try:
            await ws.close(code=1000)
        except Exception:
            pass


signaling = SignalingState()
legacy_clients: set[WebSocket] = set()
frame_buffer: list[str] = []


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/instructions")
async def save_special_instruction(request: SpecialInstructionRequest):
    """Save a special instruction to the database."""
    insert_special_instruction(request.instruction)
    return {"status": "ok", "instruction": request.instruction}


@app.post("/relation-map")
async def generate_relation_map(request: RelationMapRequest | str = Body(...)):
    """Send text to Gemini to generate an object safety relation map, then save the results."""
    if gemini_client is None:
        raise HTTPException(status_code=503, detail="Gemini client is not initialized. Check GEMINI_API_KEY.")

    request_text = request if isinstance(request, str) else request.text
    request_text = request_text.strip()
    if not request_text:
        raise HTTPException(status_code=400, detail="Text input cannot be empty.")

    prompt = get_relation_map_prompt(request_text)

    response = gemini_client.models.generate_content(
        model="gemini-2.5-pro",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_json_schema": RelationMapResult.model_json_schema(),
        },
    )

    if not response or not response.text:
        raise HTTPException(status_code=502, detail="No response received from Gemini.")

    result = RelationMapResult.model_validate_json(response.text)

    for rel in result.relationships:
        insert_object_relationship(rel, user_defined=True)

    return {"status": "ok", "relationships": [rel.model_dump() for rel in result.relationships]}


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


def get_all_unique_objects(relationships: list[ObjectRelationship]) -> set[str]:
    unique_objects = set(DEFAULT_CLASSES)
    for rel in relationships:
        unique_objects.add(rel.object_a)
        unique_objects.add(rel.object_b)
    return unique_objects

def is_in_danger_zone(baby_box, hazard_box, buffer_pixels=80):
    """
    Inflates the baby's bounding box to create an invisible 'Danger Zone'.
    If a hazard enters this zone, it returns True.
    """
    b_x1, b_y1, b_x2, b_y2 = baby_box
    
    # Expand the baby's box by the buffer amount in all directions
    danger_x1 = b_x1 - buffer_pixels
    danger_y1 = b_y1 - buffer_pixels
    danger_x2 = b_x2 + buffer_pixels
    danger_y2 = b_y2 + buffer_pixels
    
    h_x1, h_y1, h_x2, h_y2 = hazard_box
    
    # Check if the hazard intersects with the invisible Danger Zone
    if danger_x1 > h_x2 or danger_x2 < h_x1: return False
    if danger_y1 > h_y2 or danger_y2 < h_y1: return False
    return True

def calculate_unsafe_distances(
    boxes: dict[str, list[tuple[int, int, int, int]]], 
        relations: list[ObjectRelationship]
    ) -> list[ObjectRelationship]:
    """
    Calculates the minimum distance between the edges of two bounding boxes.
    Each box is defined as (x1, y1, x2, y2).
    Returns the distance in pixels.
    """
    results = []
    for rel in relations:
        boxes_a = boxes.get(rel.object_a, [])
        boxes_b = boxes.get(rel.object_b, [])
        if boxes_a and boxes_b:
            unsafe = any(
                is_in_danger_zone(box_a, box_b, buffer_pixels=rel.unsafe_distance)
                for box_a in boxes_a
                for box_b in boxes_b
            )
            results.append(ObjectRelationship(
                object_a=rel.object_a,
                object_b=rel.object_b,
                unsafe_distance=rel.unsafe_distance if unsafe else 0
            ))
    return results

async def handle_yolo_classification(base64_image: str, signal: SignalingState):
    relations = get_all_relationships()
    all_objects = list(get_all_unique_objects(relations))

    # img -> bytes -> numpy array -> cv2 image -> yolo results
    encoded_image = base64_image.split(',', 1)[1] if ',' in base64_image else base64_image
    image_bytes = base64.b64decode(encoded_image)
    nparr = np.frombuffer(image_bytes, dtype=np.uint8)
    img_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img_cv2 is None:
        raise ValueError("Could not decode the image. Please ensure it's a valid image file.")

    YOLO_MODEL.set_classes(all_objects)
    # gives image to yolo and gets results
    _results = YOLO_MODEL(img_cv2, verbose=False)

    # Build name -> list[(x1, y1, x2, y2)] dict; keep all detections per class
    boxes: dict[str, list[tuple[int, int, int, int]]] = {}
    for result in _results:
        for box, cls_idx in zip(result.boxes.xyxy.cpu().numpy(), result.boxes.cls.cpu().numpy()):
            label = all_objects[int(cls_idx)]
            x1, y1, x2, y2 = box
            boxes.setdefault(label, []).append((int(x1), int(y1), int(x2), int(y2)))

        detected_items = sorted(boxes.keys())
        print(f"Detected items: {detected_items if detected_items else 'none'}")

        await signal.send_to_frontend({
            "type": "yolo_result",
            "data": {
                "boxes": result.boxes.xyxy.cpu().numpy().tolist(),
                "labels": result.boxes.cls.cpu().numpy().tolist(),
                "scores": result.boxes.conf.cpu().numpy().tolist(),
                "names": all_objects,
            }
        })

    unsafe = [rel for rel in calculate_unsafe_distances(boxes, relations) if rel.unsafe_distance > 0]

    if unsafe:
        descriptor = ", ".join(f"{rel.object_a} is too close to {rel.object_b}" for rel in unsafe)
        await signal.send_immediate_alert(
            signal="proximity_alert",
            descriptor=descriptor,
            metadata={"unsafe_relationships": [rel.model_dump() for rel in unsafe]},
        )

async def handle_long_term_context(base_64_image: str, signaling: SignalingState):
    if gemini_client is None:
        return

    frame_buffer.append(base_64_image)

    if len(frame_buffer) < LONG_CONTEXT_BUFFER_SIZE:
        return

    print("######### Calling Gemini for long-term context analysis... ##########")

    result: SituationAnalysisResult | None = None
    buffered_images = frame_buffer.copy()
    frame_buffer.clear()

    # Start smaller while debugging
    buffered_images = buffered_images[-4:]

    image_parts: list[genai.types.Part] = []
    total_bytes = 0

    for img in buffered_images:
        raw_bytes = base64.b64decode(img.split(",", 1)[1] if "," in img else img)
        total_bytes += len(raw_bytes)
        image_parts.append(
            genai.types.Part.from_bytes(
                data=raw_bytes,
                mime_type="image/jpeg",
            )
        )

    print(f"Prepared {len(image_parts)} images for Gemini, total {total_bytes / 1024:.1f} KB")

    user_prompt = (
        "Analyze this sequence of images for baby safety. "
        "Identify immediate dangers, concerning object interactions, and precautions. "
        "Return only valid JSON matching the schema."
    )

    system_instruction = (
        "You analyze baby safety across a sequence of images. "
        "Focus on danger, risky proximity, and unsafe interactions."
    )

    special_instructions = get_all_special_instructions()
    if special_instructions:
        system_instruction += f"\nUser special instructions: {special_instructions}"

    try:
        print("Sending images and instructions to Gemini for analysis...")

        response = await asyncio.wait_for(
            gemini_client.aio.models.generate_content(
                model=GEMINI_MODEL,
                contents=[*image_parts, user_prompt],
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_json_schema=SituationAnalysisResult.model_json_schema(),
                ),
            ),
            timeout=45,
        )

        print("Received response from Gemini for long-term context analysis.")
        print("Gemini raw response:", response.text)

    except asyncio.TimeoutError:
        print("Gemini request timed out.")
        await signaling.send_immediate_alert(
            signal="processing_error",
            descriptor="Gemini request timed out during long-term context analysis.",
            metadata={"error": "timeout"},
        )
        return

    except Exception as exc:
        print(f"Gemini call failed: {type(exc).__name__}: {exc}")
        await signaling.send_immediate_alert(
            signal="processing_error",
            descriptor=f"Gemini long-term context analysis failed: {exc}",
            metadata={"error": str(exc)},
        )
        return

    if not response or not response.text:
        print("Gemini returned no text.")
        await signaling.send_to_frontend({
            "type": "long_term_context_analysis",
            "data": None,
        })
        return

    try:
        result = SituationAnalysisResult.model_validate_json(response.text)
    except Exception as exc:
        print(f"Failed to parse Gemini JSON: {type(exc).__name__}: {exc}")
        print("Unparsed Gemini text:", response.text)
        await signaling.send_immediate_alert(
            signal="processing_error",
            descriptor="Gemini returned invalid JSON for long-term context analysis.",
            metadata={"error": str(exc), "raw_response": response.text},
        )
        return

    print(result.analysis)

    if result.immediately_alert:
        await signaling.send_immediate_alert(
            signal="immediate_threat",
            descriptor=result.analysis,
            metadata=result.model_dump(),
        )

    if result.relationships:
        for rel in result.relationships:
            insert_ai_object_relationship(rel)

    await signaling.send_to_frontend({
        "type": "long_term_context_analysis",
        "data": result.model_dump(),
    })

async def handle_incoming_image(base64_image: str, signaling: SignalingState) -> None:
    if not base64_image:
        print("No image data received in message")
        return

    await handle_yolo_classification(base64_image, signaling)
    # TODO: Uncomment
    await handle_long_term_context(base64_image, signaling)

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
            elif msg_type == "classify":
                image_data = message.get("image")

                if not isinstance(image_data, str):
                    print("Invalid image data in classify message")
                    continue
                try:
                    await handle_incoming_image(image_data, signaling)
                except Exception as exc:
                    await signaling.send_immediate_alert(
                        signal="processing_error",
                        descriptor=f"Error processing incoming image: {exc}",
                        metadata={"error": str(exc)},
                    )
            else:
                print(f"Unsupported message type from camera: {msg_type}")
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

if __name__ == "__main__":
    init_db()
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)