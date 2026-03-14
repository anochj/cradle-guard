from fastapi import FastAPI, File, UploadFile, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from ultralytics import YOLO
import io
import os
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from prompts import get_safety_prompt

import numpy as np
import cv2
from PIL import Image


load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket connection manager ─────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active_connections.remove(ws)

    async def broadcast(self, message: dict):
        for conn in list(self.active_connections):
            try:
                await conn.send_json(message)
            except Exception:
                self.active_connections.remove(conn)

manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

genai.configure(api_key=os.getenv("GENAI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

print("Loading YOLO World...")
yolo_model = YOLO('yolov8s-world.pt') 
print("YOLO Ready!")

#danger zone logic
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

#route can be changed if you guys want, just make sure to update the frontend fetch url accordingly
@app.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    custom_dangers: str = Form("knife, hot stove, fire"),
    force_deep_scan: str = Form("false")
    ):
    #img ->bytes -> numpy array -> cv2 img -> yolo results
    image_bytes = await file.read()
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    #each item in the custom_dangers string is stripped of whitespace and added to a list
    classes_to_find = [item.strip() for item in custom_dangers.split(',')]
    #yolo should always include baby (maybe modified for demo)
    classes_to_find.append("baby")
    yolo_model.set_classes(classes_to_find)
    #gives img to yolo and gets results, which is a list of detected objects with their classes and bounding boxes
    results = yolo_model(img_cv2)


    #object detection logic
    baby_boxes, hazard_boxes, all_detections = [], [], []

    #looping through every box yolo found
    for r in results:
        for box in r.boxes:
            class_id = int(box.cls[0])
            #translates id # from above into class name (e.g., "knife", "stove", "baby")
            class_name = yolo_model.names[class_id]
            coords = box.xyxy[0].tolist() 
            
            all_detections.append({"label": class_name, "box": coords})
            
            if class_name == "baby": 
                baby_boxes.append(coords)
            else: 
                hazard_boxes.append({"label": class_name, "box": coords})

    #danger zone logic: if any hazard box is within the buffer zone of any baby box, we consider it a potential danger and add it to the list of overlapping hazards
    overlapping_hazards = []
    for baby_box in baby_boxes:
        for hazard in hazard_boxes:
            # buffer currently 80 pixels **MODIFY** 
            if is_in_danger_zone(baby_box, hazard["box"], buffer_pixels=80):
                overlapping_hazards.append(hazard["label"])
                
    overlapping_hazards = list(set(overlapping_hazards))
    
    #60-second deep scan is forced if the user toggles it on, otherwise, it's only triggered if YOLO detects a hazard in the danger zone
    is_deep_scan = force_deep_scan.lower() == "true"

    if len(overlapping_hazards) > 0 or is_deep_scan:
        trigger_reason = "Hazard in Proximity Zone!" if len(overlapping_hazards) > 0 else "60-Second Deep Scan"
        print(f"Waking up Gemini. Reason: {trigger_reason}")
        
        #gemini prompting logic
        img_pil = Image.open(io.BytesIO(image_bytes))
        final_prompt = get_safety_prompt(overlapping_hazards, is_deep_scan)
        
        response = model.generate_content([final_prompt, img_pil])
        ai_dict = json.loads(response.text)
        
        ai_dict["yolo_boxes"] = all_detections
        ai_dict["pipeline_used"] = f"Gemini ({trigger_reason})"

        await manager.broadcast({
            "type": "alert" if ai_dict.get("status") == "HAZARD" else "status",
            "status": ai_dict.get("status", "SAFE"),
            "reason": ai_dict.get("reason", ""),
            "pipeline_used": ai_dict["pipeline_used"],
            "yolo_boxes": all_detections,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        return ai_dict
        
    else:
        print("YOLO says baby is safe. No hazards in proximity..")
        result = {
            "status": "SAFE",
            "reason": "YOLO verified all hazards are outside the predictive safety buffer.",
            "yolo_boxes": all_detections,
            "pipeline_used": "YOLO Only (Fast/Free)"
        }

        await manager.broadcast({
            "type": "status",
            "status": "SAFE",
            "reason": result["reason"],
            "pipeline_used": result["pipeline_used"],
            "yolo_boxes": all_detections,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        return result