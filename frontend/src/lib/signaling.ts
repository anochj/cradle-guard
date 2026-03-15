const backendHttpUrl = ((import.meta as any).env?.VITE_BACKEND_URL ?? (import.meta as any).env?.VITE_API_URL)?.trim()

const getSignalingUrl = () => {
  if (backendHttpUrl) {
    const normalizedUrl = backendHttpUrl.endsWith('/')
      ? backendHttpUrl.slice(0, -1)
      : backendHttpUrl

    if (normalizedUrl.startsWith('https://')) {
      return normalizedUrl.replace('https://', 'wss://') + '/ws/signaling/frontend'
    }

    if (normalizedUrl.startsWith('http://')) {
      return normalizedUrl.replace('http://', 'ws://') + '/ws/signaling/frontend'
    }
  }

  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const hostname = window.location.hostname || 'localhost'
  return `${wsProtocol}://${hostname}:8000/ws/signaling/frontend`
}

export type ObjectRelationship = {
  object_a: string
  object_b: string
  unsafe_distance: number
}

export type SituationAnalysisResult = {
  analysis: string
  immediately_alert: boolean
  relationships: ObjectRelationship[]
}

export type SignalMessage =
  | { type: 'answer'; sdp: string }
  | {
      type: 'ice-candidate'
      candidate?: {
        candidate: string
        sdpMid?: string | null
        sdpMLineIndex?: number | null
      }
    }
  | { type: 'camera_status'; status: string }
  | { type: 'camera_connected' | 'camera_disconnected' | 'frontend_connected' }
  | { type: 'immediate_alert'; signal: string; descriptor: string; metadata: Record<string, unknown> }
  | { type: 'long_term_context_analysis'; data: SituationAnalysisResult | null }
  | { type: 'error'; message: string }

type Subscriber = (message: SignalMessage) => void

class SignalingClient {
  private ws: WebSocket | null = null
  private subscribers = new Set<Subscriber>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectEnabled = true

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    const socket = new WebSocket(getSignalingUrl())
    this.ws = socket

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as SignalMessage
        this.subscribers.forEach((subscriber) => subscriber(message))
      } catch {
        // ignore non-JSON messages
      }
    }

    socket.onclose = () => {
      if (this.ws === socket) {
        this.ws = null
      }

      if (this.reconnectEnabled) {
        this.reconnectTimer = setTimeout(() => this.connect(), 2500)
      }
    }

    socket.onerror = () => {
      socket.close()
    }
  }

  async ensureOpen(timeoutMs = 7000): Promise<void> {
    this.connect()

    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      const started = Date.now()

      const check = () => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          resolve()
          return
        }

        if (Date.now() - started > timeoutMs) {
          reject(new Error('Unable to connect to signaling server.'))
          return
        }

        setTimeout(check, 100)
      }

      check()
    })
  }

  send(payload: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false
    }

    this.ws.send(JSON.stringify(payload))
    return true
  }

  subscribe(subscriber: Subscriber) {
    this.subscribers.add(subscriber)
    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  destroy() {
    this.reconnectEnabled = false

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.ws?.close()
    this.ws = null
  }
}

export const signalingClient = new SignalingClient()
