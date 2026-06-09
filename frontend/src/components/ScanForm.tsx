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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Environment Configuration
      </h2>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label htmlFor="env-url" className="block text-sm font-medium text-gray-700 mb-1">
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
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       disabled:bg-gray-50 disabled:cursor-not-allowed transition"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isScanning || environmentUrl.trim() === ''}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white
                       hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                       disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors"
          >
            {isScanning ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Scanning…
              </>
            ) : (
              'Run Scan'
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
