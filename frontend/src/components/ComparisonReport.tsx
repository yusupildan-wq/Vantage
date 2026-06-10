import { useState } from 'react'
import { ComparisonReport, ComparisonSection, ComparisonItem, DiffStatus, ComparisonCategory } from '../types'

// ── Config ────────────────────────────────────────────────────────────────

const DIFF_CONFIG: Record<DiffStatus, { color: string; bg: string; border: string; label: string }> = {
  different:   { color: '#fbbf24', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.2)',  label: 'Different'    },
  only_source: { color: '#818cf8', bg: 'rgba(99,102,241,0.07)',  border: 'rgba(99,102,241,0.2)',  label: 'Source Only'  },
  only_target: { color: '#c084fc', bg: 'rgba(192,132,252,0.07)', border: 'rgba(192,132,252,0.2)', label: 'Target Only'  },
  match:       { color: '#4ade80', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.18)',  label: 'Match'        },
}

const CATEGORY_ICONS: Record<ComparisonCategory, React.ReactNode> = {
  'Solutions': (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  ),
  'Environment Variables': (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  ),
  'Connection References': (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  ),
  'Cloud Flows': (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
}

type FilterTab = 'all' | DiffStatus

// ── Sub-components ────────────────────────────────────────────────────────

function DiffBadge({ status }: { status: DiffStatus }) {
  const c = DIFF_CONFIG[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
      style={{ color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
      {c.label}
    </span>
  )
}

function ItemRow({ item }: { item: ComparisonItem }) {
  const isMatch = item.status === 'match'

  return (
    <div
      className="flex items-start gap-3 px-5 py-3 transition-colors duration-75"
      style={{ borderBottom: '1px solid var(--border)' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
    >
      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: isMatch ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
          {item.name}
        </p>
      </div>

      {/* Source value */}
      <div className="w-36 flex-shrink-0 text-right">
        {item.sourceValue ? (
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={
              item.status === 'only_source'
                ? { color: '#818cf8', backgroundColor: 'rgba(99,102,241,0.08)' }
                : item.status === 'different'
                ? { color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.08)' }
                : { color: 'var(--text-secondary)' }
            }
          >
            {item.sourceValue}
          </span>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </div>

      {/* Arrow */}
      <div className="flex-shrink-0 w-5 flex items-center justify-center">
        {item.status === 'different' && (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        )}
      </div>

      {/* Target value */}
      <div className="w-36 flex-shrink-0">
        {item.targetValue ? (
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={
              item.status === 'only_target'
                ? { color: '#c084fc', backgroundColor: 'rgba(192,132,252,0.08)' }
                : item.status === 'different'
                ? { color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.08)' }
                : { color: 'var(--text-secondary)' }
            }
          >
            {item.targetValue}
          </span>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </div>

      {/* Badge */}
      <div className="flex-shrink-0">
        <DiffBadge status={item.status} />
      </div>
    </div>
  )
}

function SectionCard({ section, sourceLabel, targetLabel }: {
  section: ComparisonSection
  sourceLabel: string
  targetLabel: string
}) {
  const counts = {
    different:   section.items.filter(i => i.status === 'different').length,
    only_source: section.items.filter(i => i.status === 'only_source').length,
    only_target: section.items.filter(i => i.status === 'only_target').length,
    match:       section.items.filter(i => i.status === 'match').length,
  }

  const hasDiffs = counts.different + counts.only_source + counts.only_target > 0
  const accentColor = hasDiffs ? '#fbbf24' : '#4ade80'

  const [expanded, setExpanded] = useState(hasDiffs)
  const [filter, setFilter] = useState<FilterTab>('all')

  const visible = filter === 'all' ? section.items : section.items.filter(i => i.status === filter)

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',         label: 'All',          count: section.items.length },
    { key: 'different',   label: 'Different',    count: counts.different },
    { key: 'only_source', label: 'Source Only',  count: counts.only_source },
    { key: 'only_target', label: 'Target Only',  count: counts.only_target },
    { key: 'match',       label: 'Match',        count: counts.match },
  ].filter(t => t.key === 'all' || t.count > 0)

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {/* Header — always visible, clicking it toggles expand */}
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none"
        style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: expanded ? '1px solid var(--border)' : 'none' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          <span style={{ color: accentColor }}>{CATEGORY_ICONS[section.category]}</span>
          <span className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {section.category}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {section.items.length} items
          </span>
        </div>
        <div className="flex items-center gap-2">
          {counts.different > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              {counts.different} diff
            </span>
          )}
          {counts.only_source > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: '#818cf8', backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              +{counts.only_source} source
            </span>
          )}
          {counts.only_target > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: '#c084fc', backgroundColor: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.2)' }}>
              +{counts.only_target} target
            </span>
          )}
          {/* Expand / collapse chevron */}
          <div
            className="ml-1 w-6 h-6 rounded-md flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-mid)' }}
          >
            <svg
              className="w-3.5 h-3.5 transition-transform duration-200"
              style={{
                color: 'var(--text-muted)',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
              fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* Collapsible body */}
      {expanded && (
        <>
          {/* Filter tabs */}
          {TABS.length > 2 && (
            <div
              className="flex gap-1.5 px-5 py-2.5"
              style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
            >
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={e => { e.stopPropagation(); setFilter(t.key) }}
                  className="px-2.5 py-1 text-xs font-medium rounded-full transition-all"
                  style={filter === t.key ? {
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                    border: '1px solid transparent',
                  } : {
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-bright)',
                  }}
                >
                  {t.label}
                  <span className="ml-1.5 opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Column headers */}
          <div
            className="flex items-center gap-3 px-5 py-2"
            style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex-1">
              <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>Name</span>
            </div>
            <div className="w-36 flex-shrink-0 text-right">
              <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#818cf8' }}>
                {sourceLabel}
              </span>
            </div>
            <div className="flex-shrink-0 w-5" />
            <div className="w-36 flex-shrink-0">
              <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: '#c084fc' }}>
                {targetLabel}
              </span>
            </div>
            <div className="flex-shrink-0 w-24" />
          </div>

          {/* Rows */}
          <div style={{ backgroundColor: 'var(--bg-surface)' }}>
            {visible.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No items match this filter.
              </p>
            ) : (
              visible.map((item, i) => <ItemRow key={i} item={item} />)
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

function shortLabel(url: string) {
  try {
    return new URL(url).hostname.split('.')[0].toUpperCase()
  } catch {
    return url.slice(0, 12)
  }
}

export default function ComparisonReportView({ report }: { report: ComparisonReport }) {
  const sourceLabel = shortLabel(report.sourceEnvironment)
  const targetLabel = shortLabel(report.targetEnvironment)
  const totalIssues = report.totalDifferences + report.totalSourceOnly + report.totalTargetOnly
  const isClean = totalIssues === 0

  return (
    <div className="space-y-5 animate-slide-up">

      {/* Summary banner */}
      <div
        className="relative rounded-xl overflow-hidden p-6"
        style={{
          backgroundColor: isClean ? 'rgba(34,197,94,0.05)' : 'rgba(245,158,11,0.05)',
          border: `1px solid ${isClean ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
          boxShadow: `0 0 40px ${isClean ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)'}`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          {/* Left: env labels */}
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-3"
              style={{ color: isClean ? '#4ade80' : '#fbbf24', opacity: 0.7 }}>
              Comparison Report
            </p>
            <div className="flex items-center gap-3 mb-1">
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold font-mono"
                style={{ color: '#818cf8', backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                {sourceLabel}
              </span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold font-mono"
                style={{ color: '#c084fc', backgroundColor: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                {targetLabel}
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {new Date(report.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Right: stats */}
          <div className="flex gap-5">
            {[
              { label: 'Different',   value: report.totalDifferences, color: '#fbbf24' },
              { label: 'Source Only', value: report.totalSourceOnly,  color: '#818cf8' },
              { label: 'Target Only', value: report.totalTargetOnly,  color: '#c084fc' },
              { label: 'Match',       value: report.totalMatches,     color: '#4ade80' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="font-display font-bold text-2xl leading-none" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category sections */}
      {report.sections.map(section => (
        <SectionCard
          key={section.category}
          section={section}
          sourceLabel={sourceLabel}
          targetLabel={targetLabel}
        />
      ))}
    </div>
  )
}
