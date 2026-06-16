import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type FlowRunStatus = 'succeeded' | 'failed' | 'running' | 'cancelled' | 'waiting'
type FilterTab = 'all' | 'failing' | 'disabled' | 'healthy'

interface FlowLastRun {
  status: FlowRunStatus
  timestamp: string | null
  errorMessage: string | null
  durationSeconds: number | null
}

interface FlowHealth {
  flowId: string
  name: string
  enabled: boolean
  lastRun: FlowLastRun | null
  failureCount7d: number
  recentRuns: FlowLastRun[]
  owner: string
  modifiedOn: string
}

interface FlowHealthResponse {
  environmentUrl: string
  totalFlows: number
  flows: FlowHealth[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function RunStatusBadge({ status }: { status: FlowRunStatus }) {
  const cfg: Record<FlowRunStatus, { label: string; color: string; bg: string; border: string }> = {
    succeeded: { label: 'Success',   color: '#4ade80', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.2)' },
    failed:    { label: 'Failed',    color: '#f87171', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.2)' },
    running:   { label: 'Running',   color: '#60a5fa', bg: 'rgba(96,165,250,0.07)',  border: 'rgba(96,165,250,0.2)' },
    cancelled: { label: 'Cancelled', color: '#94a3b8', bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.2)' },
    waiting:   { label: 'Waiting',   color: '#fbbf24', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' },
  }
  const c = cfg[status]
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  )
}

// ─── Flow row with expandable run history ─────────────────────────────────────

function FlowRow({ flow }: { flow: FlowHealth }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="cursor-pointer transition-colors"
        style={{ borderBottom: '1px solid var(--border)' }}
        onClick={() => setExpanded(v => !v)}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
      >
        {/* Expand toggle */}
        <td className="px-4 py-3 w-8">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {expanded ? '▾' : '▸'}
          </span>
        </td>

        {/* Name */}
        <td className="px-4 py-3">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {flow.name}
          </span>
        </td>

        {/* Enabled / Disabled */}
        <td className="px-4 py-3">
          {flow.enabled
            ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#4ade80', backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>Enabled</span>
            : <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.2)' }}>Disabled</span>
          }
        </td>

        {/* Last run status */}
        <td className="px-4 py-3">
          {flow.lastRun ? <RunStatusBadge status={flow.lastRun.status} /> : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No runs</span>}
        </td>

        {/* Last run time */}
        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {timeAgo(flow.lastRun?.timestamp ?? null)}
        </td>

        {/* Failures 7d */}
        <td className="px-4 py-3">
          {flow.failureCount7d > 0
            ? <span className="text-xs font-semibold" style={{ color: '#f87171' }}>{flow.failureCount7d} failure{flow.failureCount7d !== 1 ? 's' : ''}</span>
            : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
          }
        </td>

        {/* Last error (inline preview) */}
        <td className="px-4 py-3 max-w-xs">
          {flow.lastRun?.errorMessage
            ? <span className="text-xs truncate block" style={{ color: '#fbbf24', maxWidth: '260px' }} title={flow.lastRun.errorMessage}>
                {flow.lastRun.errorMessage}
              </span>
            : null
          }
        </td>
      </tr>

      {/* Expanded run history */}
      {expanded && (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <td />
          <td colSpan={6} className="px-4 pb-4 pt-2">
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-mid)' }}>
              <div className="px-4 py-2" style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
                  Last {flow.recentRuns.length} runs (7 days)
                </span>
              </div>
              {flow.recentRuns.length === 0 ? (
                <p className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>No runs in the last 7 days.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Status', 'Time', 'Duration', 'Error'].map((h, i) => (
                        <th key={i} className="px-4 py-2 text-left font-semibold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {flow.recentRuns.map((run, i) => (
                      <tr key={i} style={{ borderBottom: i < flow.recentRuns.length - 1 ? '1px solid var(--border)' : undefined }}>
                        <td className="px-4 py-2"><RunStatusBadge status={run.status} /></td>
                        <td className="px-4 py-2" style={{ color: 'var(--text-muted)' }}>{timeAgo(run.timestamp)}</td>
                        <td className="px-4 py-2" style={{ color: 'var(--text-muted)' }}>
                          {run.durationSeconds !== null ? `${run.durationSeconds}s` : '—'}
                        </td>
                        <td className="px-4 py-2" style={{ color: run.errorMessage ? '#fbbf24' : 'var(--text-muted)' }}>
                          {run.errorMessage ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlowsPage() {
  const [inputUrl, setInputUrl]   = useState('')
  const [envUrl, setEnvUrl]       = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [data, setData]           = useState<FlowHealthResponse | null>(null)
  const [filter, setFilter]       = useState<FilterTab>('all')

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setData(null)
    const url = inputUrl.trim()
    setEnvUrl(url)
    try {
      let resp: Response
      try {
        resp = await fetch(`${API_URL}/api/flows/health?environmentUrl=${encodeURIComponent(url)}`)
      } catch {
        setError(`Cannot reach the backend server at ${API_URL}. Make sure the backend is running (cd backend, then npm run dev).`)
        return
      }
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? 'Failed to fetch flows')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setIsLoading(false)
    }
  }

  const flows = data?.flows ?? []
  const summary = {
    total:    flows.length,
    enabled:  flows.filter(f => f.enabled).length,
    disabled: flows.filter(f => !f.enabled).length,
    failing:  flows.filter(f => f.failureCount7d > 0).length,
  }

  const filtered = flows.filter(f => {
    if (filter === 'failing')  return f.failureCount7d > 0
    if (filter === 'disabled') return !f.enabled
    if (filter === 'healthy')  return f.enabled && f.failureCount7d === 0
    return true
  })

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',      label: 'All',      count: summary.total },
    { key: 'failing',  label: 'Failing',  count: summary.failing },
    { key: 'disabled', label: 'Disabled', count: summary.disabled },
    { key: 'healthy',  label: 'Healthy',  count: summary.enabled - summary.failing },
  ]

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(96,165,250,0.05) 0%, transparent 70%)' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.4), transparent)' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-16 animate-fade-in">
          <p className="text-xs font-semibold tracking-[0.28em] uppercase mb-4" style={{ color: '#60a5fa' }}>
            Feature 05
          </p>
          <h1 className="font-display font-semibold leading-tight"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: 'var(--text-primary)' }}>
            Cloud Flow Monitor
          </h1>
          <p className="text-sm mt-3 max-w-lg" style={{ color: 'var(--text-secondary)' }}>
            See every cloud flow's health at a glance — run history, failures, and error messages without clicking through Power Apps.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10 animate-slide-up space-y-8">

