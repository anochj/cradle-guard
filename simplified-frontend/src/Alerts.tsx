import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const backendHttpUrl = import.meta.env.VITE_BACKEND_URL?.trim()

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

// ── Types ────────────────────────────────────────────────────────────────────

interface ObjectRelationship {
  object_a: string
  object_b: string
  unsafe_distance: number
}

interface SituationAnalysisResult {
  analysis: string
  immediately_alert: boolean
  relationships: ObjectRelationship[]
}

type AlertEntry =
  | {
      kind: 'immediate_alert'
      id: number
      ts: Date
      signal: string
      descriptor: string
      metadata: Record<string, unknown>
    }
  | {
      kind: 'long_term_analysis'
      id: number
      ts: Date
      data: SituationAnalysisResult | null
    }

type IncomingMessage =
  | { type: 'immediate_alert'; signal: string; descriptor: string; metadata: Record<string, unknown> }
  | { type: 'long_term_context_analysis'; data: SituationAnalysisResult | null }
  | { type: 'camera_connected' | 'camera_disconnected' | 'frontend_connected' }
  | { type: 'camera_status'; status: string }
  | { type: 'yolo_result'; data: unknown }
  | { type: 'error'; message: string }

// ── Helpers ──────────────────────────────────────────────────────────────────

const SIGNAL_META: Record<string, { label: string; color: string }> = {
  proximity_alert:   { label: 'Proximity Alert',   color: '#f59e0b' },
  immediate_threat:  { label: 'Immediate Threat',  color: '#ef4444' },
  processing_error:  { label: 'Processing Error',  color: '#6b7280' },
}

