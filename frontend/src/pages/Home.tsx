import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, AlertTriangle, Bell, TestTube } from 'lucide-react'
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

// Slight random float paths per button (x, y in px) — each drifts in a small area
const FLOAT_PATHS = [
  { x: [0, 4, -3, 0], y: [0, -4, 2, 0], duration: 2.8, delay: 0 },
  { x: [0, -5, 2, 0], y: [0, 3, -4, 0], duration: 3.2, delay: 0.4 },
  { x: [0, -2, 5, 0], y: [0, -3, 4, 0], duration: 2.5, delay: 0.8 },
]

export default function Home() {
  const navigate = useNavigate()
  const { hazards, actions, setWarningModalOpen, setLastWarningReason } = useApp()
  const step1Complete = hazards.length > 0
  const step2Complete = actions.length > 0
  const canClickStep = (i: number) => {
    if (i === 0) return true
    if (i === 1) return step1Complete
    return step2Complete
  }
  const nextStepIndex = !step1Complete ? 0 : !step2Complete ? 1 : 2

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
          className="mx-auto mb-5 opacity-95 w-20 h-20 object-contain"
        />
        <h1 className="font-sans text-5xl font-extralight tracking-wide text-ocean-900">Cradle Guard</h1>
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
              <motion.button
                onClick={() => canClickStep(i) && navigate(step.to)}
                disabled={!canClickStep(i)}
                className={`home-step-button w-full flex items-center justify-center disabled:cursor-not-allowed disabled:pointer-events-none ${canClickStep(i) ? 'step-available' : ''} ${i === nextStepIndex ? 'step-next' : ''}`}
                style={{ aspectRatio: '1.7/1' }}
                animate={{ x: FLOAT_PATHS[i].x, y: FLOAT_PATHS[i].y }}
                transition={{
                  x: { duration: FLOAT_PATHS[i].duration, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0 },
                  y: { duration: FLOAT_PATHS[i].duration, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0, delay: FLOAT_PATHS[i].delay },
                }}
                whileHover={canClickStep(i) ? { scale: 1.08 } : {}}
                whileTap={canClickStep(i) ? { scale: 0.96 } : {}}
              >
                <step.Icon size={26} color="#0f172a" strokeWidth={1.4} />
              </motion.button>
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
        onClick={() => { setLastWarningReason(null); setWarningModalOpen(true) }}
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

    </div>
  )
}
