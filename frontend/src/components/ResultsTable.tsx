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

  const activeCount    = results.filter(r => r.status === 'Active Layer').length
  const unmanagedCount = results.filter(r => r.status === 'Unmanaged').length
  const cleanCount     = results.length - activeCount - unmanagedCount

  const filtered = results
    .filter(r => activeFilter === 'All' || r.status === activeFilter)
    .filter(r => !hideClean || r.status !== 'Base Layer')

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

      {/* Filter toolbar */}
      <div
        className="px-6 py-3 flex items-center justify-between gap-3"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)' }}
      >
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
