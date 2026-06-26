import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEnvironmentUrl } from '../hooks/useEnvironmentUrl'
import { apiFetch } from '../api'
import ConfirmActionDialog from '../components/ConfirmActionDialog'

type FlowCompareStatus = 'match' | 'drift' | 'source_only' | 'target_only'
type CompareFilter = 'all' | 'drift' | 'source_only' | 'target_only' | 'match'
type ConnRefFilter = 'all' | 'broken' | 'high_risk' | 'healthy'
type ConnRefRisk = 'critical' | 'high' | 'medium' | 'low'

interface AffectedFlow { id: string; name: string; enabled: boolean }

interface ConnectionRefHealth {
  id: string
  logicalName: string
  displayName: string
  connectorType: string
  connectorId: string
  hasConnection: boolean
  status: 'healthy' | 'broken'
  ownerId: string
  isManaged: boolean
  affectedFlows: AffectedFlow[]
  riskLevel: ConnRefRisk
}

interface ConnectionRefsResponse {
  environmentUrl: string
  environmentId: string | null
  total: number
  broken: number
  healthy: number
  flowsAtRisk: number
  refs: ConnectionRefHealth[]
}

interface FlowCompareEntry {
  name: string
  status: FlowCompareStatus
  source: { enabled: boolean; modifiedOn: string } | null
  target: { enabled: boolean; modifiedOn: string } | null
  driftReasons: string[]
}

interface FlowCompareResponse {
  sourceUrl: string
  targetUrl: string
  totalFlows: number
  flows: FlowCompareEntry[]
}

function CompareStatusBadge({ status }: { status: FlowCompareStatus }) {
  const cfg: Record<FlowCompareStatus, { label: string; color: string; bg: string; border: string }> = {
    match:       { label: 'Match',        color: '#4ade80', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.2)' },
    drift:       { label: 'Out of Sync',  color: '#fbbf24', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' },
    source_only: { label: 'Not Deployed', color: '#f87171', bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.2)' },
    target_only: { label: 'Target Only',  color: '#94a3b8', bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.2)' },
  }
  const c = cfg[status]
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  )
}

function EnabledPill({ enabled }: { enabled: boolean }) {
  return enabled
    ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#4ade80', backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>On</span>
    : <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.2)' }}>Off</span>
}

interface Solution { uniqueName: string; displayName: string; isManaged: boolean; flowCount: number }

function SolutionPicker({ envUrl, value, onChange }: {
  envUrl: string; value: string; onChange: (v: string) => void
}) {
  const [solutions, setSolutions] = useState<Solution[]>([])
  const [loading, setLoading]     = useState(false)
  const [loaded, setLoaded]       = useState(false)
  const [err, setErr]             = useState<string | null>(null)

  async function loadSolutions() {
    const url = envUrl.trim()
    if (!url) return
    setLoading(true); setErr(null)
    try {
      const resp = await apiFetch(`${API_URL}/api/flows/solutions?environmentUrl=${encodeURIComponent(url)}`)
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? 'Failed')
      setSolutions(json.solutions ?? [])
      setLoaded(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load solutions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
        Filter by Solution{' '}
        <span style={{ textTransform: 'none', fontWeight: 400, fontSize: '0.7rem', color: 'var(--text-muted)' }}>(optional)</span>
      </label>
      <div className="flex items-center gap-2">
        {loaded && (
          <select value={value} onChange={e => onChange(e.target.value)}
            className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)' }}>
            <option value="">— All flows —</option>
            {solutions.map(s => <option key={s.uniqueName} value={s.uniqueName}>{s.displayName} ({s.flowCount} flow{s.flowCount !== 1 ? 's' : ''})</option>)}
          </select>
        )}
        <button type="button" onClick={loadSolutions} disabled={!envUrl.trim() || loading}
          className="text-xs px-3 py-2 rounded-lg transition-all disabled:opacity-30 whitespace-nowrap"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)' }}>
          {loading ? 'Loading…' : loaded ? '↻ Reload' : 'Load Solutions'}
        </button>
      </div>
      {err && <p className="mt-1 text-xs" style={{ color: '#f87171' }}>{err}</p>}
    </div>
  )
}

