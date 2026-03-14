import { createContext, useContext, useState, ReactNode } from 'react'
import type { Hazard, DangerousAction, AlertSettings, EventLog } from '../types'

interface AppContextType {
  apiKey: string
  setApiKey: (k: string) => void
  hazards: Hazard[]
  setHazards: (h: Hazard[]) => void
  actions: DangerousAction[]
  setActions: (a: DangerousAction[]) => void
  toggleAction: (id: string) => void
  addCustomAction: (text: string) => void
  removeAction: (id: string) => void
  alertSettings: AlertSettings
  updateAlertSettings: (s: Partial<AlertSettings>) => void
  isMonitoring: boolean
  setIsMonitoring: (v: boolean) => void
  eventLog: EventLog[]
  addEvent: (msg: string, sev: EventLog['severity']) => void
  clearEvents: () => void
}

const defaultAlert: AlertSettings = {
  methods: [],
  email: '',
  phone: '',
  soundVolume: 70,
  sensitivity: 'medium',
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState('')
  const [hazards, setHazards] = useState<Hazard[]>([])
  const [actions, setActions] = useState<DangerousAction[]>([])
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(defaultAlert)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [eventLog, setEventLog] = useState<EventLog[]>([])

  const toggleAction = (id: string) =>
    setActions(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a))

  const addCustomAction = (text: string) =>
    setActions(prev => [...prev, {
      id: crypto.randomUUID(), text, source: 'custom', enabled: true
    }])

  const removeAction = (id: string) =>
    setActions(prev => prev.filter(a => a.id !== id))

  const updateAlertSettings = (s: Partial<AlertSettings>) =>
    setAlertSettings(prev => ({ ...prev, ...s }))

  const addEvent = (message: string, severity: EventLog['severity']) =>
    setEventLog(prev => [
      { id: crypto.randomUUID(), timestamp: new Date(), message, severity },
      ...prev.slice(0, 49),
    ])

  const clearEvents = () => setEventLog([])

  return (
    <AppContext.Provider value={{
      apiKey, setApiKey,
      hazards, setHazards,
      actions, setActions, toggleAction, addCustomAction, removeAction,
      alertSettings, updateAlertSettings,
      isMonitoring, setIsMonitoring,
      eventLog, addEvent, clearEvents,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
