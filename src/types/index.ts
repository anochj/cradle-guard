export interface Hazard {
  id: string
  name: string
  severity: 'low' | 'medium' | 'high'
  description: string
}

export interface DangerousAction {
  id: string
  text: string
  source: 'generated' | 'custom'
  enabled: boolean
}

export type AlertMethod = 'push' | 'sound' | 'email' | 'sms'

export interface AlertSettings {
  methods: AlertMethod[]
  email: string
  phone: string
  soundVolume: number
  sensitivity: 'low' | 'medium' | 'high'
}

export interface EventLog {
  id: string
  timestamp: Date
  message: string
  severity: 'info' | 'warning' | 'danger'
}
