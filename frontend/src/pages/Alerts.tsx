import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Globe2, Volume2, ArrowRight, Shield } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import type { AlertMethod } from '../types'

const METHODS: { value: AlertMethod; label: string; desc: string; Icon: React.ElementType }[] = [
  { value: 'website', label: 'Website Notification', desc: 'Notification in this browser tab', Icon: Globe2 },
  { value: 'sound',   label: 'Sound Alarm',         desc: 'Audio alert through speakers',     Icon: Volume2 },
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
    if (alertSettings.methods.includes('website') && 'Notification' in window) {
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

          {/* Sound notification: both, website only, or speaker only */}
          <motion.div
            className="glass-card p-5"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          >
            <h3 className="text-ocean-100 text-sm font-medium mb-4 tracking-wide">Sound notification</h3>
            <p className="text-xs text-ocean-300 opacity-70 mb-3 leading-relaxed">
              Choose whether to hear the alarm on both website and speaker, or just one.
            </p>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: 'both' as const, label: 'Both', desc: 'Website notification + speaker alarm' },
                  { value: 'website' as const, label: 'Website only', desc: 'Notification in this tab only' },
                  { value: 'speaker' as const, label: 'Speaker only', desc: 'Audio through speakers only' },
                ]
              ).map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => updateAlertSettings({ soundDelivery: value })}
                  className="flex flex-col items-start gap-0.5 p-3 rounded-xl text-left transition-all duration-200 w-full"
                  style={{
                    background:
                      alertSettings.soundDelivery === value
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(56,189,248,0.35))'
                        : 'rgba(59,130,246,0.08)',
                    border: `1px solid ${
                      alertSettings.soundDelivery === value
                        ? 'rgba(129,140,248,0.6)'
                        : 'rgba(129,140,248,0.35)'
                    }`,
                    color:
                      alertSettings.soundDelivery === value ? '#1e293b' : 'rgba(30,64,175,0.75)',
                  }}
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs opacity-70">{desc}</span>
                </button>
              ))}
            </div>
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
