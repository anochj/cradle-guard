import cv2 as cv
from picamera2 import Picamera2
import time

_picam2 = None
def get_camera():
    global _picam2
    if _picam2 is None:
        _picam2 = Picamera2()
        _picam2.configure(
            _picam2.create_preview_configuration(
                main={"size": (640, 480), "format": "RGB888"}
            )
        )
        _picam2.start()
    return _picam2
