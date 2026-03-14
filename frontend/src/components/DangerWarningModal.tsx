import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

export default function DangerWarningModal({ open, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center pb-32 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ background: 'rgba(4,8,18,0.82)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              className="relative rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden pointer-events-auto"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'linear-gradient(145deg, rgba(254,242,242,0.98), rgba(254,226,226,0.95))',
                border: '2px solid rgba(248,113,113,0.5)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(248,113,113,0.15)',
              }}
            >
              <div className="p-6 pt-7">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="flex items-center justify-center w-12 h-12 rounded-full shrink-0"
                    style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}
                  >
                    <AlertTriangle className="w-7 h-7" style={{ color: '#b91c1c' }} strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight" style={{ color: '#991b1b' }}>
                      Baby danger detected
                    </h2>
                    <p className="text-sm opacity-80" style={{ color: '#b91c1c' }}>
                      Test warning
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: '#7f1d1d', opacity: 0.9 }}>
                  This is a test alert. Real alerts will appear here when the monitor detects a dangerous situation.
                </p>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(185,28,28,0.2))',
                    border: '1px solid rgba(185,28,28,0.4)',
                    color: '#991b1b',
                  }}
                >
                  Dismiss
                </button>
              </div>
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: '#b91c1c' }}
                aria-label="Close"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
