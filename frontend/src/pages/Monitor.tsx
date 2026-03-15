import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, ShieldAlert, StopCircle, Trash2, Eye, Volume2 } from 'lucide-react'
import { useApp } from '../context/AppContext'

// Helper to get the correct WebSocket URL based on your environment
const getWsUrl = (): string => {
  const base = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000'
  const wsBase = base.replace(/^http/, 'ws')
  return `${wsBase}/ws/client`
}

// Same alarm sound generator you already built!
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
  const { alertSettings, setIsMonitoring, eventLog, addEvent, clearEvents } = useApp()
  
  // --- NEW WEBSOCKET STATES ---
  const wsRef = useRef<WebSocket | null>(null)
  const [liveFrame, setLiveFrame] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<'SAFE' | 'HAZARD'>('SAFE')
  const [reason, setReason] = useState<string>("Connecting to camera...")
  const [pipeline, setPipeline] = useState<string>("Initializing...")
  const [boxes, setBoxes] = useState<any[]>([])

  useEffect(() => {
    setIsMonitoring(true)

    const connect = () => {
      wsRef.current = new WebSocket(getWsUrl())

      wsRef.current.onopen = () => {
        setReason("Camera connected. Monitoring active.")
        setPipeline("System Ready")
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // 1. Update the live video feed
          if (data.live_frame) {
            setLiveFrame(data.live_frame)
          }

          // 2. Update the YOLO Bounding Boxes
          if (data.yolo_boxes) {
            setBoxes(data.yolo_boxes)
          }

          // 3. Handle Hazards (YOLO or Gemini)
          if (data.status === 'HAZARD') {
            setAiStatus('HAZARD')
            setReason(data.reason)
            setPipeline(data.pipeline_used)
            
            // Log it and sound the alarm!
            addEvent(data.reason, 'danger')
            const soundDelivery = alertSettings.soundDelivery ?? 'both'
            
            if (alertSettings.methods.includes('sound') && (soundDelivery === 'both' || soundDelivery === 'speaker')) {
              playAlarm(alertSettings.soundVolume)
            }
            if (alertSettings.methods.includes('website') && (soundDelivery === 'both' || soundDelivery === 'website')) {
              sendPushNotification(data.reason)
            }
          } 
          // 4. Handle Safe States (Don't override a Gemini Hazard with a YOLO Safe!)
          else if (data.status === 'SAFE') {
            setAiStatus(prev => {
              if (prev === 'HAZARD' && data.pipeline_used.includes('YOLO')) {
                return 'HAZARD' // Keep the hazard locked until Gemini clears it!
              }
              setReason(data.reason)
              setPipeline(data.pipeline_used)
              return 'SAFE'
            })
          }
        } catch (e) {
          console.error("WebSocket message error:", e)
        }
      }
    }

    connect()

    return () => {
      if (wsRef.current) wsRef.current.close()
    }
  }, []) // Empty dependency array ensures we only connect once

  const handleStop = () => {
    if (wsRef.current) wsRef.current.close()
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
              <span className="text-xs tracking-widest uppercase text-green-400 opacity-80 font-light">Live Pi Feed</span>
            </div>
            <h2 className="font-serif italic text-3xl text-ocean-100">Monitoring</h2>
            <p className="text-sm text-ocean-300 opacity-55 mt-0.5">
              Powered by: <span className="font-semibold text-ocean-200">{pipeline}</span>
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
              <div className="relative rounded-xl overflow-hidden bg-ocean-950 flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
                
                {/* --- THE NEW VIDEO FEED: Just an image tag receiving base64! --- */}
                {liveFrame ? (
                  <img src={liveFrame} alt="Live Stream" className="w-full h-full object-cover" />
                ) : (
                  <p className="text-ocean-300 opacity-50">Waiting for Raspberry Pi...</p>
                )}

                {/* YOLO Bounding Boxes Overlay */}
                {boxes.map((b, i) => {
                  // The Pi sends 640x480. We convert bounding boxes to percentages so they scale with the UI!
                  const left = (b.box[0] / 640) * 100
                  const top = (b.box[1] / 480) * 100
                  const width = ((b.box[2] - b.box[0]) / 640) * 100
                  const height = ((b.box[3] - b.box[1]) / 480) * 100
                  
                  const isBaby = b.label === 'baby'
                  
                  return (
                    <div 
                      key={i} 
                      className="absolute border-2 pointer-events-none transition-all duration-75"
                      style={{
                        left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
                        borderColor: isBaby ? '#5DCAA5' : '#f09595',
                        backgroundColor: isBaby ? 'rgba(93, 202, 165, 0.1)' : 'rgba(240, 149, 149, 0.1)'
                      }}
                    >
                      <span className="absolute -top-5 left-0 text-[10px] px-1 bg-black/60 text-white rounded">
                        {b.label}
                      </span>
                    </div>
                  )
                })}

                {/* Status badge */}
                <div className="absolute top-3 left-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md"
                    style={{
                      background: aiStatus === 'SAFE' ? 'rgba(15,109,86,0.7)' : 'rgba(163,45,45,0.8)',
                      border: `1px solid ${aiStatus === 'SAFE' ? 'rgba(29,158,117,0.6)' : 'rgba(220,80,80,0.6)'}`,
                      color: aiStatus === 'SAFE' ? '#5DCAA5' : '#f09595',
                    }}>
                    {aiStatus === 'SAFE' ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                    {aiStatus}
                  </div>
                </div>
              </div>
            </div>

            {/* Alert banner */}
            <AnimatePresence>
              {aiStatus === 'HAZARD' && (
                <motion.div
                  className="glass-card p-4 flex flex-col gap-2"
                  style={{ borderColor: 'rgba(220,80,80,0.35)', background: 'rgba(163,45,45,0.18)' }}
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-red-300">
                    <ShieldAlert size={16} />
                    Danger Detected!
                  </div>
                  <p className="text-xs text-red-200 opacity-90 pl-6 leading-relaxed">
                    {reason}
                  </p>
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

          {/* Sidebar - Event Log */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="glass-card p-4 flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-ocean-100 text-sm font-medium">Event Log</h3>
                <button onClick={clearEvents} className="btn-ghost text-xs gap-1">
                  <Trash2 size={11} /> Clear
                </button>
              </div>
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[500px] min-h-[100px]">
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
          </div>
        </div>
      </div>
    </div>
  )
}