import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import Alerts from './Alerts'
import Settings from './Settings'

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

type SignalMessage =
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
  | { type: 'error'; message: string }

function App() {
  const [activePage, setActivePage] = useState<'monitor' | 'alerts' | 'settings'>('monitor')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const signalingSocketRef = useRef<WebSocket | null>(null)

  const [isStarting, setIsStarting] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('Idle')
  const [cameraStatus, setCameraStatus] = useState('Unknown')
  const [errorMessage, setErrorMessage] = useState('')

  const signalingUrl = useMemo(() => getSignalingUrl(), [])

  const stopFeed = useCallback(() => {
    signalingSocketRef.current?.close()
    signalingSocketRef.current = null

    peerConnectionRef.current?.close()
    peerConnectionRef.current = null

    if (videoRef.current?.srcObject) {
      const mediaStream = videoRef.current.srcObject as MediaStream
      mediaStream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }

    setIsStarting(false)
    setIsStreaming(false)
    setConnectionStatus('Stopped')
  }, [])

  const startFeed = useCallback(async () => {
    if (isStarting || isStreaming) {
      return
    }

    setIsStarting(true)
    setErrorMessage('')
    setConnectionStatus('Connecting to signaling server…')

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    peerConnectionRef.current = peerConnection

    peerConnection.addTransceiver('video', { direction: 'recvonly' })

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream
      }
      setIsStreaming(true)
      setIsStarting(false)
      setConnectionStatus('Live')
    }

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState

      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        setIsStreaming(false)
      }

      if (state === 'failed') {
        setErrorMessage('RTC connection failed.')
      }

      setConnectionStatus(`RTC: ${state}`)
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const websocket = new WebSocket(signalingUrl)
        signalingSocketRef.current = websocket

        websocket.onopen = () => {
          setConnectionStatus('Signaling connected')
          resolve()
        }

        websocket.onerror = () => {
          reject(new Error('Unable to connect to the signaling server.'))
        }

        websocket.onclose = () => {
          signalingSocketRef.current = null
          setIsStarting(false)
          setIsStreaming(false)
          setConnectionStatus('Signaling disconnected')
        }

        websocket.onmessage = async (event) => {
          const message = JSON.parse(event.data) as SignalMessage

          if (message.type === 'camera_connected') {
            setCameraStatus('Connected')
            return
          }

          if (message.type === 'camera_disconnected') {
            setCameraStatus('Disconnected')
            setIsStreaming(false)
            setConnectionStatus('Waiting for camera')
            return
          }

          if (message.type === 'camera_status') {
            setCameraStatus(message.status)
            return
          }

          if (message.type === 'frontend_connected') {
            return
          }

          if (message.type === 'answer') {
            await peerConnection.setRemoteDescription({
              type: 'answer',
              sdp: message.sdp,
            })
            return
          }

          if (message.type === 'ice-candidate' && message.candidate?.candidate) {
            await peerConnection.addIceCandidate(message.candidate)
            return
          }

          if (message.type === 'error') {
            setErrorMessage(message.message)
            if (message.message === 'camera_not_connected') {
              setCameraStatus('Disconnected')
            }
          }
        }
      })

      peerConnection.onicecandidate = (event) => {
        const websocket = signalingSocketRef.current
        if (!websocket || websocket.readyState !== WebSocket.OPEN || !event.candidate) {
          return
        }

        websocket.send(
          JSON.stringify({
            type: 'ice-candidate',
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
          }),
        )
      }

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      const websocket = signalingSocketRef.current
      if (!websocket || websocket.readyState !== WebSocket.OPEN || !peerConnection.localDescription) {
        throw new Error('Signaling socket is not ready.')
      }

      websocket.send(JSON.stringify({ type: 'start_video' }))
      websocket.send(
        JSON.stringify({
          type: 'offer',
          sdp: peerConnection.localDescription.sdp,
        }),
      )

      setConnectionStatus('Waiting for camera answer…')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start the feed.'
      setErrorMessage(message)
      stopFeed()
    }
  }, [isStarting, isStreaming, signalingUrl, stopFeed])

  useEffect(() => {
    return () => {
      stopFeed()
    }
  }, [stopFeed])

  return (
    <div className="root-layout">
      <nav className="tab-nav">
        <span className="tab-nav-brand">Cardle Guard</span>
        <div className="tab-nav-links">
          <button
            className={`tab-btn ${activePage === 'monitor' ? 'tab-btn-active' : ''}`}
            onClick={() => setActivePage('monitor')}
            type="button"
          >
            📷 Monitor
          </button>
          <button
            className={`tab-btn ${activePage === 'alerts' ? 'tab-btn-active' : ''}`}
            onClick={() => setActivePage('alerts')}
            type="button"
          >
            🔔 Alerts
          </button>
          <button
            className={`tab-btn ${activePage === 'settings' ? 'tab-btn-active' : ''}`}
            onClick={() => setActivePage('settings')}
            type="button"
          >
            ⚙️ Settings
          </button>
        </div>
      </nav>

      {activePage === 'alerts' ? (
        <Alerts />
      ) : activePage === 'settings' ? (
        <Settings />
      ) : (
    <main className="app-shell">
      <section className="hero-panel">
        <span className="eyebrow">Cardle Guard</span>
        <h1>Live camera monitor</h1>
        <p className="subtitle">
          Connect to the backend signaling server and view the Raspberry Pi camera feed in real time.
        </p>

        <div className="actions-row">
          <button
            className="primary-button"
            onClick={isStreaming || isStarting ? stopFeed : startFeed}
            type="button"
          >
            {isStreaming || isStarting ? 'Stop feed' : 'Start feed'}
          </button>
        </div>

        <div className="status-grid">
          <article className="status-card">
            <span className="status-label">RTC status</span>
            <strong>{connectionStatus}</strong>
          </article>
          <article className="status-card">
            <span className="status-label">Camera</span>
            <strong>{cameraStatus}</strong>
          </article>
          <article className="status-card">
            <span className="status-label">Signaling</span>
            <strong>{signalingUrl}</strong>
          </article>
        </div>

        {errorMessage ? <p className="error-banner">Error: {errorMessage}</p> : null}
      </section>

      <section className="viewer-panel">
        <div className="video-frame">
          <video ref={videoRef} autoPlay muted playsInline className="camera-feed" />
          {!isStreaming ? (
            <div className="video-placeholder">
              <p>{isStarting ? 'Starting camera feed…' : 'Feed is offline'}</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
      )}
    </div>
  )
}

export default App
