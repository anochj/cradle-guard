import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useCamera } from '../hooks/useCamera'

interface Props {
  open: boolean
  onClose: () => void
}

export default function CameraModal({ open, onClose }: Props) {
  const { videoRef, canvasRef, isActive, error, start, stop } = useCamera()

  useEffect(() => {
    if (open) start()
    else stop()
    return () => { stop() }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(4,8,18,0.85)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div
              className="relative w-full max-w-3xl pointer-events-auto rounded-2xl overflow-hidden"
              style={{
                background: '#060e1e',
                border: '1px solid rgba(100,170,210,0.18)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-10 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150"
                style={{ background: 'rgba(10,22,40,0.8)', border: '1px solid rgba(100,170,210,0.2)', color: 'rgba(160,210,235,0.7)' }}
              >
                <X size={14} />
              </button>

              {/* Live badge */}
              {isActive && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                  style={{ background: 'rgba(15,109,86,0.55)', border: '1px solid rgba(29,158,117,0.35)', color: '#5DCAA5' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulseDot inline-block" />
                  Live
                </div>
              )}

              {/* Video — fills the card, no padding */}
              <div className="relative" style={{ aspectRatio: '16/9', background: '#020609' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Placeholder when camera not yet active or errored */}
                {!isActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <rect x="3" y="8" width="28" height="20" rx="4" stroke="rgba(100,180,220,0.25)" strokeWidth="1.4" />
                      <circle cx="17" cy="18" r="5" stroke="rgba(100,180,220,0.25)" strokeWidth="1.3" />
                      <path d="M31 13l6 3v8l-6 3V13z" stroke="rgba(100,180,220,0.25)" strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                    <p className="text-xs text-ocean-300 opacity-40">
                      {error ?? 'Starting camera…'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}