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
import PipelinesPage from './pages/PipelinesPage'
import OptimizerPage from './pages/OptimizerPage'
import DiagnosticsPage from './pages/DiagnosticsPage'
import AuditLogPage from './pages/AuditLogPage'
import SettingsPage from './pages/SettingsPage'
import SetupPage from './pages/SetupPage'

const API_URL = import.meta.env.VITE_API_URL ?? ''

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
        : 'Backend unreachable. Double-click Start Vantage.bat to start it, or run: cd backend → npm run dev'}
    </div>
  )
}

type AppStatus = 'loading' | 'setup' | 'ready'

export default function App() {
  useSmoothScroll()
  const [appStatus, setAppStatus] = useState<AppStatus>('loading')

  useEffect(() => {
    fetch(`${API_URL}/setup/status`)
      .then(r => r.json())
      .then(data => setAppStatus(data.configured ? 'ready' : 'setup'))
      .catch(() => setAppStatus('ready')) // backend unreachable — show app so BackendBanner can explain
  }, [])

  if (appStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--border-mid)', borderTopColor: 'transparent' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Starting…</span>
        </div>
      </div>
    )
  }

  if (appStatus === 'setup') {
    return <SetupPage onComplete={() => setAppStatus('ready')} />
  }

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
        <Route path="/pipelines"   element={<PipelinesPage />} />
        <Route path="/optimizer"   element={<OptimizerPage />} />
        <Route path="/diagnostics" element={<DiagnosticsPage />} />
        <Route path="/audit-log"   element={<AuditLogPage />} />
        <Route path="/settings"    element={<SettingsPage />} />
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
