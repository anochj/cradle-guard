import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import OceanBackground from './components/OceanBackground'
import Home from './pages/Home'
import Setup from './pages/Setup'
import Actions from './pages/Actions'
import Alerts from './pages/Alerts'
import Monitor from './pages/Monitor'

export default function App() {
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
      </div>
    </AppProvider>
  )
}
