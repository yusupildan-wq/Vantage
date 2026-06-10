import { Routes, Route } from 'react-router-dom'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import Header from './components/Header'
import DashboardPage from './pages/DashboardPage'
import ScanPage from './pages/ScanPage'
import OptionSetPage from './pages/OptionSetPage'

export default function App() {
  useSmoothScroll()

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <Header />
      <Routes>
        <Route path="/"           element={<DashboardPage />} />
        <Route path="/scan"       element={<ScanPage />} />
        <Route path="/optionsets" element={<OptionSetPage />} />
      </Routes>
      <footer
        className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Active Layer Auditor
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Power Platform · Dataverse
        </span>
      </footer>
    </div>
  )
}
