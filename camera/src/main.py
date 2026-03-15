import time
import cv2 as cv
import websockets.sync.client

from picamera2 import Picamera2


SERVER_WS_URL = "wss://makayla-stomatological-nonmiraculously.ngrok-free.dev/ws"


def get_camera():
    cam = Picamera2()
    config = cam.create_preview_configuration(
        main={"size": (640, 480), "format": "RGB888"}
    )
    cam.configure(config)
    cam.start()
    return cam


def main():
    cam = get_camera()
    time.sleep(1)

    try:
        with websockets.sync.client.connect(SERVER_WS_URL, max_size=None) as ws:
            print(f"Connected to {SERVER_WS_URL}")

            while True:
                frame_rgb = cam.capture_array()
                frame_bgr = cv.cvtColor(frame_rgb, cv.COLOR_RGB2BGR)

                ok, encoded = cv.imencode(".jpg", frame_bgr, [cv.IMWRITE_JPEG_QUALITY, 80])
                if not ok:
                    print("Failed to encode frame")
                    continue

                ws.send(encoded.tobytes())

                if cv.waitKey(1) & 0xFF == ord("q"):
                    break

    except KeyboardInterrupt:
        print("\nStopped by user")
    except Exception as e:
        print(f"Client error: {e}")
    finally:
        cam.stop()
        cv.destroyAllWindows()


if __name__ == "__main__":
    main()