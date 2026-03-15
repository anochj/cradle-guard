from fastapi import FastAPI, File, UploadFile, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from ultralytics import YOLOWorld
#io (fake file on ram), cv2 for img processing 
import io
import os
import json
import base64
import asyncio
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


# webSocket connection manager for user react dashboard
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active_connections
            self.active_connections.remove(ws)

# Broadcasts a message to all connected clients. If a connection fails, it removes that connection from the active list.
    async def broadcast(self, message: dict):
        #send data to every connected react dashboard
        for conn in list(self.active_connections):
            try:
                await conn.send_json(message)
            except Exception:
                self.active_connections.remove(conn)

manager = ConnectionManager()


     manager.disconnect(websocket)


client = genai.Client(api_key=os.getenv("GENAI_API_KEY"))
model = "gemini-2.5-flash-lite"

print("Loading YOLO World...")
yolo_model = YOLOWorld('yolov8s-world.pt') 
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

#####

async def background_gemini_analysis(base64_image: str, overlapping_hazards: list, trigger_reason: str):
    """Runs Gemini without freezing the video feed."""
    try:
        # Decode image for Gemini
        encoded_data = base64_image.split(',')[1] if ',' in base64_image else base64_image
        img_bytes = base64.b64decode(encoded_data)
        img_pil = Image.open(io.BytesIO(img_bytes))

        # generate prompt + call gemnini
        is_deep_scan = len(overlapping_hazards) == 0
        final_prompt = get_safety_prompt(overlapping_hazards, is_deep_scan)
        
        response = gemini_model.generate_content([final_prompt, img_pil])
        ai_dict = json.loads(response.text)

        # Uses connectionmanager to push report to react ui
        await manager.broadcast({
            "type": "gemini_update",
            "status": ai_dict.get("status", "SAFE"),
            "reason": ai_dict.get("reason", "Analysis complete."),
            "pipeline_used": f"Gemini ({trigger_reason})",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        print(f"Background Gemini Error: {e}")


        ####
# database ****EDIT****
async def fetch_user_preferences(user_id: str = "demo_user") -> str:
    # """
    # Fetches the parent's custom danger list from Supabase.
    # """
    try:
        # TODO: Uncomment and wire this up when Supabase client is ready
        # response = supabase.table('user_settings').select('dangers').eq('id', user_id).execute()
        # return response.data[0]['dangers']
        
        # Mock return for testing for now:
        return "knife, hot stove, fire"
    except Exception as e:
        print(f"Error: {e}")
        return "baby" # Safe fallback if DB goes offline
    
# broadcast Helper Function ──
async def broadcast_yolo_state(status: str, reason: str, boxes: list, pipeline: str, base64_image: str):
    """Dynamically builds and sends the WebSocket payload to React."""
    await manager.broadcast({
        "type": "yolo_alert" if status == "HAZARD" else "yolo_safe",
        "status": status,
        "reason": reason,
        "yolo_boxes": boxes,
        "pipeline_used": pipeline,
        "live_frame": base64_image 
    })
        
#react endpoint
@app.websocket("/ws/client")
async def client_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("React Dashboard Connected!")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("React Dashboard Disconnected!")

#rasberry pi endpoint

@app.websocket("/ws/pi")
async def pi_endpoint(websocket: WebSocket):

    await websocket.accept()
    print("Pi connected for video stream")
    # window_name = "Pi Live Feed"
    # cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    frame_buffer = [] #buffer to hold incoming frames for potential future use (e.g., if we want to run analysis on recent frames when a hazard is detected)
    fram_counter = 0
    DEEP_SCAN_LIMIT = 30 #number of frames to buffer for deep scan analysis **MODIFY AS NEEDED**
    try:
        while True:
            message = await websocket.receive_json()
            base64_image = message.get("image")
            custom_dangers = await fetch_user_preferences()
            
            if not base64_image:
                print("No image data received in message")
                continue
            
            frame_counter += 1
            frame_buffer.append(base64_image)

            #img ->bytes -> numpy array -> cv2 img -> yolo results
            image_bytes = base64.b64decode(base64_image.split(',')[1]) if ',' in base64_image else base64_image
            nparr = np.frombuffer(image_bytes, np.uint8)
            img_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img_cv2 is None:
                raise ValueError("Could not decode the image. Please ensure it's a valid image file.")


            #each item in the custom_dangers string is stripped of whitespace and added to a list
            classes_to_find = [item.strip() for item in custom_dangers.split(',')]
            #yolo should always include baby (maybe modified for demo)
            classes_to_find.append("baby")
            
            yolo_model.set_classes(classes_to_find)
            #gives img to yolo and gets results, which is a list of detected objects with their classes and bounding boxes
            results = yolo_model(img_cv2)

            ###

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
            
            if len(overlapping_hazards) > 0:
                # INSTANT ALARM: Broadcast to React clients!
                reason = f"Hazards detected: {', '.join(overlapping_hazards)}"
                # Broadcast Hazard!
                await broadcast_yolo_state("HAZARD", reason, all_detections, "YOLO (Zero-Latency)", base64_image)
                # Wake up Gemini!
                asyncio.create_task(background_gemini_analysis(base64_image, overlapping_hazards, "Proximity Breach"))
                
            elif frame_counter >= DEEP_SCAN_LIMIT:
                asyncio.create_task(background_gemini_analysis(base64_image, [], f"{DEEP_SCAN_LIMIT}-Frame Routine Scan"))
                frame_buffer = []
                frame_counter = 0
                await broadcast_yolo_state("SAFE", "Scanning...", all_detections, "YOLO (Scanning)", base64_image)
            else:
                await broadcast_yolo_state("SAFE", "No hazards in proximity.", all_detections, "YOLO (Safe)", base64_image)

                # if "bytes" in message and message["bytes"] is not None:
                #     image_bytes = message["bytes"]

                #     nparr = np.frombuffer(image_bytes, np.uint8)
                #     frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                #     if frame is None:
                #         print("Failed to decode incoming frame")
                #         continue

                #     cv2.imshow(window_name, frame)

                #     key = cv2.waitKey(1) & 0xFF
                #     if key == ord("q"):
                #         print("Window closed by server user")
                #         break

                # elif "text" in message and message["text"] is not None:
                #     print("Received text message:", message["text"])

                # elif message.get("type") == "websocket.disconnect":
                #     break

        except WebSocketDisconnect:
            print("Pi disconnected frontend")
            manager.disconnect(websocket)

        except Exception as e:
            print("WebSocket video error:", e)



#old route post logic for single image analysis (not used in current video stream implementation, but could be repurposed for manual image uploads from the frontend or for testing)
#route can be changed if you guys want, just make sure to update the frontend fetch url accordingly
# @app.post("/analyze")
# async def analyze_image(
#     file: UploadFile = File(...),
#     custom_dangers: str = Form("knife, hot stove, fire"),
#     force_deep_scan: str = Form("false")
#     ):
#   
    
    # #60-second deep scan is forced if the user toggles it on, otherwise, it's only triggered if YOLO detects a hazard in the danger zone
    # is_deep_scan = force_deep_scan.lower() == "true"

    # if len(overlapping_hazards) > 0 or is_deep_scan:
    #     trigger_reason = "Hazard in Proximity Zone!" if len(overlapping_hazards) > 0 else "60-Second Deep Scan"
    #     print(f"Waking up Gemini. Reason: {trigger_reason}")
        
    #     #gemini prompting logic
    #     img_pil = Image.open(io.BytesIO(image_bytes))
    #     # TODO: Add the final prompt
    #     final_prompt = ""#'get_safety_prompt(overlapping_hazards, is_deep_scan)
        
    #     response = model.generate_content([final_prompt, img_pil])
    #     ai_dict = json.loads(response.text)
        
    #     ai_dict["yolo_boxes"] = all_detections
    #     ai_dict["pipeline_used"] = f"Gemini ({trigger_reason})"

    #     await manager.broadcast({
    #         "type": "alert" if ai_dict.get("status") == "HAZARD" else "status",
    #         "status": ai_dict.get("status", "SAFE"),
    #         "reason": ai_dict.get("reason", ""),
    #         "pipeline_used": ai_dict["pipeline_used"],
    #         "yolo_boxes": all_detections,
    #         "timestamp": datetime.now(timezone.utc).isoformat(),
    #     })

    #     return ai_dict
        
    #     # [final_prompt, img_pil]
    #     response = client.models.generate_content(
    #         model=model,
    #         contents=[
    #             types.Part.from_text(text=final_prompt),
    #             types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
    #         ],
    #         config=types.GenerateContentConfig(
    #             temperature=0,
    #             top_p=0.95,
    #             top_k=20,
    #         ),
    #     )
    #     if response.text:
    #         ai_dict = json.loads(response.text)
            
    #         ai_dict["yolo_boxes"] = all_detections
    #         ai_dict["pipeline_used"] = f"Gemini ({trigger_reason})"
    #         return ai_dict
    # else:
    #     print("YOLO says baby is safe. No hazards in proximity..")
    #     result = {
    #         "status": "SAFE",
    #         "reason": "YOLO verified all hazards are outside the predictive safety buffer.",
    #         "yolo_boxes": all_detections,
    #         "pipeline_used": "YOLO Only (Fast/Free)"
    #     }

    #     await manager.broadcast({
    #         "type": "status",
    #         "status": "SAFE",
    #         "reason": result["reason"],
    #         "pipeline_used": result["pipeline_used"],
    #         "yolo_boxes": all_detections,
    #         "timestamp": datetime.now(timezone.utc).isoformat(),
    #     })

    #     return result