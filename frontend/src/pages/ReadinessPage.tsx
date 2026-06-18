import { useState } from 'react'
import { ReadinessReport, RemediationPlan, RemediationItem } from '../types'
import ReadinessReportView from '../components/ReadinessReport'
import { useEnvironmentUrl } from '../hooks/useEnvironmentUrl'
import { apiFetch } from '../api'

type RunState  = 'idle' | 'running' | 'done' | 'error'
type PlanState = 'hidden' | 'loading' | 'ready' | 'error'

const FIX_CATEGORY_CONFIG = {
  'Cloud Flow':            { color: '#818cf8', bg: 'rgba(99,102,241,0.07)',   border: 'rgba(99,102,241,0.2)'   },
  'Environment Variable':  { color: '#fbbf24', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.2)'   },
  'Connection Reference':  { color: '#c084fc', bg: 'rgba(192,132,252,0.07)', border: 'rgba(192,132,252,0.2)'  },
} as const

function RemediationPlanView({ plan }: { plan: RemediationPlan }) {
  const autoItems   = plan.items.filter(i => i.fixType === 'auto')
  const manualItems = plan.items.filter(i => i.fixType === 'manual')
  const allGood     = plan.items.length === 0

  function ItemRow({ item }: { item: RemediationItem }) {
    const cfg = FIX_CATEGORY_CONFIG[item.category]
    return (
      <div
        className="flex items-start gap-4 px-5 py-3.5 transition-colors"
        style={{ borderBottom: '1px solid var(--border)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
      >
        {/* Category badge */}
        <span
          className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full mt-0.5"
          style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
        >
          {item.category}
        </span>

        {/* Name + states */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.currentState}</span>
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <span className="text-xs" style={{ color: cfg.color }}>{item.proposedFix}</span>
          </div>
        </div>

        {/* Manual deep link */}
        {item.fixType === 'manual' && item.deepLink && (
          <a
            href={item.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: '#c084fc' }}
            onClick={e => e.stopPropagation()}
          >
            Open in Power Apps
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        )}

        {/* Auto badge */}
        {item.fixType === 'auto' && (
          <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ color: '#4ade80', backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
            Auto
          </span>
        )}
      </div>
    )
  }

  if (allGood) {
    return (
      <div
        className="rounded-xl p-6 flex items-center gap-4 animate-fade-in"
        style={{ backgroundColor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}
      >
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#4ade80">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium" style={{ color: '#4ade80' }}>
          Nothing to fix — environment looks clean.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden animate-fade-in" style={{ border: '1px solid var(--border)' }}>
      {/* Header */}
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="#fbbf24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
          </svg>
          <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Fix Preview
          </span>
          {/* Dry-run badge — very prominent */}
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full tracking-wider uppercase"
            style={{ color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            Dry Run — No changes made
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {autoItems.length > 0 && (
            <span style={{ color: '#4ade80' }}>{autoItems.length} auto-fixable</span>
          )}
          {manualItems.length > 0 && (
            <span style={{ color: '#c084fc' }}>{manualItems.length} manual</span>
          )}
        </div>
      </div>

      {/* Auto-fixable section */}
      {autoItems.length > 0 && (
        <>
          <div className="px-5 py-2" style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#4ade80' }}>
              Can be auto-fixed
            </p>
          </div>
          <div style={{ backgroundColor: 'var(--bg-surface)' }}>
            {autoItems.map(item => <ItemRow key={item.id} item={item} />)}
          </div>
        </>
      )}

      {/* Manual section */}
      {manualItems.length > 0 && (
        <>
          <div className="px-5 py-2" style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#c084fc' }}>
              Requires manual action
            </p>
          </div>
          <div style={{ backgroundColor: 'var(--bg-surface)' }}>
            {manualItems.map(item => <ItemRow key={item.id} item={item} />)}
          </div>
        </>
      )}

      {/* Footer note */}
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ backgroundColor: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          This is a preview only — no changes have been made to the environment.
        </p>
      </div>
    </div>
  )
}

const CHECKS_MANIFEST = [
  { label: 'Active layer components',   category: 'Active Layer' },
  { label: 'Unmanaged customizations',  category: 'Active Layer' },
  { label: 'Cloud flows',               category: 'Flows' },
  { label: 'Greymatter solutions',       category: 'Solutions' },
  { label: 'Environment variables',     category: 'Environment Variables' },
  { label: 'Connection references',     category: 'Connection References' },
  { label: 'Option set values',         category: 'Option Sets' },
]

export default function ReadinessPage() {
  const [inputUrl, setInputUrl]   = useEnvironmentUrl()
  const [runState, setRunState]   = useState<RunState>('idle')
  const [report, setReport]       = useState<ReadinessReport | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [currentCheck, setCurrentCheck] = useState(0)

  const [planState, setPlanState] = useState<PlanState>('hidden')
  const [plan, setPlan]           = useState<RemediationPlan | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)

  async function handlePreviewFix() {
    setPlanState('loading')
    setPlan(null)
    setPlanError(null)
    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
      const resp = await apiFetch(`${apiUrl}/api/remediation/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentUrl: inputUrl.trim() }),
      })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error ?? 'Preview failed')
      }
      const data: RemediationPlan = await resp.json()
      setPlan(data)
      setPlanState('ready')
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Could not connect to backend')
      setPlanState('error')
    }
  }

  async function handleRun(e: React.FormEvent) {
    e.preventDefault()
    setRunState('running')
    setReport(null)
    setError(null)
    setCurrentCheck(0)

    // Animate through checks while waiting for the response
    const interval = setInterval(() => {
      setCurrentCheck(v => Math.min(v + 1, CHECKS_MANIFEST.length - 1))
    }, 600)

    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
      const resp = await apiFetch(`${apiUrl}/api/readiness/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentUrl: inputUrl.trim() }),
      })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error ?? 'Readiness check failed')
      }
      const data: ReadinessReport = await resp.json()
      setReport(data)
      setRunState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to backend')
      setRunState('error')
    } finally {
      clearInterval(interval)
    }
  }

  return (
    <>
      {/* Page hero */}
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(34,197,94,0.05) 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(74,222,128,0.4), transparent)' }}
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-16 animate-fade-in">
          <p className="text-xs font-semibold tracking-[0.28em] uppercase mb-4" style={{ color: '#4ade80' }}>
            Feature 03
          </p>
          <h1
            className="font-display font-semibold leading-tight"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: 'var(--text-primary)' }}
          >
            Deployment Readiness<br />Checker
          </h1>
          <p className="text-sm mt-3 max-w-xl" style={{ color: 'var(--text-secondary)' }}>
            Run a full pre-deployment validation across active layers, solutions, environment variables,
            connection references, and option sets to confirm the environment is ready for a Greymatter deployment.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-5 animate-slide-up">

        {/* URL form */}
        <form
          onSubmit={handleRun}
          className="relative rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(74,222,128,0.45), transparent)' }} />

          <div className="px-6 py-6">
            <p className="text-xs font-semibold tracking-[0.22em] uppercase mb-5" style={{ color: 'var(--text-muted)' }}>
              Target Environment
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label htmlFor="readiness-url" className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Environment URL
                </label>
                <input
                  id="readiness-url"
                  type="url"
                  placeholder="https://yourorg.crm.dynamics.com"
                  value={inputUrl}
                  onChange={e => setInputUrl(e.target.value)}
                  required
                  disabled={runState === 'running'}
                  className="w-full rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-mid)',
                    color: 'var(--text-primary)',
                    caretColor: '#4ade80',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34,197,94,0.08)' }}
                  onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)';    e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={runState === 'running' || inputUrl.trim() === ''}
                  className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#16a34a', boxShadow: '0 0 20px rgba(22,163,74,0.2)' }}
                  onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#15803d' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#16a34a' }}
                >
                  {runState === 'running' ? (
                    <>
                      <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Running Checks
                    </>
                  ) : 'Run Readiness Check'}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Loading state — animated checklist */}
        {runState === 'running' && (
          <div
            className="rounded-xl p-6 space-y-4 animate-fade-in"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <p className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Running validation checks…
            </p>
            <div className="space-y-2.5">
              {CHECKS_MANIFEST.map((check, i) => {
                const done    = i < currentCheck
                const current = i === currentCheck
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                      style={done
                        ? { backgroundColor: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }
                        : current
                          ? { backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }
                          : { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }
                      }
                    >
                      {done && <span className="text-green-400 text-xs leading-none">✓</span>}
                      {current && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent-bright)' }} />}
                    </div>
                    <span
                      className="text-xs transition-colors duration-300"
                      style={{ color: done ? '#4ade80' : current ? 'var(--text-primary)' : 'var(--text-muted)' }}
                    >
                      {check.label}
                    </span>
                    <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                      {check.category}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Error state */}
        {runState === 'error' && error && (
          <div
            className="rounded-xl px-5 py-4 text-sm animate-fade-in"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}
          >
            {error}
          </div>
        )}

        {/* Report */}
        {runState === 'done' && report && (
          <ReadinessReportView report={report} />
        )}

        {/* Preview Fix button — only appears after a completed report */}
        {runState === 'done' && report && planState === 'hidden' && (
          <div className="flex justify-center animate-fade-in">
            <button
              onClick={handlePreviewFix}
              className="inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid rgba(245,158,11,0.3)',
                color: '#fbbf24',
                boxShadow: '0 0 24px rgba(245,158,11,0.06)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.06)'
                e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
                e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
              </svg>
              Preview Auto-Fix
            </button>
          </div>
        )}

        {/* Plan loading */}
        {planState === 'loading' && (
          <div
            className="rounded-xl p-5 flex items-center gap-3 animate-fade-in"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" style={{ color: '#fbbf24' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Scanning for fixable issues…</p>
          </div>
        )}

        {/* Plan error */}
        {planState === 'error' && planError && (
          <div
            className="rounded-xl px-5 py-4 text-sm animate-fade-in"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}
          >
            {planError}
          </div>
        )}

        {/* Plan result */}
        {planState === 'ready' && plan && <RemediationPlanView plan={plan} />}

        {/* Idle state */}
        {runState === 'idle' && (
          <div
            className="rounded-xl py-16 flex flex-col items-center gap-4"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px dashed var(--border-mid)' }}
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-1"
              style={{ background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))', border: '1px solid var(--border-mid)' }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.3} stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-display font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>
              No report yet
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Enter an environment URL above and run a readiness check.
            </p>
          </div>
        )}
      </main>
    </>
  )
}
