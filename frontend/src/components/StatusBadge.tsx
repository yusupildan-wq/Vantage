import { ComponentStatus } from '../types'

const BADGE_CONFIG: Record<ComponentStatus, { dot: string; color: string; bg: string; border: string }> = {
  'Active Layer': {
    dot:    '#f59e0b',
    color:  '#fbbf24',
    bg:     'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.2)',
  },
  'Base Layer': {
    dot:    '#22c55e',
    color:  '#4ade80',
    bg:     'rgba(34,197,94,0.07)',
    border: 'rgba(34,197,94,0.18)',
  },
  'Unmanaged': {
    dot:    '#6b7280',
    color:  '#9ca3af',
    bg:     'rgba(107,114,128,0.07)',
    border: 'rgba(107,114,128,0.18)',
  },
}

interface StatusBadgeProps {
  status: ComponentStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const c = BADGE_CONFIG[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: c.dot, boxShadow: `0 0 5px ${c.dot}80` }}
      />
      {status}
    </span>
  )
}
