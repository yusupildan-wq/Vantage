import { useState, useEffect, useCallback } from 'react'
import { useEnvironmentUrl } from '../hooks/useEnvironmentUrl'
import { apiFetch, API_URL } from '../api'

type RunStatus = 'succeeded' | 'partiallySucceeded' | 'failed' | 'running' | 'pending' | 'cancelled' | 'unknown'
type StatusFilter = 'all' | RunStatus
type TimeRange = 7 | 30 | 90 | 0

interface PipelineRun {
  id: number
  buildNumber: string
  pipelineId: number
  pipelineName: string
  pipelineFolder: string
  status: RunStatus
  branch: string
  reason: string
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  triggeredBy: string
}

interface PipelineSummary {
  pipelineId: number
  pipelineName: string
  pipelineFolder: string
  totalRuns: number
  successCount: number
  failureCount: number
  successRate: number
  avgDurationMs: number | null
  lastRunAt: string | null
  lastRunStatus: string | null
}

interface PipelineHealthResponse {
  organization: string
  project: string
  totalRuns: number
  successCount: number
  failureCount: number
  avgDurationMs: number | null
  pipelines: PipelineSummary[]
  runs: PipelineRun[]
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function buildSparkline(pipelineId: number, allRuns: PipelineRun[], buckets = 10): number[] {
  const pRuns = allRuns
    .filter(r => r.pipelineId === pipelineId && r.startedAt)
    .sort((a, b) => new Date(a.startedAt!).getTime() - new Date(b.startedAt!).getTime())
  if (pRuns.length < 2) return []
  const oldest = new Date(pRuns[0].startedAt!).getTime()
  const newest = new Date(pRuns[pRuns.length - 1].startedAt!).getTime()
  const range = newest - oldest
  if (range === 0) return [pRuns[0].status === 'succeeded' ? 100 : 0]
  return Array.from({ length: buckets }, (_, i) => {
    const start = oldest + (i / buckets) * range
    const end = oldest + ((i + 1) / buckets) * range
    const bucket = pRuns.filter(r => {
      const t = new Date(r.startedAt!).getTime()
      return t >= start && t < (i === buckets - 1 ? end + 1 : end)
    })
    if (bucket.length === 0) return -1
    return Math.round((bucket.filter(r => r.status === 'succeeded').length / bucket.length) * 100)
  })
}

function detectFlaky(allRuns: PipelineRun[]): Set<number> {
  const flaky = new Set<number>()
  const byPipeline = new Map<number, PipelineRun[]>()
  for (const r of allRuns) {
    if (!byPipeline.has(r.pipelineId)) byPipeline.set(r.pipelineId, [])
    byPipeline.get(r.pipelineId)!.push(r)
  }
  for (const [id, pRuns] of byPipeline) {
    let flipCount = 0
    for (let i = 0; i < pRuns.length - 1; i++) {
      if (pRuns[i].status === 'succeeded' && pRuns[i + 1].status === 'failed') flipCount++
    }
    if (flipCount >= 2 || (pRuns.length >= 5 && flipCount / pRuns.length >= 0.25)) {
      flaky.add(id)
    }
  }
  return flaky
}

const STATUS_CFG: Record<RunStatus, { label: string; color: string; bg: string; border: string }> = {
  succeeded:          { label: 'Succeeded',    color: '#4ade80', bg: 'rgba(34,197,94,0.07)',    border: 'rgba(34,197,94,0.22)' },
  partiallySucceeded: { label: 'Partial',      color: '#fbbf24', bg: 'rgba(245,158,11,0.07)',   border: 'rgba(245,158,11,0.22)' },
  failed:             { label: 'Failed',       color: '#f87171', bg: 'rgba(239,68,68,0.07)',    border: 'rgba(239,68,68,0.22)' },
  running:            { label: 'Running',      color: '#2dd4bf', bg: 'rgba(45,212,191,0.07)',   border: 'rgba(45,212,191,0.22)' },
  pending:            { label: 'Pending',      color: '#94a3b8', bg: 'rgba(148,163,184,0.07)',  border: 'rgba(148,163,184,0.2)' },
  cancelled:          { label: 'Cancelled',    color: '#94a3b8', bg: 'rgba(148,163,184,0.07)',  border: 'rgba(148,163,184,0.2)' },
  unknown:            { label: 'Unknown',      color: '#94a3b8', bg: 'rgba(148,163,184,0.07)',  border: 'rgba(148,163,184,0.2)' },
}

function StatusBadge({ status }: { status: RunStatus }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.unknown
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  )
}

