import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, SlidersHorizontal } from 'lucide-react'

const STEPS = [
  {
    num: '01',
    label: 'Live View',
    Icon: Camera,
    to: '/live',
    delay: 0.25,
  },
  {
    num: '02',
    label: 'Settings',
    Icon: SlidersHorizontal,
    to: '/settings',
    delay: 0.4,
  },
]

// Slight random float paths per button (x, y in px) — each drifts in a small area
const FLOAT_PATHS = [
  { x: [0, 4, -3, 0], y: [0, -4, 2, 0], duration: 2.8, delay: 0 },
  { x: [0, -5, 2, 0], y: [0, 3, -4, 0], duration: 3.2, delay: 0.4 },
]

export default function Home() {
  const navigate = useNavigate()
  const canClickStep = () => true
  const nextStepIndex = 0

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
    </div>
  )
}
