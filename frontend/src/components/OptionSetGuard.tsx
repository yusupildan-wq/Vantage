import { useState } from 'react'
import { OptionSetCheckResult } from '../types'

interface Props {
  environmentUrl: string
}

function PillButton({
  onClick,
  disabled,
  active,
  activeStyle,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  activeStyle?: React.CSSProperties
  children: React.ReactNode
}) {
  const base: React.CSSProperties = {
    backgroundColor: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-bright)',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 text-xs font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={active && activeStyle ? activeStyle : base}
    >
      {children}
    </button>
  )
}

export default function OptionSetGuard({ environmentUrl }: Props) {
  const [results, setResults]               = useState<OptionSetCheckResult[] | null>(null)
  const [clientName, setClientName]         = useState<string | null>(null)
  const [isLoading, setIsLoading]           = useState(false)
  const [isRestoring, setIsRestoring]       = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  const [showMismatchOnly, setShowMismatchOnly] = useState(false)

  // Comparison state
  const [compareSourceUrl, setCompareSourceUrl] = useState('')
  const [compareTargetUrl, setCompareTargetUrl] = useState('')
  const [comparisonResults, setComparisonResults] = useState<any>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [comparisonError, setComparisonError] = useState<string | null>(null)

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

  async function handleCheck() {
    setIsLoading(true)
    setError(null)
    setRestoreMessage(null)
    try {
      const resp = await fetch(`${apiUrl}/api/optionsets/status?environmentUrl=${encodeURIComponent(environmentUrl)}`)
      if (resp.status === 404) {
        setError('No client config found for this environment. Add a config file to config/clients/.')
        return
      }
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error ?? 'Check failed')
      }
      const data = await resp.json()
      setClientName(data.clientName)
      setResults(data.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check option sets')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRestore() {
    setIsRestoring(true)
    setError(null)
    setRestoreMessage(null)
    try {
      const resp = await fetch(`${apiUrl}/api/optionsets/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentUrl }),
      })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error ?? 'Restore failed')
      }
      const data = await resp.json()
      setResults(data.details)
      setRestoreMessage(`Restored ${data.restored} value(s).${data.failed > 0 ? ` ${data.failed} failed.` : ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore option sets')
    } finally {
      setIsRestoring(false)
    }
  }

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
          targetUrl: compareTargetUrl.trim()
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

  const hasMismatch    = results?.some(r => r.status === 'mismatch')
  const visibleResults = showMismatchOnly
    ? results?.filter(r => r.status === 'mismatch' || r.status === 'error')
    : results

  return (
    <div
      className="relative rounded-xl overflow-hidden gradient-top-line-amber"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="px-6 py-5 flex flex-wrap items-center justify-between gap-3"
        style={{ borderBottom: results ? '1px solid var(--border)' : undefined }}
      >
        <div>
          <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            Option Set Guard
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Compare protected option set values against the environment.
          </p>
        </div>

        <div className="flex gap-2">
          {results && (
            <PillButton
              onClick={() => setShowMismatchOnly(v => !v)}
              active={showMismatchOnly}
              activeStyle={{
                backgroundColor: 'rgba(245,158,11,0.07)',
                color: '#fbbf24',
                border: '1px solid rgba(245,158,11,0.22)',
              }}
            >
              {showMismatchOnly ? 'Show All' : 'Mismatches Only'}
            </PillButton>
          )}
          {results && hasMismatch && (
            <button
              onClick={handleRestore}
              disabled={isRestoring}
              className="px-4 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-40"
              style={{
                backgroundColor: 'rgba(245,158,11,0.1)',
                color: '#fbbf24',
                border: '1px solid rgba(245,158,11,0.25)',
              }}
            >
              {isRestoring ? 'Restoring…' : 'Restore All'}
            </button>
          )}
          <button
            onClick={handleCheck}
            disabled={isLoading || !environmentUrl}
            className="px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-40"
            style={{
              backgroundColor: 'var(--accent)',
              boxShadow: '0 0 20px var(--accent-glow)',
            }}
          >
            {isLoading ? 'Checking…' : 'Check Status'}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mx-6 mt-5 rounded-lg px-4 py-3 text-xs"
          style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      {restoreMessage && (
        <div
          className="mx-6 mt-5 rounded-lg px-4 py-3 text-xs"
          style={{ backgroundColor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', color: '#4ade80' }}
        >
          {restoreMessage}
        </div>
      )}

      {results && (
        <div className="p-6 space-y-3">
          {clientName && (
            <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: 'var(--text-muted)' }}>
              Client: {clientName}
            </p>
          )}

          {visibleResults?.map((result, i) => (
            <div
              key={i}
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border-mid)' }}
            >
              {/* Row header */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {result.displayName}
                  </span>
                  {result.type === 'global' ? (
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
                      {result.entity}
                    </span>
                  )}
                </div>

                {result.status === 'match'    && <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ color: '#4ade80', backgroundColor: 'rgba(34,197,94,0.07)',  border: '1px solid rgba(34,197,94,0.18)'  }}>All Match</span>}
                {result.status === 'mismatch' && <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)'  }}>Mismatch</span>}
                {result.status === 'error'    && <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ color: '#f87171', backgroundColor: 'rgba(239,68,68,0.07)',   border: '1px solid rgba(239,68,68,0.18)'  }}>Error</span>}
              </div>

              {result.status === 'error' ? (
                <p className="px-4 py-3 text-xs" style={{ color: '#f87171' }}>{result.error}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Value', 'Expected', 'Current', ''].map((h, j) => (
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
                    {result.values.map((v, j) => (
                      <tr
                        key={j}
                        style={{ borderBottom: j < result.values.length - 1 ? '1px solid var(--border)' : undefined }}
                      >
                        <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>{v.value}</td>
                        <td className="px-4 py-2.5"             style={{ color: 'var(--text-secondary)' }}>{v.expectedLabel}</td>
                        <td
                          className="px-4 py-2.5"
                          style={{ color: v.currentLabel === null ? 'var(--text-muted)' : v.match ? 'var(--text-secondary)' : '#fbbf24', fontStyle: v.currentLabel === null ? 'italic' : undefined }}
                        >
                          {v.currentLabel ?? 'missing'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {v.match
                            ? <span style={{ color: '#4ade80' }}>✓</span>
                            : <span style={{ color: '#fbbf24' }}>✗</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Environment Comparison Section */}
      <div style={{ borderTop: '1px solid var(--border)' }} className="p-6">
        <h4 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
          Compare Environments
        </h4>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
              Source Environment
            </label>
            <input
              type="text"
              placeholder="https://andrews-dev.crm.dynamics.com"
              value={compareSourceUrl}
              onChange={(e) => setCompareSourceUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ 
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>
              Target Environment
            </label>
            <input
              type="text"
              placeholder="https://andrews-uat.crm.dynamics.com"
              value={compareTargetUrl}
              onChange={(e) => setCompareTargetUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ 
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
        </div>

        <button
          onClick={handleCompare}
          disabled={isComparing || !compareSourceUrl || !compareTargetUrl}
          className="px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-40"
          style={{
            backgroundColor: 'var(--accent)',
            boxShadow: '0 0 20px var(--accent-glow)',
          }}
        >
          {isComparing ? 'Comparing…' : 'Compare Environments'}
        </button>

        {comparisonError && (
          <div
            className="mt-4 rounded-lg px-4 py-3 text-xs"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
          >
            {comparisonError}
          </div>
        )}

        {comparisonResults && (
          <div className="mt-6 space-y-4">
            {/* Comparison Summary */}
            <div
              className="rounded-lg p-6"
              style={{ 
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-mid)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h5 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    Environment Comparison
                  </h5>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {comparisonResults.sourceName || 'Source'} → {comparisonResults.targetName || 'Target'}
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
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

            {/* Detailed Results Table */}
            <div className="space-y-3">
              {comparisonResults.differences?.map((diff: any, i: number) => (
                <div
                  key={i}
                  className="rounded-lg overflow-hidden"
                  style={{ border: '1px solid var(--border-mid)' }}
                >
                  {/* Row header */}
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

                  {/* All values combined into table */}
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
                      {/* Regular values (exist in source) */}
                      {diff.sourceOnly?.map((v: any, j: number) => (
                        <tr key={`source-${j}`} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>{v.value}</td>
                          <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{v.label}</td>
                          <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>missing</td>
                          <td className="px-4 py-2.5 text-center">
                            <span style={{ color: '#f87171' }}>✗</span>
                          </td>
                        </tr>
                      ))}

                      {/* Shared values */}
                      {diff.different?.map((v: any, j: number) => (
                        <tr key={`diff-${j}`} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>{v.value}</td>
                          <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{v.sourceLabel}</td>
                          <td className="px-4 py-2.5" style={{ color: '#fbbf24' }}>{v.targetLabel}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span style={{ color: '#fbbf24' }}>✗</span>
                          </td>
                        </tr>
                      ))}

                      {/* Target-only values */}
                      {diff.targetOnly?.map((v: any, j: number) => (
                        <tr key={`target-${j}`} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>{v.value}</td>
                          <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>missing</td>
                          <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{v.label}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span style={{ color: '#60a5fa' }}>✗</span>
                          </td>
                        </tr>
                      ))}

                      {/* If all match, show message */}
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
    </div>
  )
}