function SuccessRatePill({ rate }: { rate: number }) {
  const color = rate >= 90 ? '#4ade80' : rate >= 70 ? '#fbbf24' : '#f87171'
  const bg    = rate >= 90 ? 'rgba(34,197,94,0.07)'   : rate >= 70 ? 'rgba(245,158,11,0.07)' : 'rgba(239,68,68,0.07)'
  const bdr   = rate >= 90 ? 'rgba(34,197,94,0.22)'   : rate >= 70 ? 'rgba(245,158,11,0.22)' : 'rgba(239,68,68,0.22)'
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color, backgroundColor: bg, border: `1px solid ${bdr}` }}>
      {rate}%
    </span>
  )
}

function StatCard({ label, value, sub, accent = '#2dd4bf' }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="relative rounded-xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }} />
      <div className="px-5 py-5">
        <p className="text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="font-display text-3xl font-semibold" style={{ color: accent }}>{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function Sparkline({ data, width = 72, height = 22 }: { data: number[]; width?: number; height?: number }) {
  const valid = data.filter(d => d >= 0)
  if (valid.length < 2) return <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>—</span>
  const points = data
    .map((v, i) => ({ x: (i / (data.length - 1)) * width, y: v < 0 ? null : height - (v / 100) * (height - 2) - 1 }))
    .filter((p): p is { x: number; y: number } => p.y !== null)
  if (points.length < 2) return <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>—</span>
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const last = valid[valid.length - 1]
  const color = last >= 90 ? '#4ade80' : last >= 70 ? '#fbbf24' : '#f87171'
  const lastPt = points[points.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      <circle cx={lastPt.x} cy={lastPt.y} r={2} fill={color} />
    </svg>
  )
}

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',               label: 'All' },
  { key: 'succeeded',         label: 'Succeeded' },
  { key: 'failed',            label: 'Failed' },
  { key: 'partiallySucceeded',label: 'Partial' },
  { key: 'running',           label: 'Running' },
  { key: 'pending',           label: 'Pending' },
  { key: 'cancelled',         label: 'Cancelled' },
]

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: '7d',  value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: 'All', value: 0 },
]

