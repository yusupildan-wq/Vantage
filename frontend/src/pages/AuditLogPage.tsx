import { useEffect, useMemo, useState } from 'react'
import { apiFetch, API_URL } from '../api'
import { AuditAction, AuditEvent } from '../types'

type LoadState = 'loading' | 'ready' | 'error'
type StatusFilter = 'all' | 'success' | 'failure'
type SystemFilter = 'all' | 'Dataverse' | 'Azure DevOps'

const ACTION_LABEL: Record<AuditAction, string> = {
  option_set_restore: 'Option Set Restore',
  connection_ref_auto_fix: 'Connection Ref Auto-Fix',
  pipeline_cancel: 'Pipeline Cancel',
  pipeline_retry: 'Pipeline Retry',
  optimizer_apply: 'Optimizer PR',
  optimizer_apply_repo: 'Optimizer Repo PRs',
}

function StatusBadge({ status }: { status: AuditEvent['status'] }) {
  const style = status === 'success'
    ? { color: '#4ade80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.22)', label: 'Success' }
    : { color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.24)', label: 'Failure' }
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: style.color, backgroundColor: style.bg, border: `1px solid ${style.border}` }}>
      {style.label}
    </span>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function metadataRows(metadata: AuditEvent['metadata']) {
  if (!metadata) return []
  return Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined)
}

export default function AuditLogPage() {
  const [state, setState] = useState<LoadState>('loading')
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [systemFilter, setSystemFilter] = useState<SystemFilter>('all')

  async function loadAuditLog() {
    setState('loading')
    setError(null)
    try {
      const resp = await apiFetch(`${API_URL}/api/audit-log?limit=200`)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? 'Failed to load audit log')
      setEvents(data.events ?? [])
      setState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to backend')
      setState('error')
    }
  }

  useEffect(() => {
    loadAuditLog()
  }, [])

  const filtered = useMemo(() => events.filter(event => {
    if (statusFilter !== 'all' && event.status !== statusFilter) return false
    if (systemFilter !== 'all' && event.targetSystem !== systemFilter) return false
    return true
  }), [events, statusFilter, systemFilter])

  const successCount = events.filter(event => event.status === 'success').length
  const failureCount = events.filter(event => event.status === 'failure').length

  return (
    <>
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(129,140,248,0.05) 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(129,140,248,0.42), transparent)' }}
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-16 animate-fade-in">
          <p className="text-xs font-semibold tracking-[0.28em] uppercase mb-4" style={{ color: 'var(--accent-bright)' }}>
            Change History
          </p>
          <h1 className="font-display font-semibold leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: 'var(--text-primary)' }}>
            Audit Log
          </h1>
          <p className="text-sm mt-3 max-w-xl" style={{ color: 'var(--text-secondary)' }}>
            Review confirmed external actions across Dataverse and Azure DevOps.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-5 animate-slide-up">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-lg px-5 py-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Events</p>
            <p className="font-display text-2xl font-semibold" style={{ color: 'var(--accent-bright)' }}>{events.length}</p>
          </div>
          <div className="rounded-lg px-5 py-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Success</p>
            <p className="font-display text-2xl font-semibold" style={{ color: '#4ade80' }}>{successCount}</p>
          </div>
          <div className="rounded-lg px-5 py-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Failures</p>
            <p className="font-display text-2xl font-semibold" style={{ color: '#f87171' }}>{failureCount}</p>
          </div>
          <button
            onClick={loadAuditLog}
            disabled={state === 'loading'}
            className="rounded-lg px-5 py-4 text-left transition-all disabled:opacity-40"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Refresh</p>
            <p className="text-sm font-semibold">{state === 'loading' ? 'Loading...' : 'Reload Events'}</p>
          </button>
        </div>

        <div className="rounded-xl px-5 py-4 flex flex-wrap gap-3" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {(['all', 'success', 'failure'] as StatusFilter[]).map(filter => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={statusFilter === filter
                ? { backgroundColor: 'rgba(129,140,248,0.12)', color: 'var(--accent-bright)', border: '1px solid rgba(129,140,248,0.3)' }
                : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-mid)' }}
            >
              {filter === 'all' ? 'All Statuses' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
          {(['all', 'Dataverse', 'Azure DevOps'] as SystemFilter[]).map(filter => (
            <button
              key={filter}
              onClick={() => setSystemFilter(filter)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={systemFilter === filter
                ? { backgroundColor: 'rgba(45,212,191,0.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)' }
                : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-mid)' }}
            >
              {filter === 'all' ? 'All Systems' : filter}
            </button>
          ))}
        </div>

        {state === 'error' && error && (
          <div className="rounded-xl px-5 py-4 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <section className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
            <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Events</h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length} shown</span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No audit events yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Confirmed restore, pipeline, and optimizer actions will appear here.
              </p>
            </div>
          ) : (
            <div>
              {filtered.map(event => (
                <div key={event.id} className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="lg:w-40 flex-shrink-0">
                      <StatusBadge status={event.status} />
                      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{formatTime(event.timestamp)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ACTION_LABEL[event.action]}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#2dd4bf', backgroundColor: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.2)' }}>
                          {event.targetSystem}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{event.summary}</p>
                      <p className="text-xs font-mono mt-1 break-words" style={{ color: 'var(--text-muted)' }}>{event.target}</p>
                      {metadataRows(event.metadata).length > 0 && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                          {metadataRows(event.metadata).map(([key, value]) => (
                            <div key={key} className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                              <p className="text-[10px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--text-muted)' }}>{key}</p>
                              <p className="text-xs break-words" style={{ color: 'var(--text-secondary)' }}>
                                {Array.isArray(value) ? value.join(', ') : String(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
