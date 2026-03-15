import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, StopCircle, RotateCcw, ArrowLeft, Settings } from 'lucide-react'
import { signalingClient, type SignalMessage } from '../lib/signaling'

export default function Monitor() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const [isStarting, setIsStarting] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('Idle')
  const [cameraStatus, setCameraStatus] = useState('Unknown')
  const [errorMessage, setErrorMessage] = useState('')

  const stopFeed = useCallback(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = null

    peerRef.current?.close()
    peerRef.current = null

    if (videoRef.current?.srcObject) {
      const mediaStream = videoRef.current.srcObject as MediaStream
      mediaStream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }

    setIsStarting(false)
    setIsStreaming(false)
    setConnectionStatus('Stopped')
  }, [])

  const handleSignal = useCallback(async (message: SignalMessage, peerConnection: RTCPeerConnection) => {
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
  }, [])

  const startFeed = useCallback(async () => {
    if (peerRef.current) {
      return
    }

    setIsStarting(true)
    setErrorMessage('')
    setConnectionStatus('Connecting to signaling server…')

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    peerRef.current = peerConnection
    peerConnection.addTransceiver('video', { direction: 'recvonly' })

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {
          // ignore autoplay browser restrictions
        })
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

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return
      }

      signalingClient.send({
        type: 'ice-candidate',
        candidate: {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        },
      })
    }

    try {
      await signalingClient.ensureOpen()

      unsubscribeRef.current = signalingClient.subscribe((message) => {
        handleSignal(message, peerConnection).catch((error) => {
          const message = error instanceof Error ? error.message : 'Unable to process signal message.'
          setErrorMessage(message)
        })
      })

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      signalingClient.send({ type: 'start_video' })
      signalingClient.send({
        type: 'offer',
        sdp: peerConnection.localDescription?.sdp,
      })

      setConnectionStatus('Waiting for camera answer…')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start the feed.'
      setErrorMessage(message)
      stopFeed()
    }
  }, [handleSignal, stopFeed])

  useEffect(() => {
    startFeed()
    return () => {
      stopFeed()
    }
  }, [startFeed, stopFeed])

  const stopAndReturnHome = () => {
    stopFeed()
    navigate('/')
  }

  return (
    <div className="relative z-10 min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-block w-2 h-2 rounded-full ${isStreaming ? 'bg-green-400 animate-pulseDot' : 'bg-yellow-300'}`} />
              <span className="text-xs tracking-widest uppercase text-green-400 opacity-80 font-light">Live View</span>
            </div>
            <h2 className="font-serif italic text-3xl text-ocean-100">Camera Monitor</h2>
            <p className="text-sm text-ocean-300 opacity-55 mt-0.5">
              Opening the camera feed automatically using WebRTC.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/settings')} className="btn-outline flex items-center gap-2">
              <Settings size={15} />
              Settings
            </button>

            <button onClick={stopAndReturnHome} className="btn-outline flex items-center gap-2">
              <ArrowLeft size={15} />
              Home
            </button>

            <button onClick={isStreaming || isStarting ? stopFeed : startFeed} className="btn-ocean flex items-center gap-2">
              <RotateCcw size={15} />
              {isStreaming || isStarting ? 'Restart Feed' : 'Start Feed'}
            </button>

            <button onClick={stopFeed} className="btn-outline flex items-center gap-2">
              <StopCircle size={15} />
              Stop
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 flex flex-col gap-4">
            <motion.div
              className="glass-card p-3 relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 }}
            >
              <div className="relative rounded-xl overflow-hidden bg-ocean-950" style={{ aspectRatio: '16/9' }}>
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />

                {!isStreaming ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <Camera size={36} color="rgba(100,180,220,0.3)" strokeWidth={1.2} />
                    <p className="text-xs text-ocean-300 opacity-50">
                      {isStarting ? 'Starting camera feed…' : 'Feed is offline'}
                    </p>
                  </div>
                ) : null}
              </div>
            </motion.div>

            {errorMessage ? (
              <motion.div
                className="glass-card p-4 text-sm"
                style={{ borderColor: 'rgba(220,80,80,0.35)', background: 'rgba(163,45,45,0.18)', color: '#f09595' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                Error: {errorMessage}
              </motion.div>
            ) : null}
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <motion.div
              className="glass-card p-4 flex flex-col gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 }}
            >
              <h3 className="text-ocean-100 text-sm font-medium">Connection Status</h3>

              <article className="rounded-xl px-3 py-2"
                style={{ background: 'rgba(10,26,46,0.5)', border: '1px solid rgba(100,170,210,0.1)' }}>
                <p className="text-xs text-ocean-300 opacity-50 mb-1">RTC</p>
                <p className="text-sm text-ocean-100">{connectionStatus}</p>
              </article>

              <article className="rounded-xl px-3 py-2"
                style={{ background: 'rgba(10,26,46,0.5)', border: '1px solid rgba(100,170,210,0.1)' }}>
                <p className="text-xs text-ocean-300 opacity-50 mb-1">Camera</p>
                <p className="text-sm text-ocean-100">{cameraStatus}</p>
              </article>

              <article className="rounded-xl px-3 py-2"
                style={{ background: 'rgba(10,26,46,0.5)', border: '1px solid rgba(100,170,210,0.1)' }}>
                <p className="text-xs text-ocean-300 opacity-50 mb-1">Streaming</p>
                <p className="text-sm text-ocean-100">{isStreaming ? 'Online' : isStarting ? 'Connecting…' : 'Offline'}</p>
              </article>
            </motion.div>

            <motion.button
              onClick={stopAndReturnHome}
              className="w-full py-4 rounded-2xl font-medium text-base tracking-wide transition-all duration-200 flex items-center justify-center gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(26,84,128,0.6), rgba(42,114,168,0.5))',
                border: '1px solid rgba(74,159,197,0.4)',
                color: '#b8dff0',
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              whileHover={{ scale: 1.01, borderColor: 'rgba(74,159,197,0.7)' }}
              whileTap={{ scale: 0.99 }}
            >
              <ArrowLeft size={16} />
              Back to Home
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
