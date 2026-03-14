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

export type AlertMethod = 'website' | 'sound'

export type SoundDelivery = 'both' | 'website' | 'speaker'

export interface AlertSettings {
  methods: AlertMethod[]
  soundVolume: number
  sensitivity: 'low' | 'medium' | 'high'
  soundDelivery: SoundDelivery
}

export interface EventLog {
  id: string
  timestamp: Date
  message: string
  severity: 'info' | 'warning' | 'danger'
}
