import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { signalingClient } from '../lib/signaling'

const SIGNAL_META: Record<string, string> = {
  proximity_alert: 'Proximity Alert',
  immediate_threat: 'Immediate Threat',
  processing_error: 'Processing Error',
}

export function useBackendAlerts() {
  const lastToastAtRef = useRef(0)

  useEffect(() => {
    signalingClient.connect()

    const unsubscribe = signalingClient.subscribe((message) => {
      if (message.type === 'immediate_alert') {
        const now = Date.now()
        if (now - lastToastAtRef.current < 900) {
          return
        }

        lastToastAtRef.current = now
        const label = SIGNAL_META[message.signal] ?? message.signal
        toast.error(`${label}: ${message.descriptor}`)
      }

      if (message.type === 'long_term_context_analysis' && message.data?.immediately_alert) {
        toast.error(`AI urgent analysis: ${message.data.analysis}`)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])
}
