import { useState } from 'react'
import { useEnvironmentUrl } from '../hooks/useEnvironmentUrl'

export default function OptionSetComparison() {
  const [compareSourceUrl, setCompareSourceUrl] = useEnvironmentUrl()
  const [compareTargetUrl, setCompareTargetUrl] = useEnvironmentUrl('ala_target_url')
  const [comparisonResults, setComparisonResults] = useState<any>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [comparisonError, setComparisonError] = useState<string | null>(null)

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

  async function handleCompare() {
    setIsComparing(true)
    setComparisonError(null)
    setComparisonResults(null)
    try {
      const resp = await fetch(`${apiUrl}/api/optionsets/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: compareSourceUrl.trim(),
          targetUrl: compareTargetUrl.trim(),
        }),
      })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error ?? 'Comparison failed')
      }
      const data = await resp.json()
      setComparisonResults(data)
    } catch (err) {
      setComparisonError(err instanceof Error ? err.message : 'Failed to compare option sets')
    } finally {
      setIsComparing(false)
    }
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden gradient-top-line-amber"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            Environment Comparison
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Compare option set values between two environments.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="px-6 py-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
              Source Environment
            </label>
            <input
              type="url"
              placeholder="https://yourorg-dev.crm.dynamics.com"
              value={compareSourceUrl}
              onChange={e => setCompareSourceUrl(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-mid)',
                color: 'var(--text-primary)',
                caretColor: '#f59e0b',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)' }}
              onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)';    e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
              Target Environment
            </label>
            <input
              type="url"
              placeholder="https://yourorg-uat.crm.dynamics.com"
              value={compareTargetUrl}
              onChange={e => setCompareTargetUrl(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-mid)',
                color: 'var(--text-primary)',
                caretColor: '#f59e0b',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)' }}
              onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)';    e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        <div>
          <button
            onClick={handleCompare}
            disabled={isComparing || !compareSourceUrl.trim() || !compareTargetUrl.trim()}
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1d4ed8', boxShadow: '0 0 20px rgba(29,78,216,0.35)' }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#2563eb' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1d4ed8' }}
          >
            {isComparing ? 'Comparing…' : 'Compare Environments'}
          </button>
        </div>

        {comparisonError && (
          <div
            className="rounded-lg px-4 py-3 text-xs"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
          >
            {comparisonError}
          </div>
        )}
      </div>

      {comparisonResults && (
        <div className="px-6 pb-6 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Comparison Summary */}
          <div
            className="rounded-lg p-6 mt-6"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h5 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Comparison Summary
                </h5>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {comparisonResults.sourceName || 'Source'} → {comparisonResults.targetName || 'Target'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold mb-1" style={{ color: '#fbbf24' }}>
                  {comparisonResults.differences?.filter((d: any) => d.different?.length > 0).length || 0}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Different</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold mb-1" style={{ color: '#f87171' }}>
                  {comparisonResults.differences?.filter((d: any) => d.sourceOnly?.length > 0).length || 0}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Source Only</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold mb-1" style={{ color: '#60a5fa' }}>
                  {comparisonResults.differences?.filter((d: any) => d.targetOnly?.length > 0).length || 0}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Target Only</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold mb-1" style={{ color: '#4ade80' }}>
                  {comparisonResults.differences?.filter((d: any) =>
                    !d.sourceOnly?.length && !d.targetOnly?.length && !d.different?.length
                  ).length || 0}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Match</p>
              </div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="space-y-3">
            {comparisonResults.differences?.map((diff: any, i: number) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--border-mid)' }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {diff.displayName}
                    </span>
                    {diff.type === 'global' ? (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ color: 'var(--accent-bright)', backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
                      >
                        Global
                      </span>
                    ) : (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-bright)' }}
                      >
                        {diff.entity || 'contact'}
                      </span>
                    )}
                  </div>

                  {diff.sourceOnly?.length > 0 || diff.targetOnly?.length > 0 || diff.different?.length > 0 ? (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      Different
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ color: '#4ade80', backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)' }}>
                      Match
                    </span>
                  )}
                </div>

                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Value', 'Source', 'Target', ''].map((h, j) => (
                        <th
                          key={j}
                          className={`px-4 py-2.5 font-semibold tracking-wider uppercase text-left ${j === 3 ? 'w-8' : j === 0 ? 'w-16' : ''}`}
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diff.sourceOnly?.map((v: any, j: number) => (
                      <tr key={`source-${j}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>{v.value}</td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{v.label}</td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>missing</td>
                        <td className="px-4 py-2.5 text-center"><span style={{ color: '#f87171' }}>✗</span></td>
                      </tr>
                    ))}

                    {diff.different?.map((v: any, j: number) => (
                      <tr key={`diff-${j}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>{v.value}</td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{v.sourceLabel}</td>
                        <td className="px-4 py-2.5" style={{ color: '#fbbf24' }}>{v.targetLabel}</td>
                        <td className="px-4 py-2.5 text-center"><span style={{ color: '#fbbf24' }}>✗</span></td>
                      </tr>
                    ))}

                    {diff.targetOnly?.map((v: any, j: number) => (
                      <tr key={`target-${j}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>{v.value}</td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>missing</td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{v.label}</td>
                        <td className="px-4 py-2.5 text-center"><span style={{ color: '#60a5fa' }}>✗</span></td>
                      </tr>
                    ))}

                    {!diff.sourceOnly?.length && !diff.targetOnly?.length && !diff.different?.length && (
                      <tr>
                        <td colSpan={4} className="px-4 py-2.5 text-center" style={{ color: '#4ade80' }}>
                          ✓ All values match
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
