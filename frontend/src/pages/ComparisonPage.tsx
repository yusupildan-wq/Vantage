import { useState } from 'react'
import { ComparisonReport } from '../types'
import ComparisonReportView from '../components/ComparisonReport'

type RunState = 'idle' | 'running' | 'done' | 'error'

export default function ComparisonPage() {
  const [sourceUrl, setSourceUrl] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [runState, setRunState]   = useState<RunState>('idle')
  const [report, setReport]       = useState<ComparisonReport | null>(null)
  const [error, setError]         = useState<string | null>(null)

  async function handleRun(e: React.FormEvent) {
    e.preventDefault()
    setRunState('running')
    setReport(null)
    setError(null)

    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
      const resp = await fetch(`${apiUrl}/api/comparison/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl: sourceUrl.trim(), targetUrl: targetUrl.trim() }),
      })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error ?? 'Comparison failed')
      }
      const data: ComparisonReport = await resp.json()
      setReport(data)
      setRunState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to backend')
      setRunState('error')
    }
  }

  const isRunning = runState === 'running'

  return (
    <>
      {/* Page hero */}
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)' }}
          />
          {/* Two-tone gradient line representing source → target */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(129,140,248,0.5), rgba(192,132,252,0.5), transparent)' }}
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-16 animate-fade-in">
          <p className="text-xs font-semibold tracking-[0.28em] uppercase mb-4" style={{ color: 'var(--accent-bright)' }}>
            Feature 04
          </p>
          <h1
            className="font-display font-semibold leading-tight text-gradient"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}
          >
            Environment<br />Comparison
          </h1>
          <p className="text-sm mt-3 max-w-xl" style={{ color: 'var(--text-secondary)' }}>
            Diff two Dataverse environments side by side across solutions, environment variables,
            connection references, and cloud flows — instantly spot configuration drift.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-5 animate-slide-up">

        {/* Input form */}
        <form
          onSubmit={handleRun}
          className="relative rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          {/* Two-tone top line */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(129,140,248,0.5), rgba(192,132,252,0.5), transparent)' }} />

          <div className="px-6 py-6">
            <p className="text-xs font-semibold tracking-[0.22em] uppercase mb-5" style={{ color: 'var(--text-muted)' }}>
              Select Environments
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {/* Source */}
              <div>
                <label htmlFor="source-url" className="flex items-center gap-2 text-xs font-medium tracking-wider uppercase mb-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span style={{ color: '#818cf8' }}>Source Environment</span>
                </label>
                <input
                  id="source-url"
                  type="url"
                  placeholder="https://source.crm.dynamics.com"
                  value={sourceUrl}
                  onChange={e => setSourceUrl(e.target.value)}
                  required
                  disabled={isRunning}
                  className="w-full rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-mid)',
                    color: 'var(--text-primary)',
                    caretColor: '#818cf8',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(129,140,248,0.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)' }}
                  onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)';      e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>

              {/* Target */}
              <div>
                <label htmlFor="target-url" className="flex items-center gap-2 text-xs font-medium tracking-wider uppercase mb-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span style={{ color: '#c084fc' }}>Target Environment</span>
                </label>
                <input
                  id="target-url"
                  type="url"
                  placeholder="https://target.crm.dynamics.com"
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                  required
                  disabled={isRunning}
                  className="w-full rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-mid)',
                    color: 'var(--text-primary)',
                    caretColor: '#c084fc',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(192,132,252,0.45)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(192,132,252,0.08)' }}
                  onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)';      e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isRunning || !sourceUrl.trim() || !targetUrl.trim()}
                className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 24px var(--accent-glow)' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--accent-bright)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--accent)' }}
              >
                {isRunning ? (
                  <>
                    <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Comparing
                  </>
                ) : 'Run Comparison'}
              </button>
            </div>
          </div>
        </form>

        {/* Running state */}
        {isRunning && (
          <div
            className="rounded-xl p-6 flex items-center gap-4 animate-fade-in"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <svg className="animate-spin h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent-bright)' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Fetching data from both environments…
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Querying solutions, environment variables, connection references, and flows in parallel.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {runState === 'error' && error && (
          <div
            className="rounded-xl px-5 py-4 text-sm animate-fade-in"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}
          >
            {error}
          </div>
        )}

        {/* Report */}
        {runState === 'done' && report && <ComparisonReportView report={report} />}

        {/* Idle */}
        {runState === 'idle' && (
          <div
            className="rounded-xl py-16 flex flex-col items-center gap-4"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px dashed var(--border-mid)' }}
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))', border: '1px solid var(--border-mid)' }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.3} stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <p className="font-display font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>No comparison yet</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enter two environment URLs above to begin.</p>
          </div>
        )}
      </main>
    </>
  )
}
