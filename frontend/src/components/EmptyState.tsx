export default function EmptyState() {
  return (
    <div
      className="rounded-xl py-20 flex flex-col items-center gap-4"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px dashed var(--border-mid)',
      }}
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-1"
        style={{
          background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))',
          border: '1px solid var(--border-mid)',
        }}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.3}
          stroke="currentColor"
          style={{ color: 'var(--text-muted)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      </div>
      <p className="font-display font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>
        No scan results yet
      </p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Enter an environment URL above and run a scan to begin.
      </p>
    </div>
  )
}
