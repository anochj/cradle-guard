import { useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppProvider, useApp } from './context/AppContext'
import OceanBackground from './components/OceanBackground'
import CameraModal from './components/CameraModal'
import DangerWarningModal from './components/DangerWarningModal'
import { useBackendAlerts } from './hooks/useBackendAlerts'
import Home from './pages/Home'
import Setup from './pages/Setup'
import Actions from './pages/Actions'
import Alerts from './pages/Alerts'
import Monitor from './pages/Monitor'

function CameraFab() {
  const [open, setOpen] = useState(false)
  const { warningModalOpen } = useApp()
  const duringWarning = warningModalOpen

  return (
    <>
      {/* Floating button — brighter with white text when baby danger modal is open */}
      <motion.div
        className={`fixed bottom-24 left-1/2 flex flex-col items-center gap-2 ${duringWarning ? 'z-[60]' : 'z-40'}`}
        style={{ x: '-50%' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
      >
        <motion.button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center rounded-full transition-all duration-200"
          style={{
            width: 56,
            height: 56,
            background: duringWarning
              ? 'linear-gradient(135deg, rgba(255,228,240,0.85), rgba(191,219,254,0.8), rgba(167,243,208,0.75))'
              : 'linear-gradient(135deg, rgba(249,168,212,0.25), rgba(96,165,250,0.25), rgba(110,231,183,0.22))',
            border: duringWarning ? '3px solid rgba(255,255,255,0.95)' : '3px solid rgba(191,219,254,0.95)',
            backdropFilter: 'blur(24px)',
            color: duringWarning ? '#0f172a' : '#0f172a',
            boxShadow: duringWarning ? '0 20px 45px rgba(148, 163, 184, 0.55), 0 0 0 1px rgba(255,255,255,0.5)' : '0 20px 45px rgba(148, 163, 184, 0.55)',
          }}
          whileHover={{
            scale: 1.08,
            borderColor: 'rgba(255,255,255,1)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.98))',
          }}
          whileTap={{ scale: 0.95 }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="1.5" y="5" width="14" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="8.5" cy="11" r="3" stroke="currentColor" strokeWidth="1.3" />
            <path d="M15.5 8.5l5-2v9l-5-2V8.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </motion.button>
 
        <span className="text-xs tracking-widest uppercase"
          style={{
            color: duringWarning ? '#ffffff' : 'rgba(130,190,220,0.38)',
            fontWeight: 300,
            letterSpacing: '0.16em',
          }}>
          Live Feed
        </span>
      </motion.div>
 
      <CameraModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function AlertLayer() {
  useBackendAlerts()
  const { warningModalOpen, setWarningModalOpen } = useApp()
  return (
    <DangerWarningModal
      open={warningModalOpen}
      onClose={() => setWarningModalOpen(false)}
    />
  )
}

export default function App() {
  const location = useLocation()

  return (
    <AppProvider>
      <div className="relative min-h-screen font-sans text-dark-global">
        <OceanBackground />
        <Routes>
          <Route path="/"        element={<Home />} />
          <Route path="/setup"   element={<Setup />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/alerts"  element={<Alerts />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
        {location.pathname === '/' && <CameraFab />}
        <AlertLayer />
      </div>
    </AppProvider>
  )
}
