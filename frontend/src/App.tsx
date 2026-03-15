import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import OceanBackground from './components/OceanBackground'
import { useBackendAlerts } from './hooks/useBackendAlerts'
import Home from './pages/Home'
import Monitor from './pages/Monitor'
import Settings from './pages/Settings.tsx'

function AlertLayer() {
  useBackendAlerts()
  return null
}

export default function App() {
  const location = useLocation()

  return (
    <AppProvider>
      <div className="relative min-h-screen font-sans text-dark-global">
        <OceanBackground />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live" element={<Monitor />} />
          <Route path="/monitor" element={<Navigate to="/live" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/setup" element={<Navigate to="/settings" replace />} />
          <Route path="/actions" element={<Navigate to="/settings" replace />} />
          <Route path="/alerts" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <AlertLayer />
      </div>
    </AppProvider>
  )
}
