import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Camera, ScanLine, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useCamera } from '../hooks/useCamera'
import { useApp } from '../context/AppContext'
import { scanRoomForHazards } from '../api/gemini'
import type { Hazard } from '../types'

const SEVERITY_CLASS: Record<Hazard['severity'], string> = {
  high: 'severity-high',
  medium: 'severity-medium',
  low: 'severity-low',
}

const SEVERITY_LABEL: Record<Hazard['severity'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export default function Setup() {
  const navigate = useNavigate()
  const { apiKey, hazards, setHazards } = useApp()
  const { videoRef, canvasRef, isActive, error, start, stop, captureFrame } = useCamera()
  const [scanning, setScanning] = useState(false)

  const handleStartCamera = async () => {
    if (isActive) { stop(); return }
    await start()
  }

  const handleScan = async () => {
    const key = (import.meta as any).env?.VITE_GEMINI_API_KEY ?? apiKey
    if (!key || typeof key !== 'string' || !key.trim()) {
      toast.error('Gemini API key is not configured.')
      return
    }
    const frame = captureFrame(0.85)
    if (!frame) { toast.error('Camera not active — start it first.'); return }
    setScanning(true)
    try {
      const result = await scanRoomForHazards(frame, key.trim())
      setHazards(result)
      if (result.length === 0) toast('No hazards detected. Try a different angle.', { icon: '🔍' })
      else toast.success(`Found ${result.length} potential hazard${result.length !== 1 ? 's' : ''}!`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Scan failed.')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="relative z-10 min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          step="Step 01"
          title="Room Setup"
          subtitle="Point the camera at the room. Gemini will detect potential hazards."
          backTo="/"
          rightSlot={
            hazards.length > 0 && (
              <button onClick={() => navigate('/actions')} className="btn-ocean text-xs">
                Next <ArrowRight size={13} />
              </button>
            )
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera panel */}
          <motion.div
            className="glass-card p-5 flex flex-col gap-4"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          >
            {/* Video feed */}
            <div className="relative rounded-xl overflow-hidden bg-ocean-950"
              style={{ aspectRatio: '16/9' }}>
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} className="hidden" />

              {/* Overlay when inactive */}
              {!isActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Camera size={36} color="rgba(100,180,220,0.3)" strokeWidth={1.2} />
                  <p className="text-xs text-ocean-300 opacity-50">
                    {error ?? 'Camera not started'}
                  </p>
                </div>
              )}

              {/* Scan animation */}
              {scanning && (
                <div className="absolute inset-0">
                  <div className="absolute left-0 right-0 h-0.5 animate-scanLine"
                    style={{ background: 'linear-gradient(90deg,transparent,rgba(74,159,197,0.9),transparent)' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="glass-card px-4 py-2 flex items-center gap-2 text-sm text-ocean-200">
                      <ScanLine size={15} className="animate-pulse" />
                      Analysing with Gemini…
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Camera controls */}
            <div className="flex gap-3">
              <button onClick={handleStartCamera} className="btn-ocean flex-1">
                <Camera size={15} />
                {isActive ? 'Stop Camera' : 'Start Camera'}
              </button>
              <button onClick={handleScan} disabled={!isActive || scanning} className="btn-outline flex-1">
                <ScanLine size={15} />
                {scanning ? 'Scanning…' : 'Scan Room'}
              </button>
            </div>

          </motion.div>

          {/* Results panel */}
          <motion.div
            className="glass-card p-5 flex flex-col gap-4"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-ocean-100 font-medium text-sm tracking-wide">Detected Hazards</h3>
              <span className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(100,170,210,0.1)', color: 'rgba(160,210,235,0.7)', border: '1px solid rgba(100,170,210,0.15)' }}>
                {hazards.length} found
              </span>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 min-h-[280px] max-h-[440px]">
              <AnimatePresence>
                {hazards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                    <ShieldCheck size={38} color="rgba(100,180,220,0.18)" strokeWidth={1.2} />
                    <p className="text-sm text-ocean-300 opacity-40 text-center leading-relaxed">
                      Scan the room to detect<br />potential hazards
                    </p>
                  </div>
                ) : (
                  hazards.map((h, i) => (
                    <motion.div
                      key={h.id}
                      className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border text-sm ${SEVERITY_CLASS[h.severity]}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" strokeWidth={1.8} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-medium truncate">{h.name}</span>
                          <span className="text-xs opacity-70 flex-shrink-0">{SEVERITY_LABEL[h.severity]}</span>
                        </div>
                        <p className="opacity-70 text-xs leading-relaxed">{h.description}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {hazards.length > 0 && (
              <button onClick={() => navigate('/actions')} className="btn-ocean w-full justify-center">
                Continue to Dangerous Actions <ArrowRight size={14} />
              </button>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
