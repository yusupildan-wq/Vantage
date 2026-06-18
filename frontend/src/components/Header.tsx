import { Link, useLocation } from 'react-router-dom'

const PAGE_LABELS: Record<string, string> = {
  '/scan':        'Active Layer Scanner',
  '/optionsets':  'Option Set Guard',
  '/readiness':   'Deployment Readiness Checker',
  '/comparison':  'Environment Comparison',
  '/flows':       'Cloud Flow Monitor',
  '/pipelines':   'Pipeline Health Dashboard',
  '/optimizer':   'Pipeline Optimizer',
}

export default function Header() {
  const { pathname } = useLocation()
  const pageLabel = PAGE_LABELS[pathname]

  return (
    <header style={{ backgroundColor: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 flex-shrink-0 group">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(91,95,199,0.3), rgba(91,95,199,0.1))',
              border: '1px solid rgba(129,140,248,0.25)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--accent-bright)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span
            className="font-display font-semibold text-sm tracking-widest uppercase transition-colors group-hover:text-white"
            style={{ color: pageLabel ? 'var(--text-secondary)' : 'var(--text-primary)' }}
          >
            VTG
          </span>
        </Link>

        {/* Breadcrumb */}
        {pageLabel && (
          <>
            <span style={{ color: 'var(--border-bright)' }}>/</span>
            <span className="font-display text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {pageLabel}
            </span>
          </>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-5">
          {pageLabel && (
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-white"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Dashboard
            </Link>
          )}
          <span className="h-3.5 w-px hidden sm:block" style={{ backgroundColor: 'var(--border-mid)' }} />
          <span className="font-display text-xs font-medium hidden sm:block" style={{ color: 'var(--text-muted)' }}>v1.0</span>
        </div>

      </div>
    </header>
  )
}