        {/* Section 1: Single Environment Health */}
        <section className="space-y-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] uppercase mb-1" style={{ color: '#60a5fa' }}>Section 01</p>
            <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Flow Health</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Enter an environment URL to see all cloud flows, their run status, and any failures in the last 7 days.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleCheck}
            className="relative rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.5), transparent)' }} />
            <div className="px-6 py-6">
              <p className="text-xs font-semibold tracking-[0.22em] uppercase mb-5" style={{ color: 'var(--text-muted)' }}>
                Configuration
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Environment URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://yourorg.crm.dynamics.com"
                    value={inputUrl}
                    onChange={e => setInputUrl(e.target.value)}
                    required
                    className="w-full rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)', caretColor: '#60a5fa' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(96,165,250,0.08)' }}
                    onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={isLoading || !inputUrl.trim()}
                    className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#1d4ed8', boxShadow: '0 0 20px rgba(29,78,216,0.3)' }}
                    onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#2563eb' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1d4ed8' }}>
                    {isLoading ? 'Loading…' : 'Check Flows'}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div className="rounded-lg px-4 py-3 text-xs"
              style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* Results */}
          {data && (
            <div className="relative rounded-xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.5), transparent)' }} />

              {/* Summary bar */}
              <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
                {[
                  { label: 'Total Flows',  value: summary.total,    color: 'var(--text-primary)' },
                  { label: 'Enabled',      value: summary.enabled,  color: '#4ade80' },
                  { label: 'Disabled',     value: summary.disabled, color: '#94a3b8' },
                  { label: 'Failing (7d)', value: summary.failing,  color: summary.failing > 0 ? '#f87171' : '#4ade80' },
                ].map(s => (
                  <div key={s.label}>
                    <p className="text-xs tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                    <p className="text-2xl font-display font-semibold mt-1" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Filter tabs */}
              <div className="px-6 py-3 flex gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setFilter(t.key)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                    style={filter === t.key
                      ? { backgroundColor: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }
                      : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)' }
                    }>
                    {t.label} <span className="ml-1 opacity-60">{t.count}</span>
                  </button>
                ))}
              </div>

              {/* Table */}
              {filtered.length === 0 ? (
                <p className="px-6 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                  No flows match this filter.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="w-8" />
                        {['Flow Name', 'Status', 'Last Run', 'When', 'Failures (7d)', 'Last Error'].map((h, i) => (
                          <th key={i} className="px-4 py-3 text-left font-semibold tracking-wider uppercase"
                            style={{ color: 'var(--text-muted)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(flow => <FlowRow key={flow.flowId} flow={flow} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