function FlowCompareSection() {
  const [sourceUrl, setSourceUrl]       = useState('')
  const [targetUrl, setTargetUrl]       = useState('')
  const [solutionName, setSolutionName] = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [data, setData]                 = useState<FlowCompareResponse | null>(null)
  const [filter, setFilter]             = useState<CompareFilter>('all')
  const [showAllCompare, setShowAllCompare] = useState(false)

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setData(null)
    try {
      let resp: Response
      try {
        const params = new URLSearchParams({ sourceUrl: sourceUrl.trim(), targetUrl: targetUrl.trim() })
        if (solutionName) params.set('solutionName', solutionName)
        resp = await apiFetch(`${API_URL}/api/flows/compare?${params}`)
      } catch {
        setError(`Cannot reach the backend server at ${API_URL}. Make sure the backend is running.`)
        return
      }
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? 'Comparison failed')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setIsLoading(false)
    }
  }

  function exportCsv() {
    if (!data) return
    const rows = [
      ['Flow Name', 'Status', 'Source', 'Target', "What's Different"],
      ...data.flows.map(f => [
        f.name,
        f.status === 'drift' ? 'Out of Sync' : f.status === 'source_only' ? 'Not Deployed' : f.status === 'target_only' ? 'Target Only' : 'Match',
        f.source ? (f.source.enabled ? 'On' : 'Off') : '—',
        f.target ? (f.target.enabled ? 'On' : 'Off') : '—',
        f.driftReasons.join('; ') || '—',
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `flow-comparison-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const flows = data?.flows ?? []
  const counts = {
    all:         flows.length,
    drift:       flows.filter(f => f.status === 'drift').length,
    source_only: flows.filter(f => f.status === 'source_only').length,
    target_only: flows.filter(f => f.status === 'target_only').length,
    match:       flows.filter(f => f.status === 'match').length,
  }
  const filtered = filter === 'all' ? flows : flows.filter(f => f.status === filter)

  const tabs: { key: CompareFilter; label: string }[] = [
    { key: 'all',         label: `All (${counts.all})` },
    { key: 'drift',       label: `Out of Sync (${counts.drift})` },
    { key: 'source_only', label: `Not Deployed (${counts.source_only})` },
    { key: 'target_only', label: `Target Only (${counts.target_only})` },
    { key: 'match',       label: `Match (${counts.match})` },
  ]

  const inputStyle = {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-mid)',
    color: 'var(--text-primary)',
    caretColor: '#60a5fa',
  }

  return (
    <>
      {/* Form */}
      <form onSubmit={handleCompare}
        className="relative rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.5), transparent)' }} />
        <div className="px-6 py-6 space-y-5">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase" style={{ color: 'var(--text-muted)' }}>Configuration</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Source Environment</label>
              <input type="url" placeholder="https://yourorg-dev.crm.dynamics.com" value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)} required
                className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none transition-all"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(96,165,250,0.08)' }}
                onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }} />
            </div>
            <div>
              <label className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Target Environment</label>
              <input type="url" placeholder="https://yourorg-prod.crm.dynamics.com" value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)} required
                className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none transition-all"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(96,165,250,0.08)' }}
                onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }} />
            </div>
          </div>
          <SolutionPicker envUrl={sourceUrl} value={solutionName} onChange={setSolutionName} />
          <button type="submit" disabled={isLoading || !sourceUrl.trim() || !targetUrl.trim()}
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1d4ed8', boxShadow: '0 0 20px rgba(29,78,216,0.3)' }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#2563eb' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1d4ed8' }}>
            {isLoading ? 'Comparing…' : 'Compare Flows'}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-lg px-4 py-3 text-xs"
          style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {data && (
        <div className="relative rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.5), transparent)' }} />

          {/* Summary */}
          <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
            {[
              { label: 'Total',       value: counts.all,         color: 'var(--text-primary)' },
              { label: 'Out of Sync', value: counts.drift,       color: counts.drift > 0 ? '#fbbf24' : '#4ade80' },
              { label: 'Not Deployed', value: counts.source_only, color: counts.source_only > 0 ? '#f87171' : '#4ade80' },
              { label: 'Match',       value: counts.match,       color: '#4ade80' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xs tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                <p className="text-2xl font-display font-semibold mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs + export */}
          <div className="px-6 py-3 flex flex-wrap items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => { setFilter(t.key); setShowAllCompare(false) }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                style={filter === t.key
                  ? { backgroundColor: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }
                  : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)' }
                }>
                {t.label}
              </button>
            ))}
            <button onClick={exportCsv}
              className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.borderColor = 'rgba(96,165,250,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-bright)' }}>
              Export CSV
            </button>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <p className="px-6 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No flows match this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {["Flow Name", "Status", "Source", "Target", "What's Different"].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left font-semibold tracking-wider uppercase"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, showAllCompare ? undefined : 10).map((flow, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{flow.name}</td>
                      <td className="px-4 py-3"><CompareStatusBadge status={flow.status} /></td>
                      <td className="px-4 py-3">
                        {flow.source ? <EnabledPill enabled={flow.source.enabled} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {flow.target ? <EnabledPill enabled={flow.target.enabled} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3" style={{ color: flow.driftReasons.length > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                        {flow.driftReasons.join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 10 && (
                <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => setShowAllCompare(v => !v)}
                    className="text-xs font-medium transition-colors"
                    style={{ color: '#60a5fa' }}>
                    {showAllCompare ? 'Show less' : `Show ${filtered.length - 10} more`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type FlowRunStatus = 'succeeded' | 'failed' | 'running' | 'cancelled' | 'waiting'
type FilterTab = 'all' | 'failing' | 'silent' | 'disabled' | 'healthy'

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
  triggerHealth: 'ok' | 'stale' | 'never_run'
  daysSinceLastRun: number | null
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

// ─── Trigger health badge ─────────────────────────────────────────────────────

function TriggerHealthBadge({ triggerHealth, daysSinceLastRun, enabled }: {
  triggerHealth: 'ok' | 'stale' | 'never_run'
  daysSinceLastRun: number | null
  enabled: boolean
}) {
  if (!enabled) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  if (triggerHealth === 'ok') return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color: '#4ade80', backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
      Active
    </span>
  )
  if (triggerHealth === 'stale') return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}
      title="Flow is enabled but hasn't run in over 7 days — the trigger may have stopped firing">
      Silent {daysSinceLastRun}d
    </span>
  )
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.2)' }}
      title="Flow is enabled but has never triggered — check the trigger configuration">
      Never triggered
    </span>
  )
}

// ─── Flow row with expandable run history ─────────────────────────────────────

function FlowRow({ flow }: { flow: FlowHealth }) {
  const [expanded, setExpanded] = useState(false)
  const [aiExplain, setAiExplain] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  async function explainError(e: React.MouseEvent) {
    e.stopPropagation()
    if (!flow.lastRun?.errorMessage) return
    setAiLoading(true)
    setAiExplain(null)
    try {
      const resp = await apiFetch(`${API_URL}/api/flows/explain-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowName: flow.name, errorMessage: flow.lastRun.errorMessage }),
      })
      const json = await resp.json()
      setAiExplain(json.explanation ?? json.error ?? 'No explanation returned.')
    } catch {
      setAiExplain('Failed to get explanation. Check your connection.')
    } finally {
      setAiLoading(false)
    }
  }

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

        {/* Trigger health */}
        <td className="px-4 py-3">
          <TriggerHealthBadge
            triggerHealth={flow.triggerHealth}
            daysSinceLastRun={flow.daysSinceLastRun}
            enabled={flow.enabled}
          />
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
          {flow.lastRun?.errorMessage ? (
            <div className="flex items-center gap-2">
              <span className="text-xs truncate block" style={{ color: '#fbbf24', maxWidth: '200px' }} title={flow.lastRun.errorMessage}>
                {flow.lastRun.errorMessage}
              </span>
              <button
                onClick={explainError}
                disabled={aiLoading}
                className="text-xs px-2 py-0.5 rounded font-medium flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)', cursor: aiLoading ? 'wait' : 'pointer' }}
              >
                {aiLoading ? '...' : '✦ Explain'}
              </button>
            </div>
          ) : null}
        </td>
      </tr>

      {/* Expanded run history */}
      {expanded && (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <td />
          <td colSpan={7} className="px-4 pb-4 pt-2">
            {aiExplain && (
              <div className="mb-3 rounded-lg p-4" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold" style={{ color: '#a78bfa' }}>✦ AI Explanation</span>
                  <button onClick={() => setAiExplain(null)} className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>✕</button>
                </div>
                <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{aiExplain}</p>
              </div>
            )}
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

// ─── Connection ref badges ────────────────────────────────────────────────────

function CRStatusBadge({ status }: { status: 'healthy' | 'broken' }) {
  return status === 'healthy' ? (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color: '#4ade80', backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>Healthy</span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color: '#f87171', backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>Broken</span>
  )
}

function CRRiskBadge({ level }: { level: ConnRefRisk }) {
  const cfg: Record<ConnRefRisk, { label: string; color: string; bg: string; border: string }> = {
    critical: { label: 'Critical', color: '#f87171', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.2)' },
    high:     { label: 'High',     color: '#fb923c', bg: 'rgba(251,146,60,0.07)',  border: 'rgba(251,146,60,0.2)' },
    medium:   { label: 'Medium',   color: '#fbbf24', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' },
    low:      { label: 'Low',      color: '#4ade80', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.2)' },
  }
  const c = cfg[level]
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}` }}>{c.label}</span>
  )
}

// ─── Blast radius map (SVG) ───────────────────────────────────────────────────

function BlastRadiusMap({ refs }: { refs: ConnectionRefHealth[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const visRefs = refs.filter(r => r.affectedFlows.length > 0).slice(0, 14)

  type FlowNode = AffectedFlow & { connectedRefIds: string[]; isAtRisk: boolean }
  const flowMap = new Map<string, FlowNode>()
  for (const ref of visRefs) {
    for (const flow of ref.affectedFlows) {
      if (!flowMap.has(flow.id)) flowMap.set(flow.id, { ...flow, connectedRefIds: [], isAtRisk: false })
      const fn = flowMap.get(flow.id)!
      fn.connectedRefIds.push(ref.id)
      if (ref.status === 'broken') fn.isAtRisk = true
    }
  }
  const flowNodes = [...flowMap.values()].slice(0, 26)

  if (visRefs.length === 0) return null

  const VB_W = 860
  const NH = 34
  const GAP = 9
  const REF_X = 10; const REF_W = 210
  const FL_X  = 650; const FL_W  = 200
  const PAD   = 18

  const refsH  = visRefs.length    * (NH + GAP)
  const flowsH = flowNodes.length  * (NH + GAP)
  const VB_H   = Math.max(refsH, flowsH) + PAD * 2

  const ry  = (i: number) => PAD + (VB_H - PAD*2 - refsH ) / 2 + i * (NH + GAP) + NH / 2
  const fny = (i: number) => PAD + (VB_H - PAD*2 - flowsH) / 2 + i * (NH + GAP) + NH / 2

  const activeRefs  = new Set<string>()
  const activeFlows = new Set<string>()
  if (hoveredId) {
    if (hoveredId.startsWith('r:')) {
      const rid = hoveredId.slice(2)
      activeRefs.add(rid)
      flowNodes.forEach(f => { if (f.connectedRefIds.includes(rid)) activeFlows.add(f.id) })
    } else if (hoveredId.startsWith('f:')) {
      const fid = hoveredId.slice(2)
      activeFlows.add(fid)
      flowMap.get(fid)?.connectedRefIds.forEach(r => activeRefs.add(r))
    }
  }
  const hasHover = !!hoveredId
  const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s
  const FF = 'ui-sans-serif, system-ui, sans-serif'

  return (
    <div style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 16px 12px' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--text-muted)' }}>Blast Radius Map</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hover any node to trace its dependencies</p>
      </div>
      <div className="flex flex-wrap gap-4 mb-4">
        {[
          { color: '#f87171', label: 'Broken connection' },
          { color: '#4ade80', label: 'Healthy connection' },
          { color: '#fbbf24', label: 'Flow at risk' },
          { color: '#94a3b8', label: 'Flow safe' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        {/* Column labels */}
        <text x={REF_X + REF_W/2} y={7} fontSize={7.5} fontFamily={FF} fill="#475569" textAnchor="middle" fontWeight={700} letterSpacing={2.5}>CONNECTIONS</text>
        <text x={FL_X  + FL_W /2} y={7} fontSize={7.5} fontFamily={FF} fill="#475569" textAnchor="middle" fontWeight={700} letterSpacing={2.5}>FLOWS</text>

        {/* Edges */}
        {visRefs.map((ref, ri) =>
          ref.affectedFlows.map(af => {
            const fi = flowNodes.findIndex(f => f.id === af.id)
            if (fi === -1) return null
            const x1 = REF_X + REF_W; const y1 = ry(ri)
            const x2 = FL_X;          const y2 = fny(fi)
            const cx = (x1 + x2) / 2
            const active = !hasHover || activeRefs.has(ref.id) || activeFlows.has(af.id)
            const col = ref.status === 'broken' ? '#f87171' : '#4ade80'
            return (
              <path key={`${ref.id}-${af.id}`}
                d={`M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`}
                fill="none" stroke={col}
                strokeWidth={active ? 1.5 : 0.4}
                opacity={hasHover ? (active ? 0.7 : 0.04) : 0.2}
                style={{ transition: 'all 0.15s ease' }} />
            )
          })
        )}

        {/* Connection ref nodes */}
        {visRefs.map((ref, ri) => {
          const y = ry(ri)
          const active = !hasHover || activeRefs.has(ref.id)
          const col = ref.status === 'broken' ? '#f87171' : '#4ade80'
          const bg  = ref.status === 'broken' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)'
          return (
            <g key={ref.id} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredId(`r:${ref.id}`)}
              onMouseLeave={() => setHoveredId(null)}>
              <rect x={REF_X} y={y - NH/2} width={REF_W} height={NH} rx={7}
                fill={bg} stroke={col} strokeWidth={active ? 1.5 : 0.6}
                opacity={hasHover && !active ? 0.18 : 1}
                style={{ transition: 'all 0.15s ease' }} />
              <text x={REF_X + 10} y={y - 2} fontSize={10.5} fontFamily={FF} fontWeight={500}
                fill={col} dominantBaseline="middle"
                opacity={hasHover && !active ? 0.2 : 1}
                style={{ transition: 'opacity 0.15s' }}>
                {trunc(ref.displayName, 21)}
              </text>
              <text x={REF_X + 10} y={y + 10} fontSize={8.5} fontFamily={FF}
                fill={col} dominantBaseline="middle" opacity={hasHover && !active ? 0.15 : 0.5}
                style={{ transition: 'opacity 0.15s' }}>
                {ref.connectorType}
              </text>
              <text x={REF_X + REF_W - 8} y={y} fontSize={10} fontFamily={FF} fontWeight={700}
                fill={col} dominantBaseline="middle" textAnchor="end"
                opacity={hasHover && !active ? 0.15 : 0.8}
                style={{ transition: 'opacity 0.15s' }}>
                {ref.affectedFlows.length}
              </text>
            </g>
          )
        })}

        {/* Flow nodes */}
        {flowNodes.map((flow, fi) => {
          const y = fny(fi)
          const active = !hasHover || activeFlows.has(flow.id)
          const col = flow.isAtRisk ? '#fbbf24' : (flow.enabled ? '#4ade80' : '#64748b')
          const bg  = flow.isAtRisk ? 'rgba(251,191,36,0.08)' : (flow.enabled ? 'rgba(34,197,94,0.06)' : 'rgba(100,116,139,0.08)')
          return (
            <g key={flow.id} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredId(`f:${flow.id}`)}
              onMouseLeave={() => setHoveredId(null)}>
              <rect x={FL_X} y={y - NH/2} width={FL_W} height={NH} rx={7}
                fill={bg} stroke={col} strokeWidth={active ? 1 : 0.4}
                opacity={hasHover && !active ? 0.12 : 1}
                style={{ transition: 'all 0.15s ease' }} />
              <text x={FL_X + 10} y={y} fontSize={10} fontFamily={FF}
                fill={hasHover && !active ? '#334155' : '#94a3b8'}
                dominantBaseline="middle"
                opacity={hasHover && !active ? 0.35 : 1}
                style={{ transition: 'all 0.15s ease' }}>
                {trunc(flow.name, 24)}
              </text>
            </g>
          )
        })}
      </svg>

      <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
        Showing top 14 connections by risk severity — see table below for the full list
      </p>
    </div>
  )
}

// ─── Mini blast radius map (per-row) ─────────────────────────────────────────

function MiniBlastMap({ connRef }: { connRef: ConnectionRefHealth }) {
  const flows = connRef.affectedFlows
  if (flows.length === 0) return null

  const ROW_H   = 38
  const PAD     = 20
  const svgH    = Math.max(70, flows.length * ROW_H + PAD * 2)
  const refCY   = svgH / 2
  const refX    = 8
  const refW    = 150
  const flowX   = 210
  const flowW   = 140
  const totalW  = flowX + flowW + 8

  const refColor  = connRef.status === 'broken' ? '#f87171' : '#4ade80'
  const refFill   = connRef.status === 'broken' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.07)'
  const lineColor = connRef.status === 'broken' ? '#f87171' : '#4ade80'

  const label = (s: string, max: number) => s.length > max ? s.slice(0, max) + '…' : s

  return (
    <svg viewBox={`0 0 ${totalW} ${svgH}`} width="100%"
      style={{ display: 'block', overflow: 'visible' }}>

      {/* Connection ref node */}
      <rect x={refX} y={refCY - 16} width={refW} height={32} rx={6}
        fill={refFill} stroke={refColor} strokeWidth={1} />
      <text x={refX + refW / 2} y={refCY - 3} textAnchor="middle" fontSize="8"
        fill={refColor} fontWeight="600">
        {label(connRef.connectorType, 18)}
      </text>
      <text x={refX + refW / 2} y={refCY + 9} textAnchor="middle" fontSize="7"
        fill="rgba(148,163,184,0.8)">
        {label(connRef.logicalName, 22)}
      </text>

      {/* Flow nodes + bezier curves */}
      {flows.map((flow, i) => {
        const fy  = PAD + i * ROW_H + ROW_H / 2
        const x1  = refX + refW
        const x2  = flowX
        const cx  = (x1 + x2) / 2
        const enabledColor = '#fbbf24'
        const disabledColor = '#475569'
        const fc  = flow.enabled ? enabledColor : disabledColor
        const ff  = flow.enabled ? 'rgba(251,191,36,0.06)' : 'rgba(71,85,105,0.05)'
        const fs  = flow.enabled ? 'rgba(251,191,36,0.25)' : 'rgba(71,85,105,0.2)'
        return (
          <g key={flow.id}>
            <path d={`M ${x1} ${refCY} C ${cx} ${refCY} ${cx} ${fy} ${x2} ${fy}`}
              fill="none" stroke={lineColor} strokeWidth={1} opacity={0.35} />
            <rect x={flowX} y={fy - 13} width={flowW} height={26} rx={5}
              fill={ff} stroke={fs} strokeWidth={1} />
            <text x={flowX + 8} y={fy + 4} fontSize="8" fill={fc} fontWeight="500">
              {label(flow.name, 19)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Connection ref expandable row ───────────────────────────────────────────

type FixState = 'idle' | 'running' | 'success' | 'error'

function ConnRefRow({ connRef, environmentUrl }: {
  connRef: ConnectionRefHealth
  environmentUrl: string
}) {
  const ref = connRef
  const [expanded, setExpanded]   = useState(false)
  const [fixState, setFixState]   = useState<FixState>('idle')
  const [fixMessage, setFixMessage] = useState('')
  const [confirmFixOpen, setConfirmFixOpen] = useState(false)

  const isDataverse = ref.connectorId.includes('commondataservice')
  const canAutoFix  = ref.status === 'broken' && isDataverse
  const base = environmentUrl.replace(/\/$/, '')
  const powerAppsUrl = `${base}/main.aspx?forceUCI=1&pagetype=entitylist&etn=connectionreference`

  async function runFix() {
    setFixState('running')
    try {
      const resp = await apiFetch(`${API_URL}/api/connectionrefs/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environmentUrl,
          connectionRefId: ref.id,
          connectionRefName: ref.logicalName,
          connectorType: ref.connectorType,
          safetyAcknowledged: true,
        }),
      })
      const json = await resp.json()
      setConfirmFixOpen(false)
      if (json.success) { setFixState('success'); setFixMessage(json.message) }
      else               { setFixState('error');   setFixMessage(json.message ?? 'Fix failed') }
    } catch {
      setFixState('error')
      setFixMessage('Could not reach the backend.')
    }
  }

  return (
    <>
      <tr className="cursor-pointer transition-colors"
        style={{ borderBottom: expanded ? 'none' : '1px solid var(--border)' }}
        onClick={() => setExpanded(v => !v)}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}>
        <td className="px-4 py-3 w-8">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{expanded ? '▾' : '▸'}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm font-medium block truncate" title={ref.logicalName} style={{ color: 'var(--text-primary)' }}>
            {ref.logicalName}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs px-2 py-0.5 rounded font-medium"
            style={{ color: '#94a3b8', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
            {ref.connectorType}
          </span>
        </td>
        <td className="px-4 py-3"><CRStatusBadge status={ref.status} /></td>
        <td className="px-4 py-3"><CRRiskBadge level={ref.riskLevel} /></td>
        <td className="px-4 py-3">
          {ref.affectedFlows.length === 0
            ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>None</span>
            : <span className="text-xs font-semibold"
                style={{ color: ref.status === 'broken' && ref.affectedFlows.length > 0 ? '#f87171' : 'var(--text-primary)' }}>
                {ref.affectedFlows.length} flow{ref.affectedFlows.length !== 1 ? 's' : ''}
              </span>
          }
        </td>
        {/* Actions — stop row click from propagating */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          {ref.status === 'broken' && (
            <div className="flex items-center gap-2 flex-wrap">
              <a href={powerAppsUrl} target="_blank" rel="noreferrer"
                className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                style={{ color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', whiteSpace: 'nowrap' }}>
                Open in Power Apps
              </a>
              {canAutoFix && fixState === 'idle' && (
                <button onClick={() => { setConfirmFixOpen(true); setExpanded(true) }}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                  style={{ color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', whiteSpace: 'nowrap' }}>
                  Auto-fix
                </button>
              )}
              {fixState === 'success' && <span className="text-xs font-medium" style={{ color: '#4ade80' }}>Fixed</span>}
              {fixState === 'error'   && <span className="text-xs font-medium" style={{ color: '#f87171' }}>Failed</span>}
            </div>
          )}
        </td>
      </tr>

      {expanded && (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <td />
          <td colSpan={6} className="px-4 pb-4 pt-2">
            <div className="space-y-3">

              {/* Confirmation panel */}
              {false && (
                <div className="rounded-lg px-4 py-4"
                  style={{ backgroundColor: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#a78bfa' }}>Auto-fix — Dataverse connection</p>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                    This will find another healthy Dataverse connection reference in this environment and copy its connection to fix{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{ref.logicalName}</strong>.
                  </p>
                  <p className="text-xs mb-4" style={{ color: '#fbbf24' }}>
                    Only run this if both connection references should share the same credentials.
                  </p>
                  <div className="flex items-center gap-3">
                    <button onClick={runFix}
                      className="text-xs px-4 py-2 rounded-lg font-semibold text-white"
                      style={{ backgroundColor: '#6d28d9', boxShadow: '0 0 14px rgba(109,40,217,0.3)' }}>
                      Yes, run auto-fix
                    </button>
                    <button onClick={() => setFixState('idle')}
                      className="text-xs px-4 py-2 rounded-lg font-medium"
                      style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {fixState === 'running' && (
                <div className="rounded-lg px-4 py-3 text-xs"
                  style={{ backgroundColor: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}>
                  Running fix…
                </div>
              )}
              {fixState === 'success' && (
                <div className="rounded-lg px-4 py-3 text-xs"
                  style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>{fixMessage}</span>
                    <Link to="/audit-log" className="font-semibold transition-opacity hover:opacity-80" style={{ color: '#4ade80' }}>
                      View Audit Log
                    </Link>
                  </div>
                </div>
              )}
              {fixState === 'error' && (
                <div className="rounded-lg px-4 py-3 text-xs"
                  style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
                  {fixMessage}
                </div>
              )}

              {/* Mini blast radius map */}
              {ref.affectedFlows.length > 0 && (
                <div className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
                  <p className="text-xs font-semibold tracking-wider uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
                    Blast Radius
                  </p>
                  <MiniBlastMap connRef={ref} />
                </div>
              )}

              {/* Affected flows list */}
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-mid)' }}>
                <div className="px-4 py-2" style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
                    {ref.affectedFlows.length === 0
                      ? 'No flows use this connection — may be safe to remove'
                      : ref.status === 'broken'
                        ? 'Flows currently broken by this connection'
                        : 'Flows depending on this connection'}
                  </span>
                </div>
                {ref.affectedFlows.length === 0 ? (
                  <p className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>No flows reference this connection reference.</p>
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {ref.affectedFlows.map(flow => (
                      <div key={flow.id} className="px-4 py-2.5 flex items-center justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{flow.name}</span>
                        {flow.enabled
                          ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#4ade80', backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>Enabled</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.2)' }}>Disabled</span>
                        }
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
      <ConfirmActionDialog
        open={confirmFixOpen}
        title="Auto-Fix Connection Reference"
        tone="warning"
        confirmLabel="Run Auto-Fix"
        isWorking={fixState === 'running'}
        body="Vantage will find a healthy Dataverse connection reference with the same connector type and copy its connection onto this broken reference."
        checkLabel="I understand this will update a Dataverse connection reference to share another reference's credentials."
        details={[
          { label: 'Environment', value: environmentUrl },
          { label: 'Reference', value: ref.logicalName },
          { label: 'Connector', value: ref.connectorType },
          { label: 'Affected Flows', value: `${ref.affectedFlows.length}` },
          { label: 'Donor', value: 'Selected automatically from healthy matching references' },
        ]}
        onCancel={() => setConfirmFixOpen(false)}
        onConfirm={runFix}
      />
    </>
  )
}

// ─── Connection ref section (Section 03) ────────────────────────────────────

function ConnectionRefSection() {
  const [inputUrl, setInputUrl]   = useEnvironmentUrl()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [data, setData]           = useState<ConnectionRefsResponse | null>(null)
  const [filter, setFilter]       = useState<ConnRefFilter>('all')
  const [showAll, setShowAll]     = useState(false)

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true); setError(null); setData(null)
    try {
      let resp: Response
      try {
        resp = await apiFetch(`${API_URL}/api/connectionrefs/health?environmentUrl=${encodeURIComponent(inputUrl.trim())}`)
      } catch {
        setError(`Cannot reach the backend server at ${API_URL}. Make sure the backend is running.`)
        return
      }
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? 'Failed to fetch connection references')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setIsLoading(false)
    }
  }

  const refs = data?.refs ?? []
  const counts = {
    all:       refs.length,
    broken:    refs.filter(r => r.status === 'broken').length,
    high_risk: refs.filter(r => r.riskLevel === 'critical' || r.riskLevel === 'high').length,
    healthy:   refs.filter(r => r.status === 'healthy').length,
  }
  const filtered = refs.filter(r => {
    if (filter === 'broken')    return r.status === 'broken'
    if (filter === 'high_risk') return r.riskLevel === 'critical' || r.riskLevel === 'high'
    if (filter === 'healthy')   return r.status === 'healthy'
    return true
  })
  const tabs: { key: ConnRefFilter; label: string; count: number }[] = [
    { key: 'all',       label: 'All',       count: counts.all },
    { key: 'broken',    label: 'Broken',    count: counts.broken },
    { key: 'high_risk', label: 'High Risk', count: counts.high_risk },
    { key: 'healthy',   label: 'Healthy',   count: counts.healthy },
  ]

  return (
    <>
      {/* Form */}
      <form onSubmit={handleScan}
        className="relative rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)' }} />
        <div className="px-6 py-6">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase mb-5" style={{ color: 'var(--text-muted)' }}>Configuration</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Environment URL</label>
              <input type="url" placeholder="https://yourorg.crm.dynamics.com" value={inputUrl}
                onChange={e => setInputUrl(e.target.value)} required
                className="w-full rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)', caretColor: '#a78bfa' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.08)' }}
                onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }} />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={isLoading || !inputUrl.trim()}
                className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#6d28d9', boxShadow: '0 0 20px rgba(109,40,217,0.3)' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#7c3aed' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#6d28d9' }}>
                {isLoading ? 'Scanning…' : 'Scan Connections'}
              </button>
            </div>
          </div>
          {isLoading && (
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              Parsing flow definitions to build the blast radius map — may take 10–20s for large environments.
            </p>
          )}
        </div>
      </form>

      {error && (
        <div className="rounded-lg px-4 py-3 text-xs"
          style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="relative rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)' }} />
            <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total',         value: data.total,       color: 'var(--text-primary)' },
                { label: 'Healthy',       value: data.healthy,     color: '#4ade80' },
                { label: 'Broken',        value: data.broken,      color: data.broken > 0 ? '#f87171' : '#4ade80' },
                { label: 'Flows at Risk', value: data.flowsAtRisk, color: data.flowsAtRisk > 0 ? '#f87171' : '#4ade80' },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-xs tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  <p className="text-2xl font-display font-semibold mt-1" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Blast radius visual map */}
          <BlastRadiusMap refs={refs} />

          {/* Broken warning */}
          {data.broken > 0 && (
            <div className="rounded-lg px-4 py-3 text-xs font-medium flex items-center gap-2"
              style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374l7.5-12.999a2.25 2.25 0 013.706 0l7.5 13zm-10.5-3.376h.008v.008H12v-.008z" />
              </svg>
              {data.broken} broken connection{data.broken !== 1 ? 's' : ''} — {data.flowsAtRisk} flow{data.flowsAtRisk !== 1 ? 's' : ''} will fail until fixed. Expand any broken row to see which flows are affected.
            </div>
          )}

          {/* Filter tabs + table */}
          <div className="relative rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="px-6 py-3 flex flex-wrap gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              {tabs.map(t => (
                <button key={t.key}
                  onClick={() => { setFilter(t.key); setShowAll(false) }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                  style={filter === t.key
                    ? { backgroundColor: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }
                    : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)' }
                  }>
                  {t.label} <span className="ml-1 opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <p className="px-6 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No connection references match this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-xs" style={{ width: '100%', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '2rem' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '23%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="w-8" />
                      {['Connection Name', 'Connector', 'Status', 'Risk', 'Flows Affected', 'Actions'].map((h, i) => (
                        <th key={i} className="px-4 py-3 text-left font-semibold tracking-wider uppercase"
                          style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, showAll ? undefined : 10).map(ref => (
                      <ConnRefRow key={ref.id} connRef={ref} environmentUrl={data!.environmentUrl} />
                    ))}
                  </tbody>
                </table>
                {filtered.length > 10 && (
                  <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => setShowAll(v => !v)}
                      className="text-xs font-medium" style={{ color: '#a78bfa' }}>
                      {showAll ? 'Show less' : `Show ${filtered.length - 10} more`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlowsPage() {
  const [inputUrl, setInputUrl]   = useEnvironmentUrl()

  const [isLoading, setIsLoading]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [data, setData]               = useState<FlowHealthResponse | null>(null)
  const [filter, setFilter]           = useState<FilterTab>('all')
  const [showAll, setShowAll]         = useState(false)
  const [search, setSearch]           = useState('')
  const [scannedAt, setScannedAt]     = useState<Date | null>(null)
  const [solutionName, setSolutionName] = useState('')

  async function fetchFlows(url: string, solName?: string) {
    setIsLoading(true)
    setError(null)
    setData(null)
    setSearch('')
    try {
      let resp: Response
      try {
        const params = new URLSearchParams({ environmentUrl: url })
        if (solName) params.set('solutionName', solName)
        resp = await apiFetch(`${API_URL}/api/flows/health?${params}`)
      } catch {
        setError(`Cannot reach the backend server at ${API_URL}. Make sure the backend is running (cd backend, then npm run dev).`)
        return
      }
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? 'Failed to fetch flows')
      setData(json)
      setScannedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setIsLoading(false)
    }
  }

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    fetchFlows(inputUrl.trim(), solutionName || undefined)
  }

  const flows = data?.flows ?? []
  const summary = {
    total:    flows.length,
    enabled:  flows.filter(f => f.enabled).length,
    disabled: flows.filter(f => !f.enabled).length,
    failing:  flows.filter(f => f.failureCount7d > 0).length,
    silent:   flows.filter(f => f.enabled && f.triggerHealth !== 'ok').length,
  }

  const q = search.toLowerCase()
  const filtered = flows.filter(f => {
    if (filter === 'failing')  return f.failureCount7d > 0
    if (filter === 'disabled') return !f.enabled
    if (filter === 'silent')   return f.enabled && f.triggerHealth !== 'ok'
    if (filter === 'healthy')  return f.enabled && f.failureCount7d === 0 && f.triggerHealth === 'ok'
    return true
  }).filter(f => !q || f.name.toLowerCase().includes(q))

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',      label: 'All',      count: summary.total },
    { key: 'failing',  label: 'Failing',  count: summary.failing },
    { key: 'silent',   label: 'Silent',   count: summary.silent },
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
              <SolutionPicker envUrl={inputUrl} value={solutionName} onChange={setSolutionName} />
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
              <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-5 gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
                {[
                  { label: 'Total',        value: summary.total,    color: 'var(--text-primary)' },
                  { label: 'Enabled',      value: summary.enabled,  color: '#4ade80' },
                  { label: 'Disabled',     value: summary.disabled, color: '#94a3b8' },
                  { label: 'Failing (7d)', value: summary.failing,  color: summary.failing > 0 ? '#f87171' : '#4ade80' },
                  { label: 'Silent',       value: summary.silent,   color: summary.silent > 0 ? '#fbbf24' : '#4ade80' },
                ].map(s => (
                  <div key={s.label}>
                    <p className="text-xs tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                    <p className="text-2xl font-display font-semibold mt-1" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Filter tabs + search + meta */}
              <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex gap-2 flex-wrap">
                  {tabs.map(t => (
                    <button key={t.key}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                      onClick={() => { setFilter(t.key); setShowAll(false) }}
                      style={filter === t.key
                        ? { backgroundColor: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }
                        : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)' }
                      }>
                      {t.label} <span className="ml-1 opacity-60">{t.count}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  {scannedAt && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Scanned {Math.floor((Date.now() - scannedAt.getTime()) / 60000) < 1
                        ? 'just now'
                        : `${Math.floor((Date.now() - scannedAt.getTime()) / 60000)}m ago`}
                    </span>
                  )}
                  <input
                    type="text"
                    placeholder="Search flows…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowAll(false) }}
                    className="rounded-lg px-3 py-1.5 text-xs transition-all focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-primary)', width: '160px' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(96,165,250,0.08)' }}
                    onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  <button
                    onClick={() => fetchFlows(inputUrl.trim())}
                    disabled={isLoading}
                    title="Refresh"
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#60a5fa'; e.currentTarget.style.borderColor = 'rgba(96,165,250,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
                  >
                    <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                </div>
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
                        {['Flow Name', 'Status', 'Trigger', 'Last Run', 'When', 'Failures (7d)', 'Last Error'].map((h, i) => (
                          <th key={i} className="px-4 py-3 text-left font-semibold tracking-wider uppercase"
                            style={{ color: 'var(--text-muted)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, showAll ? undefined : 10).map(flow => <FlowRow key={flow.flowId} flow={flow} />)}
                    </tbody>
                  </table>
                  {filtered.length > 10 && (
                    <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                      <button onClick={() => setShowAll(v => !v)}
                        className="text-xs font-medium transition-colors"
                        style={{ color: '#60a5fa' }}>
                        {showAll ? `Show less` : `Show ${filtered.length - 10} more`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--border-bright), transparent)' }} />

        {/* Section 2: Environment Comparison */}
        <section className="space-y-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] uppercase mb-1" style={{ color: '#60a5fa' }}>Section 02</p>
            <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Flow Comparison</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Compare cloud flows between two environments — see what's missing, what's out of sync, and what has undeployed changes.
            </p>
          </div>
          <FlowCompareSection />
        </section>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--border-bright), transparent)' }} />

        {/* Section 3: Connection Reference Health */}
        <section className="space-y-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] uppercase mb-1" style={{ color: '#a78bfa' }}>Section 03</p>
            <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Connection Reference Health</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Scan connection references to see which are broken, their blast radius, and exactly which flows fail with them.
            </p>
          </div>
          <ConnectionRefSection />
        </section>

      </main>
    </>
  )
}