function signalMeta(signal: string) {
  return SIGNAL_META[signal] ?? { label: signal, color: '#8b5cf6' }
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

let idCounter = 0
const nextId = () => ++idCounter

// ── Component ─────────────────────────────────────────────────────────────────

export default function Alerts() {
  const socketRef = useRef<WebSocket | null>(null)

  const [connected, setConnected] = useState(false)
  const [cameraConnected, setCameraConnected] = useState(false)
  const [alerts, setAlerts] = useState<AlertEntry[]>([])

  const signalingUrl = useMemo(() => getSignalingUrl(), [])

  const pushAlert = useCallback((entry: AlertEntry) => {
    setAlerts((prev) => [entry, ...prev].slice(0, 200))
  }, [])

  const connect = useCallback(() => {
    if (socketRef.current) return

    const ws = new WebSocket(signalingUrl)
    socketRef.current = ws

    ws.onopen = () => setConnected(true)

    ws.onclose = () => {
      socketRef.current = null
      setConnected(false)
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (event) => {
      let msg: IncomingMessage
      try {
        msg = JSON.parse(event.data as string) as IncomingMessage
      } catch {
        return
      }

      if (msg.type === 'camera_connected') {
        setCameraConnected(true)
        return
      }

      if (msg.type === 'camera_disconnected') {
        setCameraConnected(false)
        return
      }

      if (msg.type === 'immediate_alert') {
        pushAlert({
          kind: 'immediate_alert',
          id: nextId(),
          ts: new Date(),
          signal: msg.signal,
          descriptor: msg.descriptor,
          metadata: msg.metadata,
        })
        return
      }

      if (msg.type === 'long_term_context_analysis') {
        pushAlert({
          kind: 'long_term_analysis',
          id: nextId(),
          ts: new Date(),
          data: msg.data,
        })
      }
    }
  }, [signalingUrl, pushAlert])

  const disconnect = useCallback(() => {
    socketRef.current?.close()
    socketRef.current = null
    setConnected(false)
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return (
    <main className="alerts-shell">
      {/* ── Header ── */}
      <header className="alerts-header">
        <div className="alerts-title-row">
          <h1>Alerts</h1>
          <div className="alerts-badges">
            <span className={`badge ${connected ? 'badge-green' : 'badge-red'}`}>
              {connected ? 'Signaling ✓' : 'Signaling ✗'}
            </span>
            <span className={`badge ${cameraConnected ? 'badge-green' : 'badge-amber'}`}>
              {cameraConnected ? 'Camera ✓' : 'Camera offline'}
            </span>
          </div>
        </div>
        <p className="alerts-subtitle">
          Real-time safety events from the Cardle Guard backend.
        </p>

        <div className="alerts-toolbar">
          <button
            className="secondary-button"
            onClick={connected ? disconnect : connect}
            type="button"
          >
            {connected ? 'Disconnect' : 'Reconnect'}
          </button>
          <button
            className="secondary-button danger"
            onClick={() => setAlerts([])}
            type="button"
            disabled={alerts.length === 0}
          >
            Clear all
          </button>
          <span className="alert-count">{alerts.length} event{alerts.length !== 1 ? 's' : ''}</span>
        </div>
      </header>

      {/* ── Feed ── */}
      <section className="alerts-feed">
        {alerts.length === 0 ? (
          <div className="alerts-empty">
            <p>{connected ? '⏳ Waiting for alerts…' : '⚠️ Not connected to backend.'}</p>
          </div>
        ) : (
          alerts.map((alert) =>
            alert.kind === 'immediate_alert' ? (
              <ImmediateAlertCard key={alert.id} alert={alert} />
            ) : (
              <LongTermCard key={alert.id} alert={alert} />
            ),
          )
        )}
      </section>
    </main>
  )
}

// ── Sub-cards ─────────────────────────────────────────────────────────────────

function ImmediateAlertCard({ alert }: { alert: Extract<AlertEntry, { kind: 'immediate_alert' }> }) {
  const [open, setOpen] = useState(false)
  const { label, color } = signalMeta(alert.signal)
  const relationships = alert.metadata?.unsafe_relationships as ObjectRelationship[] | undefined

  return (
    <article className="alert-card" style={{ borderLeftColor: color }}>
      <div className="alert-card-header" onClick={() => setOpen((v) => !v)}>
        <div className="alert-card-left">
          <span className="alert-signal-badge" style={{ background: color }}>
            {label}
          </span>
          <span className="alert-descriptor">{alert.descriptor}</span>
        </div>
        <div className="alert-card-right">
          <time className="alert-time">{formatTime(alert.ts)}</time>
          <span className="alert-chevron">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="alert-card-body">
          {relationships && relationships.length > 0 ? (
            <table className="rel-table">
              <thead>
                <tr>
                  <th>Object A</th>
                  <th>Object B</th>
                  <th>Unsafe distance (px)</th>
                </tr>
              </thead>
              <tbody>
                {relationships.map((r, i) => (
                  <tr key={i}>
                    <td>{r.object_a}</td>
                    <td>{r.object_b}</td>
                    <td>{r.unsafe_distance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre className="alert-metadata">{JSON.stringify(alert.metadata, null, 2)}</pre>
          )}
        </div>
      )}
    </article>
  )
}

function LongTermCard({ alert }: { alert: Extract<AlertEntry, { kind: 'long_term_analysis' }> }) {
  const [open, setOpen] = useState(false)
  const { data } = alert
  const urgent = data?.immediately_alert ?? false

  return (
    <article
      className="alert-card"
      style={{ borderLeftColor: urgent ? '#ef4444' : '#3b82f6' }}
    >
      <div className="alert-card-header" onClick={() => setOpen((v) => !v)}>
        <div className="alert-card-left">
          <span
            className="alert-signal-badge"
            style={{ background: urgent ? '#ef4444' : '#3b82f6' }}
          >
            {urgent ? '🔴 AI Analysis — Urgent' : '🔵 AI Analysis'}
          </span>
          <span className="alert-descriptor">
            {data ? data.analysis : 'No analysis data'}
          </span>
        </div>
        <div className="alert-card-right">
          <time className="alert-time">{formatTime(alert.ts)}</time>
          <span className="alert-chevron">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && data && (
        <div className="alert-card-body">
          {data.relationships.length > 0 && (
            <>
              <p className="rel-heading">Detected relationships</p>
              <table className="rel-table">
                <thead>
                  <tr>
                    <th>Object A</th>
                    <th>Object B</th>
                    <th>Unsafe distance (px)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.relationships.map((r, i) => (
                    <tr key={i}>
                      <td>{r.object_a}</td>
                      <td>{r.object_b}</td>
                      <td>{r.unsafe_distance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </article>
  )
}
