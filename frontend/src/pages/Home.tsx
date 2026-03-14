import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, AlertTriangle, Bell, TestTube } from 'lucide-react'
import DangerWarningModal from '../components/DangerWarningModal'
import { useApp } from '../context/AppContext'

const STEPS = [
  {
    num: '01',
    label: 'Room Setup',
    Icon: Camera,
    to: '/setup',
    delay: 0.25,
  },
  {
    num: '02',
    label: 'Dangerous Actions',
    Icon: AlertTriangle,
    to: '/actions',
    delay: 0.4,
  },
  {
    num: '03',
    label: 'Alert Settings',
    Icon: Bell,
    to: '/alerts',
    delay: 0.55,
  },
]

export default function Home() {
  const navigate = useNavigate()
  const { warningModalOpen, setWarningModalOpen } = useApp()

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-8 pb-40">
      {/* Logo */}
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <img
          src="/cradleguard-logo.png"
          alt="Cradle Guard"
          className="mx-auto mb-5 opacity-95 w-32 h-32 object-contain"
        />
        <h1 className="font-serif italic text-5xl text-ocean-100 tracking-wide">Cradle Guard</h1>
        <p className="text-xs tracking-[0.2em] uppercase text-ocean-300 opacity-40 font-light mt-3">
          Baby Safety Monitor
        </p>
      </motion.div>

      {/* Steps row */}
      <div className="flex items-center gap-0 w-full max-w-3xl">
        {STEPS.map((step, i) => (
          <>
            <motion.div
              key={step.num}
              className="flex-1 flex flex-col items-center gap-4"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: step.delay }}
            >
              <p className="step-number-badge">Step {step.num}</p>
              <button
                onClick={() => navigate(step.to)}
                className="home-step-button w-full flex items-center justify-center"
                style={{ aspectRatio: '1.7/1' }}
              >
                <step.Icon size={26} color="#0f172a" strokeWidth={1.4} />
              </button>
              <p className="text-sm text-ocean-200 opacity-70 tracking-wide">{step.label}</p>
            </motion.div>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <motion.div
                key={`conn-${i}`}
                className="flex-shrink-0 w-8 pb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div
                  style={{
                    height: '1px',
                    background:
                      'linear-gradient(90deg, rgba(100,170,210,0.12), rgba(100,170,210,0.3), rgba(100,170,210,0.12))',
                  }}
                />
              </motion.div>
            )}
          </>
        ))}
      </div>

      {/* Test warning button — bottom right, above Live Feed */}
      <motion.button
        onClick={() => setWarningModalOpen(true)}
        className="fixed bottom-28 right-6 z-30 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200"
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6 }}
        style={{
          background: 'rgba(239,68,68,0.18)',
          border: '1px solid rgba(248,113,113,0.45)',
          color: '#b91c1c',
          backdropFilter: 'blur(12px)',
        }}
        whileHover={{
          background: 'rgba(239,68,68,0.28)',
          borderColor: 'rgba(248,113,113,0.6)',
        }}
        whileTap={{ scale: 0.98 }}
      >
        <TestTube size={14} strokeWidth={2} />
        Test warning
      </motion.button>

      <DangerWarningModal open={warningModalOpen} onClose={() => setWarningModalOpen(false)} />
    </div>
  )
}
