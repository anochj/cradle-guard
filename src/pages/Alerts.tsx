import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Smartphone, Volume2, Mail, MessageSquare, ArrowRight, Shield } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import type { AlertMethod } from '../types'

const METHODS: { value: AlertMethod; label: string; desc: string; Icon: React.ElementType }[] = [
  { value: 'push',  label: 'Push Notification', desc: 'Browser alert on your phone',   Icon: Smartphone },
  { value: 'sound', label: 'Sound Alarm',        desc: 'Audio alert through speakers',  Icon: Volume2 },
  { value: 'email', label: 'Email Alert',         desc: 'Send email to your address',    Icon: Mail },
  { value: 'sms',   label: 'SMS / Text',          desc: 'Text message to your phone',   Icon: MessageSquare },
]

export default function Alerts() {
  const navigate = useNavigate()
  const { alertSettings, updateAlertSettings, actions, setIsMonitoring } = useApp()

  const toggle = (method: AlertMethod) => {
    const current = alertSettings.methods
    updateAlertSettings({
      methods: current.includes(method)
        ? current.filter(m => m !== method)
        : [...current, method],
    })
  }

  const handleActivate = async () => {
    if (alertSettings.methods.length === 0) {
      toast.error('Select at least one notification method.')
      return
    }
    if (actions.filter(a => a.enabled).length === 0) {
      toast.error('Enable at least one dangerous action to watch for.')
      return
    }
    // Request browser notification permission if needed
    if (alertSettings.methods.includes('push') && 'Notification' in window) {
      await Notification.requestPermission()
    }
    setIsMonitoring(true)
    navigate('/monitor')
  }

  return (
    <div className="relative z-10 min-h-screen py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <PageHeader
          step="Step 03"
          title="Alert Settings"
          subtitle="Choose how you'll be notified when a danger is detected."
          backTo="/actions"
        />

        <div className="flex flex-col gap-6">
          {/* Method selector */}
          <motion.div
            className="glass-card p-5"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          >
            <h3 className="text-ocean-100 text-sm font-medium mb-4 tracking-wide">Notification Method</h3>
            <div className="grid grid-cols-2 gap-3">
              {METHODS.map(({ value, label, desc, Icon }) => {
                const active = alertSettings.methods.includes(value)
                return (
                  <button
                    key={value}
                    onClick={() => toggle(value)}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all duration-200"
                    style={{
                      background: active
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(56,189,248,0.35))'
                        : 'rgba(59,130,246,0.10)',
                      border: `1px solid ${
                        active ? 'rgba(129,140,248,0.6)' : 'rgba(129,140,248,0.35)'
                      }`,
                    }}
                  >
                    <Icon
                      size={22}
                      color={active ? '#1d4ed8' : 'rgba(59,130,246,0.75)'}
                      strokeWidth={1.6}
                    />
                    <div>
                      <p className={`text-sm font-medium ${active ? 'text-ocean-100' : 'text-ocean-300 opacity-60'}`}>{label}</p>
                      <p className="text-xs opacity-50 text-ocean-200 mt-0.5">{desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* Contact details */}
          {(alertSettings.methods.includes('email') || alertSettings.methods.includes('sms')) && (
            <motion.div
              className="glass-card p-5"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-ocean-100 text-sm font-medium mb-4 tracking-wide">Contact Details</h3>
              <div className="flex flex-col gap-3">
                {alertSettings.methods.includes('email') && (
                  <div>
                    <label className="text-xs text-ocean-300 opacity-55 mb-1.5 block">Email address</label>
                    <input className="input-ocean" type="email" placeholder="you@example.com"
                      value={alertSettings.email}
                      onChange={e => updateAlertSettings({ email: e.target.value })} />
                  </div>
                )}
                {alertSettings.methods.includes('sms') && (
                  <div>
                    <label className="text-xs text-ocean-300 opacity-55 mb-1.5 block">Phone number</label>
                    <input className="input-ocean" type="tel" placeholder="+1 (555) 000-0000"
                      value={alertSettings.phone}
                      onChange={e => updateAlertSettings({ phone: e.target.value })} />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Sound volume */}
          {alertSettings.methods.includes('sound') && (
            <motion.div
              className="glass-card p-5"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-ocean-100 text-sm font-medium tracking-wide">Alarm Volume</h3>
                <span className="text-ocean-200 text-sm opacity-70">{alertSettings.soundVolume}%</span>
              </div>
              <input type="range" min={0} max={100} step={1}
                value={alertSettings.soundVolume}
                onChange={e => updateAlertSettings({ soundVolume: Number(e.target.value) })}
                className="w-full accent-ocean-300" />
            </motion.div>
          )}

          {/* Sensitivity */}
          <motion.div
            className="glass-card p-5"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          >
            <h3 className="text-ocean-100 text-sm font-medium mb-4 tracking-wide">Detection Sensitivity</h3>
            <div className="flex gap-3">
              {(['low', 'medium', 'high'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => updateAlertSettings({ sensitivity: level })}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all duration-200"
                  style={{
                    background:
                      alertSettings.sensitivity === level
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(56,189,248,0.35))'
                        : 'rgba(59,130,246,0.08)',
                    border: `1px solid ${
                      alertSettings.sensitivity === level
                        ? 'rgba(129,140,248,0.6)'
                        : 'rgba(129,140,248,0.35)'
                    }`,
                    color:
                      alertSettings.sensitivity === level ? '#1e293b' : 'rgba(30,64,175,0.75)',
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-xs text-ocean-300 opacity-40 mt-3 leading-relaxed">
              {alertSettings.sensitivity === 'low' && 'Only alerts on clearly present, definite dangers.'}
              {alertSettings.sensitivity === 'medium' && 'Balanced — alerts when danger seems likely.'}
              {alertSettings.sensitivity === 'high' && 'Alerts on any possible risk, including minor ones.'}
            </p>
          </motion.div>

          {/* Activate button */}
          <motion.button
            onClick={handleActivate}
            className="w-full py-4 rounded-2xl font-medium text-base tracking-wide transition-all duration-200 flex items-center justify-center gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(26,84,128,0.6), rgba(42,114,168,0.5))',
              border: '1px solid rgba(74,159,197,0.4)',
              color: '#b8dff0',
            }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.01, borderColor: 'rgba(74,159,197,0.7)' }}
            whileTap={{ scale: 0.99 }}
          >
            <Shield size={18} />
            Activate Monitor
            <ArrowRight size={16} />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
