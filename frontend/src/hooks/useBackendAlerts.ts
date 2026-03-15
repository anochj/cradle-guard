import { useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'

// FIXED: Pointing to the new Client Door
const getWsUrl = (): string => {
  const base = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000'
  const wsBase = base.replace(/^http/, 'ws')
  return `${wsBase}/ws/client` // <-- Updated from /ws to /ws/client
}

// FIXED: Updated to match your new multi-threaded backend schema
interface BackendAlertMessage {
  type: 'yolo_alert' | 'yolo_safe' | 'gemini_update'
  status: 'SAFE' | 'HAZARD'
  reason?: string
  pipeline_used?: string
  yolo_boxes?: any[]
  live_frame?: string
  timestamp?: string
}

export function useBackendAlerts() {
  const { setWarningModalOpen, setLastWarningReason } = useApp()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const connect = () => {
      const url = getWsUrl()
      try {
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onmessage = (event) => {
          try {
            const data: BackendAlertMessage = JSON.parse(event.data)
            
            // FIXED: We now just check if the status is HAZARD, regardless of which AI caught it!
            if (data.status === 'HAZARD') {
              setLastWarningReason(data.reason ?? 'Danger detected near baby.')
              setWarningModalOpen(true)
            }
          } catch {
            // ignore parse errors
          }
        }

        ws.onclose = () => {
          wsRef.current = null
          reconnectTimeoutRef.current = setTimeout(connect, 5000)
        }

        ws.onerror = () => {
          ws.close()
        }
      } catch {
        reconnectTimeoutRef.current = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [setWarningModalOpen, setLastWarningReason])
}