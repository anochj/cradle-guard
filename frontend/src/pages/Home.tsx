import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, AlertTriangle, Bell } from 'lucide-react'

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
    </div>
  )
}
