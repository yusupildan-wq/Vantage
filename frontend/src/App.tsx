import { Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import Header from './components/Header'
import DashboardPage from './pages/DashboardPage'
import ScanPage from './pages/ScanPage'
import OptionSetPage from './pages/OptionSetPage'
import ReadinessPage from './pages/ReadinessPage'
import ComparisonPage from './pages/ComparisonPage'
import FlowsPage from './pages/FlowsPage'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function BackendBanner() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking')

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(r => r.ok ? setStatus('ok') : setStatus('down'))
      .catch(() => setStatus('down'))
  }, [])

  if (status === 'ok') return null

  return (
    <div
      className="px-6 py-2.5 text-xs font-medium text-center"
      style={{
        backgroundColor: status === 'checking' ? 'rgba(99,102,241,0.08)' : 'rgba(239,68,68,0.08)',
        borderBottom: `1px solid ${status === 'checking' ? 'rgba(99,102,241,0.2)' : 'rgba(239,68,68,0.2)'}`,
        color: status === 'checking' ? 'var(--text-muted)' : '#f87171',
      }}
    >
      {status === 'checking'
        ? 'Connecting to backend…'
        : `Backend unreachable at ${API_URL}. Open a terminal, run: cd backend   then: npm run dev — and keep it running.`}
    </div>
  )
}

export default function App() {
  useSmoothScroll()

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <Header />
      <BackendBanner />
      <Routes>
        <Route path="/"            element={<DashboardPage />} />
        <Route path="/scan"        element={<ScanPage />} />
        <Route path="/optionsets"  element={<OptionSetPage />} />
        <Route path="/readiness"   element={<ReadinessPage />} />
        <Route path="/comparison"  element={<ComparisonPage />} />
        <Route path="/flows"       element={<FlowsPage />} />
      </Routes>
      <footer
        className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Vantage
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Power Platform · Dataverse
        </span>
      </footer>
    </div>
  )
}
