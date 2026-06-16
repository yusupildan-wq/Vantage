import { useState } from 'react'
import { ScanResult, ComponentStatus } from '../types'
import StatusBadge from './StatusBadge'

type Filter = 'All' | ComponentStatus

interface ResultsTableProps {
  results: ScanResult[]
}

const FILTERS: Filter[] = ['All', 'Active Layer', 'Unmanaged', 'Base Layer']
const DEFAULT_VISIBLE = 10

export default function ResultsTable({ results }: ResultsTableProps) {
  const [activeFilter, setActiveFilter] = useState<Filter>('All')
  const [hideClean, setHideClean] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [search, setSearch] = useState('')

  const activeCount    = results.filter(r => r.status === 'Active Layer').length
  const unmanagedCount = results.filter(r => r.status === 'Unmanaged').length
  const cleanCount     = results.length - activeCount - unmanagedCount

  const q = search.toLowerCase()
  const filtered = results
    .filter(r => activeFilter === 'All' || r.status === activeFilter)
    .filter(r => !hideClean || r.status !== 'Base Layer')
    .filter(r => !q || r.componentName.toLowerCase().includes(q) || r.componentType.toLowerCase().includes(q))

  const visible = showAll ? filtered : filtered.slice(0, DEFAULT_VISIBLE)
  const hasMore = filtered.length > DEFAULT_VISIBLE

  return (
    <div
      className="relative rounded-xl overflow-hidden gradient-top-line"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      {/* Header row */}
      <div
        className="px-6 py-5 flex flex-wrap items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            Scan Results
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {results.length} components scanned
          </p>
        </div>

        <div className="flex items-center gap-4">

        {/* Export CSV */}
        <button
          onClick={() => {
            const headers = ['Component', 'Type', 'Status', 'Message']
            const rows = filtered.map(r => [r.componentName, r.componentType, r.status, r.message].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            const csv = [headers.join(','), ...rows].join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `active-layer-scan-${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            URL.revokeObjectURL(a.href)
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
          style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-bright)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>

        {/* Stats */}
        <div className="flex items-center gap-6">
          {[
            { label: 'Active Layer', value: activeCount, color: '#fbbf24' },
            { label: 'Unmanaged',    value: unmanagedCount, color: 'var(--text-secondary)' },
            { label: 'Clean',        value: cleanCount, color: '#4ade80' },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center gap-4">
              {i > 0 && <div className="h-7 w-px" style={{ backgroundColor: 'var(--border-mid)' }} />}
              <div className="text-right">
                <p className="font-display text-xl font-semibold leading-none" style={{ color: s.color }}>
                  {s.value}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* Search + filter toolbar */}
      <div
        className="px-6 py-3 flex flex-wrap items-center justify-between gap-3"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)' }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="Search components…"
          value={search}
          onChange={e => { setSearch(e.target.value); setShowAll(false) }}
          className="rounded-lg px-3 py-1.5 text-xs transition-all focus:outline-none"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-mid)',
            color: 'var(--text-primary)',
            width: '180px',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(129,140,248,0.45)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(91,95,199,0.08)' }}
          onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)';      e.currentTarget.style.boxShadow = 'none' }}
        />

        {/* Filter pills + hide clean */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {FILTERS.map(f => {
              const isActive = activeFilter === f
              return (
                <button
                  key={f}
                  onClick={() => { setActiveFilter(f); setShowAll(false) }}
                  className="px-3 py-1 text-xs font-medium rounded-full transition-all duration-150"
                  style={isActive ? {
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                    border: '1px solid transparent',
                  } : {
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-bright)',
                  }}
                >
                  {f}
                  {f !== 'All' && (
                    <span className="ml-1.5 opacity-50">
                      {f === 'Active Layer' ? activeCount : f === 'Unmanaged' ? unmanagedCount : cleanCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setHideClean(v => !v)}
            className="px-3 py-1 text-xs font-medium rounded-full transition-all duration-150"
            style={hideClean ? {
              backgroundColor: 'rgba(34,197,94,0.07)',
              color: '#4ade80',
              border: '1px solid rgba(34,197,94,0.2)',
            } : {
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-bright)',
            }}
          >
            {hideClean ? 'Clean hidden' : 'Hide clean'}
            <span className="ml-1.5 opacity-50">({cleanCount})</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Component', 'Type', 'Status', 'Message'].map(col => (
                <th
                  key={col}
                  className="px-6 py-3 text-left text-xs font-semibold tracking-[0.15em] uppercase"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-14 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No components match this filter.
                </td>
              </tr>
            ) : (
              visible.map((row, i) => (
                <tr
                  key={row.id}
                  className="transition-colors duration-75"
                  style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : undefined }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                >
                  <td className="px-6 py-3.5 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                    {row.componentName}
                  </td>
                  <td className="px-6 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {row.componentType}
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-6 py-3.5 text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
                    {row.message}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Show more/less footer */}
      {hasMore && (
        <div
          className="px-6 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {showAll ? filtered.length : DEFAULT_VISIBLE} / {filtered.length}
          </span>
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--accent-bright)' }}
          >
            {showAll ? '↑ Show Less' : `Show ${filtered.length - DEFAULT_VISIBLE} more ↓`}
          </button>
        </div>
      )}
    </div>
  )
}
