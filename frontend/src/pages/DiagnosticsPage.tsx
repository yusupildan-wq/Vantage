import { useEffect, useMemo, useState } from 'react'
import { apiFetch, API_URL } from '../api'
import { DiagnosticCheck, DiagnosticsReport, DiagnosticStatus } from '../types'

type LoadState = 'loading' | 'ready' | 'error'

const STATUS_STYLE: Record<DiagnosticStatus, { label: string; color: string; bg: string; border: string }> = {
  pass: { label: 'Pass', color: '#4ade80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.22)' },
  warn: { label: 'Warn', color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.24)' },
  fail: { label: 'Fail', color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.24)' },
}

const CATEGORY_ORDER: DiagnosticCheck['category'][] = ['Backend', 'Security', 'Dataverse', 'Azure DevOps', 'Configuration']

function StatusBadge({ status }: { status: DiagnosticStatus }) {
  const style = STATUS_STYLE[status]
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ color: style.color, backgroundColor: style.bg, border: `1px solid ${style.border}` }}
    >
      {style.label}
    </span>
  )
}

function SummaryTile({ label, value, status }: { label: string; value: number; status: DiagnosticStatus }) {
  const style = STATUS_STYLE[status]
  return (
    <div className="rounded-lg px-5 py-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-display text-2xl font-semibold" style={{ color: style.color }}>{value}</p>
    </div>
  )
}

export default function DiagnosticsPage() {
  const [state, setState] = useState<LoadState>('loading')
  const [report, setReport] = useState<DiagnosticsReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [environmentUrl, setEnvironmentUrl] = useState('')

  const grouped = useMemo(() => {
    const groups = new Map<DiagnosticCheck['category'], DiagnosticCheck[]>()
    for (const category of CATEGORY_ORDER) groups.set(category, [])
    for (const check of report?.checks ?? []) {
      groups.set(check.category, [...(groups.get(check.category) ?? []), check])
    }
    return Array.from(groups.entries()).filter(([, checks]) => checks.length > 0)
  }, [report])

  async function loadDiagnostics(url = environmentUrl.trim()) {
    setState('loading')
    setError(null)
    try {
      const query = url ? `?environmentUrl=${encodeURIComponent(url)}` : ''
      const resp = await apiFetch(`${API_URL}/api/diagnostics${query}`)
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error ?? 'Diagnostics failed')
      }
      const data: DiagnosticsReport = await resp.json()
      setReport(data)
      setState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to backend')
      setState('error')
    }
  }

  useEffect(() => {
    loadDiagnostics('')
  }, [])

  return (
    <>
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(45,212,191,0.05) 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.42), transparent)' }}
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-16 animate-fade-in">
          <p className="text-xs font-semibold tracking-[0.28em] uppercase mb-4" style={{ color: '#2dd4bf' }}>
            System Health
          </p>
          <h1
            className="font-display font-semibold leading-tight"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: 'var(--text-primary)' }}
          >
            Diagnostics
          </h1>
          <p className="text-sm mt-3 max-w-xl" style={{ color: 'var(--text-secondary)' }}>
            Check whether Vantage is configured and ready before running scans, comparisons, pipeline checks, or optimizer actions.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-5 animate-slide-up">
        <form
          onSubmit={e => {
            e.preventDefault()
            loadDiagnostics()
          }}
          className="rounded-xl px-6 py-5"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
            <div className="flex-1">
              <label htmlFor="diagnostics-url" className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
                Optional Environment URL
              </label>
              <input
                id="diagnostics-url"
                type="url"
                placeholder="https://yourorg.crm.dynamics.com"
                value={environmentUrl}
                onChange={e => setEnvironmentUrl(e.target.value)}
                className="w-full rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-mid)',
                  color: 'var(--text-primary)',
                  caretColor: '#2dd4bf',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={state === 'loading'}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#0f766e', color: '#fff' }}
            >
              {state === 'loading' && (
                <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              Refresh Diagnostics
            </button>
          </div>
        </form>

        {state === 'error' && error && (
          <div
            className="rounded-xl px-5 py-4 text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}
          >
            {error}
          </div>
        )}

        {report && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="rounded-lg px-5 py-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Overall</p>
                <div className="flex items-center gap-3">
                  <StatusBadge status={report.overallStatus} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(report.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              <SummaryTile label="Passed" value={report.passed} status="pass" />
              <SummaryTile label="Warnings" value={report.warnings} status="warn" />
              <SummaryTile label="Failures" value={report.failures} status="fail" />
            </div>

            <div className="space-y-4">
              {grouped.map(([category, checks]) => (
                <section key={category} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                    <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{category}</h2>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{checks.length} checks</span>
                  </div>
                  <div>
                    {checks.map(check => (
                      <div key={check.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className="md:w-48 flex-shrink-0">
                          <StatusBadge status={check.status} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{check.label}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{check.message}</p>
                          {check.detail && (
                            <p className="text-xs mt-1 break-words" style={{ color: 'var(--text-muted)' }}>{check.detail}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  )
}
