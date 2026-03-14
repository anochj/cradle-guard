import { useRef, useState, useCallback } from 'react'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsActive(true)
      setError(null)
    } catch (e) {
      setError('Camera access denied. Please allow camera permissions.')
      console.error(e)
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setIsActive(false)
  }, [])

  /** Capture current frame and return base64 JPEG (no data: prefix) */
  const captureFrame = useCallback((quality = 0.8): string | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !isActive) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    return dataUrl.split(',')[1] // strip "data:image/jpeg;base64,"
  }, [isActive])

  return { videoRef, canvasRef, isActive, error, start, stop, captureFrame }
}
