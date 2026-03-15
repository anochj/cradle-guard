import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, ShieldAlert, StopCircle, Trash2, Eye, Volume2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { checkFrameForDangers } from '../api/gemini'

const INTERVAL_MS = 8000

const getSignalingWsUrl = () => {
  const base = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000'
  return `${base.replace(/^http/, 'ws')}/ws/signaling/frontend`
}

function playAlarm(volume: number) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3)
    gain.gain.setValueAtTime(volume / 100, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.6)
  } catch { /* ignore */ }
}

function sendPushNotification(message: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('⚠️ Cradle Guard Alert', { body: message, icon: '/favicon.ico' })
  }
}

export default function Monitor() {
  const navigate = useNavigate()
  const { apiKey, actions, alertSettings, setIsMonitoring, eventLog, addEvent, clearEvents } = useApp()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [allClear, setAllClear] = useState(true)
  const [checking, setChecking] = useState(false)
  const [currentAlerts, setCurrentAlerts] = useState<string[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const watchList = actions.filter(a => a.enabled).map(a => a.text)

  const stopStreaming = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (peerRef.current) {
      peerRef.current.close()
      peerRef.current = null
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setIsActive(false)
  }, [])

  const captureFrame = useCallback((quality = 0.8): string | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !isActive || video.videoWidth === 0 || video.videoHeight === 0) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    return dataUrl.split(',')[1] ?? null
  }, [isActive])

  const startStreaming = useCallback(() => {
    const ws = new WebSocket(getSignalingWsUrl())
    wsRef.current = ws

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    peerRef.current = pc
    pc.addTransceiver('video', { direction: 'recvonly' })

    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (!stream || !videoRef.current) return
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => { /* ignore autoplay errors */ })
      setIsActive(true)
      addEvent('Connected to Raspberry Pi camera stream', 'info')
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate || ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate.toJSON(),
      }))
    }

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === 'answer' && message.sdp) {
          await pc.setRemoteDescription({ type: 'answer', sdp: message.sdp })
          return
        }

        if (message.type === 'ice-candidate' && message.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(message.candidate))
          return
        }

        if (message.type === 'camera_disconnected') {
          addEvent('Pi camera service disconnected', 'warning')
          setIsActive(false)
          return
        }

        if (message.type === 'error' && message.message) {
          addEvent(`Signaling error: ${message.message}`, 'warning')
        }
      } catch {
        addEvent('Failed to process signaling message', 'warning')
      }
    }

    ws.onopen = async () => {
      try {
        ws.send(JSON.stringify({ type: 'start_video' }))
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }))
      } catch (e) {
        addEvent('Failed to start WebRTC stream: ' + (e instanceof Error ? e.message : 'Unknown'), 'warning')
      }
    }

    ws.onclose = () => {
      setIsActive(false)
    }

    ws.onerror = () => {
      addEvent('WebSocket signaling connection failed', 'warning')
    }
  }, [addEvent])

  const checkFrame = useCallback(async () => {
    const frame = captureFrame(0.7)
    if (!frame || !apiKey) return
    setChecking(true)
    try {
      const { triggered, allClear: clear } = await checkFrameForDangers(
        frame, watchList, alertSettings.sensitivity, apiKey
      )
      setAllClear(clear)
      setCurrentAlerts(triggered)

      if (!clear && triggered.length > 0) {
        const soundDelivery = alertSettings.soundDelivery ?? 'both'
        triggered.forEach(t => {
          addEvent(t, 'danger')
          if (alertSettings.methods.includes('sound') && (soundDelivery === 'both' || soundDelivery === 'speaker')) {
            playAlarm(alertSettings.soundVolume)
          }
          if (alertSettings.methods.includes('website') && (soundDelivery === 'both' || soundDelivery === 'website')) {
            sendPushNotification(t)
          }
        })
      } else {
        addEvent('Frame checked — all clear', 'info')
      }
    } catch (e) {
      addEvent('Check failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'warning')
    } finally {
      setChecking(false)
    }
  }, [captureFrame, apiKey, watchList, alertSettings, addEvent])

  useEffect(() => {
    startStreaming()
    return () => { stopStreaming() }
  }, [startStreaming, stopStreaming])

  useEffect(() => {
    if (!isActive) return
    // First check after 2s
    const firstTimeout = setTimeout(() => { checkFrame() }, 2000)
    intervalRef.current = setInterval(checkFrame, INTERVAL_MS)
    return () => {
      clearTimeout(firstTimeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isActive, checkFrame])

  const handleStop = () => {
    stopStreaming()
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsMonitoring(false)
    navigate('/alerts')
  }

  const severityColor = { info: 'rgba(100,170,210,0.5)', warning: '#FAC775', danger: '#f09595' }

  return (
    <div className="relative z-10 min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulseDot" />
              <span className="text-xs tracking-widest uppercase text-green-400 opacity-80 font-light">Live</span>
            </div>
            <h2 className="font-serif italic text-3xl text-ocean-100">Monitoring</h2>
            <p className="text-sm text-ocean-300 opacity-55 mt-0.5">
              Checking every {INTERVAL_MS / 1000}s · {watchList.length} actions watched
            </p>
          </div>
          <button onClick={handleStop} className="btn-danger flex items-center gap-2">
            <StopCircle size={15} />
            Stop Monitoring
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Camera feed - 3 cols */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="glass-card p-3 relative">
              <div className="relative rounded-xl overflow-hidden bg-ocean-950" style={{ aspectRatio: '16/9' }}>
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                <canvas ref={canvasRef} className="hidden" />

                {/* Scan line while checking */}
                {checking && (
                  <div className="absolute left-0 right-0 h-0.5 animate-scanLine pointer-events-none"
                    style={{ background: 'linear-gradient(90deg,transparent,rgba(74,159,197,0.85),transparent)' }} />
                )}

                {/* Status badge */}
                <div className="absolute top-3 left-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: allClear ? 'rgba(15,109,86,0.5)' : 'rgba(163,45,45,0.5)',
                      border: `1px solid ${allClear ? 'rgba(29,158,117,0.4)' : 'rgba(220,80,80,0.4)'}`,
                      color: allClear ? '#5DCAA5' : '#f09595',
                    }}>
                    {allClear ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                    {checking ? 'Checking…' : allClear ? 'All Clear' : `${currentAlerts.length} Alert${currentAlerts.length !== 1 ? 's' : ''}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Alert banner */}
            <AnimatePresence>
              {!allClear && currentAlerts.length > 0 && (
                <motion.div
                  className="glass-card p-4 flex flex-col gap-2"
                  style={{ borderColor: 'rgba(220,80,80,0.35)', background: 'rgba(163,45,45,0.18)' }}
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-red-300">
                    <ShieldAlert size={16} />
                    Danger Detected!
                  </div>
                  {currentAlerts.map((a, i) => (
                    <p key={i} className="text-xs text-red-200 opacity-80 pl-6">{a}</p>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active methods */}
            <div className="flex gap-2">
              {alertSettings.methods.map(m => (
                <div key={m} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                  style={{ background: 'rgba(26,84,128,0.2)', border: '1px solid rgba(74,159,197,0.2)', color: 'rgba(128,196,220,0.7)' }}>
                  {m === 'sound' && <Volume2 size={11} />}
                  {m === 'website' && <Eye size={11} />}
                  <span className="capitalize">{m}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar - 2 cols */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Event log */}
            <div className="glass-card p-4 flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-ocean-100 text-sm font-medium">Event Log</h3>
                <button onClick={clearEvents} className="btn-ghost text-xs gap-1">
                  <Trash2 size={11} /> Clear
                </button>
              </div>
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-64 min-h-[100px]">
                {eventLog.length === 0 ? (
                  <p className="text-xs text-ocean-300 opacity-35 text-center py-6">No events yet.</p>
                ) : (
                  eventLog.map(ev => (
                    <motion.div key={ev.id}
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2 text-xs"
                    >
                      <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5"
                        style={{ background: severityColor[ev.severity] }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-ocean-200 opacity-80 leading-relaxed break-words">{ev.message}</p>
                        <p className="text-ocean-300 opacity-35 mt-0.5">
                          {ev.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Watch list */}
            <div className="glass-card p-4">
              <h3 className="text-ocean-100 text-sm font-medium mb-3">Watching for</h3>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {watchList.length === 0 ? (
                  <p className="text-xs text-ocean-300 opacity-35">No actions configured.</p>
                ) : (
                  watchList.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-ocean-200 opacity-65">
                      <span className="mt-1 flex-shrink-0">·</span>
                      <span className="leading-relaxed">{a}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
