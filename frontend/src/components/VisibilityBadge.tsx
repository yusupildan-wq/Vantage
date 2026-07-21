export default function VisibilityBadge({ isHidden }: { isHidden: boolean | null }) {
  if (isHidden === null) {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>
  }
  return isHidden ? (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{ color: '#f87171', backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}
    >
      Hidden
    </span>
  ) : (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{ color: '#4ade80', backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)' }}
    >
      Shown
    </span>
  )
}
