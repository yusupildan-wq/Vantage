interface ScanFormProps {
  environmentUrl: string
  isScanning: boolean
  onChange: (url: string) => void
  onScan: () => void
}

export default function ScanForm({ environmentUrl, isScanning, onChange, onScan }: ScanFormProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onScan()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-xl overflow-hidden gradient-top-line"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="px-6 py-6">
        <p
          className="text-xs font-semibold tracking-[0.22em] uppercase mb-5"
          style={{ color: 'var(--text-muted)' }}
        >
          Environment Configuration
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label
              htmlFor="env-url"
              className="block text-xs font-medium tracking-wider uppercase mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Environment URL
            </label>
            <input
              id="env-url"
              type="url"
              placeholder="https://yourorg.crm.dynamics.com"
              value={environmentUrl}
              onChange={(e) => onChange(e.target.value)}
              required
              disabled={isScanning}
              className="w-full rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-mid)',
                color: 'var(--text-primary)',
                caretColor: 'var(--accent-bright)',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(129,140,248,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(91,95,199,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isScanning || environmentUrl.trim() === ''}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30"
              style={{
                backgroundColor: 'var(--accent)',
                boxShadow: '0 0 24px var(--accent-glow)',
              }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--accent-bright)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--accent)' }}
            >
              {isScanning ? (
                <>
                  <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Scanning
                </>
              ) : (
                'Run Scan'
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