export default function PipelinesPage() {
  const [projectUrl, setProjectUrl] = useEnvironmentUrl('vtg_devops_url')
  const [isLoading, setIsLoading]   = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [data, setData]             = useState<PipelineHealthResponse | null>(null)
  const [filter, setFilter]         = useState<StatusFilter>('all')
  const [search, setSearch]         = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showAllRuns, setShowAllRuns]             = useState(false)
  const [showAllPipelines, setShowAllPipelines]   = useState(false)
  const [timeRange, setTimeRange]   = useState<TimeRange>(30)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const RUNS_PAGE      = 25
  const PIPELINES_PAGE = 5

  const fetchData = useCallback(async (silent = false) => {
    if (!projectUrl.trim()) return
    if (!silent) {
      setIsLoading(true)
      setData(null)
      setExpandedId(null)
      setShowAllRuns(false)
      setShowAllPipelines(false)
    }
    setError(null)
    try {
      const params = new URLSearchParams({ projectUrl: projectUrl.trim() })
      if (timeRange > 0) params.set('days', String(timeRange))
      let resp: Response
      try {
        resp = await apiFetch(`${API_URL}/api/pipelines/health?${params}`)
      } catch {
        setError(`Cannot reach the backend at ${API_URL}. Make sure it's running.`)
        return
      }
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? 'Failed to load pipeline data')
      setData(json)
      setLastRefreshed(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipeline data')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [projectUrl, timeRange])

  useEffect(() => {
    if (!autoRefresh || !data) return
    const id = setInterval(() => fetchData(true), 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [autoRefresh, data, fetchData])

  function handleLoad(e: React.FormEvent) {
    e.preventDefault()
    fetchData(false)
  }

  const runs = data?.runs ?? []

  const filtered = runs.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.pipelineName.toLowerCase().includes(q) ||
             r.branch.toLowerCase().includes(q) ||
             r.buildNumber.toLowerCase().includes(q)
    }
    return true
  })

  const visibleRuns      = showAllRuns      ? filtered              : filtered.slice(0, RUNS_PAGE)
  const visiblePipelines = showAllPipelines ? data?.pipelines ?? [] : (data?.pipelines ?? []).slice(0, PIPELINES_PAGE)

  const flaky            = data ? detectFlaky(data.runs) : new Set<number>()
  const sparklines       = data
    ? new Map(data.pipelines.map(p => [p.pipelineId, buildSparkline(p.pipelineId, data.runs)]))
    : new Map<number, number[]>()
  const slowestPipelines = data
    ? [...data.pipelines].filter(p => p.avgDurationMs !== null).sort((a, b) => (b.avgDurationMs ?? 0) - (a.avgDurationMs ?? 0)).slice(0, 5)
    : []
  const needsAttention   = data
    ? [...data.pipelines].filter(p => p.failureCount > 0).sort((a, b) => b.failureCount - a.failureCount).slice(0, 5)
    : []

  const overallSuccessRate = data && data.totalRuns > 0
    ? Math.round((data.successCount / data.totalRuns) * 100)
    : 0

  const filterCounts = FILTERS.reduce((acc, f) => {
    acc[f.key] = f.key === 'all' ? runs.length : runs.filter(r => r.status === f.key).length
    return acc
  }, {} as Record<StatusFilter, number>)

  const inputStyle = {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-mid)',
    color: 'var(--text-primary)',
    caretColor: '#2dd4bf',
  }

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(45,212,191,0.06) 0%, transparent 70%)' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.45), transparent)' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-16 animate-fade-in">
          <p className="text-xs font-semibold tracking-[0.28em] uppercase mb-4" style={{ color: '#2dd4bf' }}>
            Feature 06
          </p>
          <h1 className="font-display font-semibold leading-tight text-gradient"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}>
            Pipeline Health Dashboard
          </h1>
          <p className="text-sm mt-3 max-w-lg" style={{ color: 'var(--text-secondary)' }}>
            Monitor Azure DevOps pipeline runs — track success rates, durations, and failures across all pipelines in a project.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-5 animate-slide-up">

        {/* Form */}
        <form onSubmit={handleLoad}
          className="relative rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.5), transparent)' }} />
          <div className="px-6 py-6 space-y-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                Azure DevOps Project URL
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Enter the URL of your Azure DevOps project — the same URL you see in your browser on the Pipelines page.
              </p>
            </div>
            <div className="flex gap-3">
              <input
                type="url"
                placeholder="https://dev.azure.com/your-org/your-project"
                value={projectUrl}
                onChange={e => setProjectUrl(e.target.value)}
                required
                disabled={isLoading}
                className="flex-1 rounded-lg px-4 py-3 text-sm transition-all focus:outline-none disabled:opacity-40"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(45,212,191,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(45,212,191,0.08)' }}
                onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }}
              />
              <button
                type="submit"
                disabled={isLoading || !projectUrl.trim()}
                className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                style={{ backgroundColor: '#0f766e', boxShadow: '0 0 20px rgba(15,118,110,0.3)' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#0d9488' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0f766e' }}
              >
                {isLoading
                  ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Loading…</>
                  : 'Load Pipeline Data'}
              </button>
            </div>

            {/* Time range + auto-refresh */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Time range:</span>
                <div className="flex gap-1">
                  {TIME_RANGES.map(tr => (
                    <button key={tr.value} type="button"
                      onClick={() => setTimeRange(tr.value)}
                      className="text-xs px-3 py-1 rounded-md font-medium transition-all"
                      style={timeRange === tr.value
                        ? { backgroundColor: 'rgba(45,212,191,0.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)' }
                        : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-mid)' }}>
                      {tr.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button"
                onClick={() => setAutoRefresh(v => !v)}
                className="flex items-center gap-2 text-xs px-3 py-1 rounded-md font-medium transition-all"
                style={autoRefresh
                  ? { backgroundColor: 'rgba(45,212,191,0.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)' }
                  : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-mid)' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-teal-400 animate-pulse' : 'bg-slate-500'}`} />
                Auto-refresh {autoRefresh ? 'on' : 'off'}
                {autoRefresh && lastRefreshed && (
                  <span className="opacity-60">· {timeAgo(lastRefreshed.toISOString())}</span>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="rounded-xl px-5 py-4"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}>
            <p className="text-sm font-semibold mb-1">Failed to load pipeline data</p>
            <p className="text-xs opacity-80">{error}</p>
            {error.includes('AZURE_DEVOPS_PAT') && (
              <p className="text-xs mt-2 opacity-70">
                Add your Azure DevOps PAT to <code className="font-mono">backend/.env</code> as <code className="font-mono">AZURE_DEVOPS_PAT</code>.
                Generate one at: Azure DevOps → User Settings → Personal Access Tokens (scope: Build → Read).
              </p>
            )}
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Runs" value={data.totalRuns}
                sub={timeRange > 0 ? `last ${timeRange} days` : 'all time'} />
              <StatCard
                label="Success Rate"
                value={`${overallSuccessRate}%`}
                sub={`${data.successCount} succeeded`}
                accent={overallSuccessRate >= 90 ? '#4ade80' : overallSuccessRate >= 70 ? '#fbbf24' : '#f87171'}
              />
              <StatCard label="Avg Duration" value={formatDuration(data.avgDurationMs)} sub="completed runs" />
              <StatCard
                label="Failures"
                value={data.failureCount}
                sub={data.failureCount > 0 ? 'need attention' : 'all clear'}
                accent={data.failureCount > 0 ? '#f87171' : '#4ade80'}
              />
            </div>

            {/* Insights row */}
            {(needsAttention.length > 0 || slowestPipelines.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Needs Attention */}
                {needsAttention.length > 0 && (
                  <div className="relative rounded-xl overflow-hidden"
                    style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(239,68,68,0.18)' }}>
                    <div className="absolute top-0 left-0 right-0 h-px"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)' }} />
                    <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                      <h3 className="font-display font-semibold text-sm" style={{ color: '#f87171' }}>
                        Needs Attention
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Pipelines with the most failures
                      </p>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {needsAttention.map((p, i) => (
                        <div key={p.pipelineId} className="px-5 py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xs font-mono w-4 shrink-0" style={{ color: 'var(--text-muted)' }}>
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}
                                title={p.pipelineName}>{p.pipelineName}</p>
                              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.pipelineFolder}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {flaky.has(p.pipelineId) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                style={{ color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                Flaky
                              </span>
                            )}
                            <SuccessRatePill rate={p.successRate} />
                            <span className="text-xs" style={{ color: '#f87171' }}>{p.failureCount} fails</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Slowest Pipelines */}
                {slowestPipelines.length > 0 && (
                  <div className="relative rounded-xl overflow-hidden"
                    style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(251,191,36,0.18)' }}>
                    <div className="absolute top-0 left-0 right-0 h-px"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)' }} />
                    <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                      <h3 className="font-display font-semibold text-sm" style={{ color: '#fbbf24' }}>
                        Slowest Pipelines
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Ranked by average run duration
                      </p>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {slowestPipelines.map((p, i) => {
                        const avgAll = data.pipelines.filter(x => x.avgDurationMs).reduce((s, x) => s + (x.avgDurationMs ?? 0), 0) / data.pipelines.filter(x => x.avgDurationMs).length
                        const ratio = avgAll > 0 ? (p.avgDurationMs ?? 0) / avgAll : 1
                        return (
                          <div key={p.pipelineId} className="px-5 py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-xs font-mono w-4 shrink-0" style={{ color: 'var(--text-muted)' }}>
                                {i + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}
                                  title={p.pipelineName}>{p.pipelineName}</p>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.pipelineFolder}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-mono" style={{ color: '#fbbf24' }}>
                                {formatDuration(p.avgDurationMs)}
                              </span>
                              {ratio > 1.5 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                  style={{ color: '#f87171', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                                  {ratio.toFixed(1)}× avg
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Per-pipeline summary */}
            {data.pipelines.length > 0 && (
              <div className="relative rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.4), transparent)' }} />
                <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                    Pipelines — {data.organization} / {data.project}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {data.pipelines.length} pipeline{data.pipelines.length !== 1 ? 's' : ''} with recent runs
                    {flaky.size > 0 && <span className="ml-2" style={{ color: '#fbbf24' }}>· {flaky.size} flaky</span>}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Pipeline', 'Trend', 'Runs', 'Success Rate', 'Avg Duration', 'Last Run', 'Last Status'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                            style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePipelines.map((p, i) => (
                        <tr key={p.pipelineId}
                          style={{ borderBottom: i < visiblePipelines.length - 1 ? '1px solid var(--border)' : undefined }}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                {p.pipelineName}
                              </span>
                              {flaky.has(p.pipelineId) && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                  style={{ color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                  Flaky
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.pipelineFolder}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <Sparkline data={sparklines.get(p.pipelineId) ?? []} />
                          </td>
                          <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {p.totalRuns}
                          </td>
                          <td className="px-5 py-3.5">
                            <SuccessRatePill rate={p.successRate} />
                          </td>
                          <td className="px-5 py-3.5 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                            {formatDuration(p.avgDurationMs)}
                          </td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {timeAgo(p.lastRunAt)}
                          </td>
                          <td className="px-5 py-3.5">
                            {p.lastRunStatus
                              ? <StatusBadge status={p.lastRunStatus as RunStatus} />
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(data?.pipelines ?? []).length > PIPELINES_PAGE && (
                  <div className="px-6 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => setShowAllPipelines(v => !v)}
                      className="text-xs font-medium transition-colors"
                      style={{ color: '#2dd4bf' }}>
                      {showAllPipelines
                        ? '↑ Show less'
                        : `↓ Show ${(data?.pipelines ?? []).length - PIPELINES_PAGE} more pipelines`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Run history */}
            <div className="relative rounded-xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.4), transparent)' }} />

              <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                      Run History
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Showing {filtered.length} of {runs.length} runs
                    </p>
                  </div>
                  <input
                    type="text"
                    placeholder="Search pipeline or branch…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="rounded-lg px-3 py-2 text-xs w-56 focus:outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(45,212,191,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(45,212,191,0.06)' }}
                    onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {FILTERS.map(f => {
                    const count = filterCounts[f.key] ?? 0
                    if (f.key !== 'all' && count === 0) return null
                    const active = filter === f.key
                    return (
                      <button key={f.key} onClick={() => setFilter(f.key)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                        style={active
                          ? { backgroundColor: 'rgba(45,212,191,0.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)' }
                          : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-mid)' }}>
                        {f.label}
                        <span className="ml-1.5 opacity-60">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {runs.length === 0 ? 'No pipeline runs found.' : 'No runs match the current filter.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['#', 'Pipeline', 'Branch', 'Trigger', 'Status', 'Started', 'Duration', 'By', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                            style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRuns.map((run, i) => {
                        const isExpanded = expandedId === run.id
                        const isLast = i === visibleRuns.length - 1
                        return (
                          <>
                            <tr key={run.id}
                              onClick={() => setExpandedId(isExpanded ? null : run.id)}
                              className="cursor-pointer transition-colors duration-150"
                              style={{
                                borderBottom: (!isExpanded && !isLast) ? '1px solid var(--border)' : undefined,
                                backgroundColor: isExpanded ? 'rgba(45,212,191,0.03)' : undefined,
                              }}
                              onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)' }}
                              onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
                            >
                              <td className="px-4 py-3.5">
                                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                                  #{run.buildNumber}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 max-w-[220px]">
                                <p className="font-medium text-xs truncate" style={{ color: 'var(--text-primary)' }} title={run.pipelineName}>
                                  {run.pipelineName}
                                </p>
                                <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                                  {run.pipelineFolder}
                                </p>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="text-xs font-mono truncate max-w-[100px] block" style={{ color: 'var(--text-secondary)' }} title={run.branch}>
                                  {run.branch || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{run.reason}</span>
                              </td>
                              <td className="px-4 py-3.5">
                                <StatusBadge status={run.status} />
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}
                                  title={formatDate(run.startedAt)}>
                                  {timeAgo(run.startedAt)}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                                {formatDuration(run.durationMs)}
                              </td>
                              <td className="px-4 py-3.5 text-xs max-w-[110px] truncate" style={{ color: 'var(--text-muted)' }}
                                title={run.triggeredBy}>
                                {run.triggeredBy}
                              </td>
                              <td className="px-4 py-3.5">
                                <svg className="w-3.5 h-3.5 transition-transform duration-200"
                                  style={{ color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                  fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr key={`${run.id}-detail`}
                                style={{ borderBottom: !isLast ? '1px solid var(--border)' : undefined }}>
                                <td colSpan={9} className="px-5 pb-4 pt-0">
                                  <div className="rounded-lg p-4 space-y-3"
                                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                      <div>
                                        <p className="uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Started</p>
                                        <p style={{ color: 'var(--text-primary)' }}>{formatDate(run.startedAt)}</p>
                                      </div>
                                      {run.completedAt && (
                                        <div>
                                          <p className="uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Completed</p>
                                          <p style={{ color: 'var(--text-primary)' }}>{formatDate(run.completedAt)}</p>
                                        </div>
                                      )}
                                      <div>
                                        <p className="uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Duration</p>
                                        <p className="font-mono" style={{ color: 'var(--text-primary)' }}>{formatDuration(run.durationMs)}</p>
                                      </div>
                                      <div>
                                        <p className="uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Build ID</p>
                                        <p className="font-mono" style={{ color: 'var(--text-muted)' }}>{run.id}</p>
                                      </div>
                                    </div>
                                    {run.status === 'succeeded' && (
                                      <p className="text-xs" style={{ color: '#4ade80' }}>Pipeline completed successfully.</p>
                                    )}
                                    {run.status === 'partiallySucceeded' && (
                                      <p className="text-xs" style={{ color: '#fbbf24' }}>Pipeline partially succeeded — some stages may have failed.</p>
                                    )}
                                    {(run.status === 'failed' || run.status === 'cancelled') && (
                                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        Open build #{run.buildNumber} in Azure DevOps to see the full logs and error details.
                                      </p>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {filtered.length > RUNS_PAGE && (
                <div className="px-6 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => setShowAllRuns(v => !v)}
                    className="text-xs font-medium transition-colors"
                    style={{ color: '#2dd4bf' }}>
                    {showAllRuns
                      ? '↑ Show less'
                      : `↓ Show ${filtered.length - RUNS_PAGE} more runs`}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  )
}
