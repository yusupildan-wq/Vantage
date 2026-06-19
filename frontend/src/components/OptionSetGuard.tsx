import { useState } from 'react'
import { Link } from 'react-router-dom'
import { OptionSetCheckResult } from '../types'
import { apiFetch } from '../api'
import ConfirmActionDialog from './ConfirmActionDialog'

interface Props {
  environmentUrl: string
  columnLabels?: { expected: string; current: string }
  apiEndpoint?: string
  readOnly?: boolean
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

export default function OptionSetGuard({ environmentUrl, columnLabels, apiEndpoint, readOnly }: Props) {
  const [results, setResults]               = useState<OptionSetCheckResult[] | null>(null)
  const [clientName, setClientName]         = useState<string | null>(null)
  const [sourceOfTruth, setSourceOfTruth]   = useState<string | null>(null)
  const [isLoading, setIsLoading]           = useState(false)
  const [isRestoring, setIsRestoring]       = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  const [showMismatchOnly, setShowMismatchOnly] = useState(false)
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false)

  const labels = columnLabels ?? (sourceOfTruth
    ? { expected: 'Dev', current: 'Current' }
    : { expected: 'Expected', current: 'Current' }
  )

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

  async function handleCheck() {
    setIsLoading(true)
    setError(null)
    setRestoreMessage(null)
    try {
      const endpoint = apiEndpoint ?? `${apiUrl}/api/optionsets/status`
      let resp: Response
      try {
        resp = await apiFetch(`${endpoint}?environmentUrl=${encodeURIComponent(environmentUrl)}`)
      } catch {
        setError(`Cannot reach the backend server at ${apiUrl}. Make sure the backend is running (cd backend && npm run dev) and your frontend/.env has VITE_API_URL=http://localhost:3001.`)
        return
      }
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
      setSourceOfTruth(data.sourceOfTruth ?? null)
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
      const resp = await apiFetch(`${apiUrl}/api/optionsets/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentUrl, safetyAcknowledged: true }),
      })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error ?? 'Restore failed')
      }
      const data = await resp.json()
      setResults(data.details)
      setRestoreMessage(`Restored ${data.restored} value(s).${data.failed > 0 ? ` ${data.failed} failed.` : ''}`)
      setConfirmRestoreOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore option sets')
    } finally {
      setIsRestoring(false)
    }
  }

  const hasMismatch    = results?.some(r => r.status === 'mismatch')
  const mismatchedOptionSets = results?.filter(r => r.status === 'mismatch') ?? []
  const mismatchValueCount = mismatchedOptionSets.reduce(
    (total, result) => total + result.values.filter(value => !value.match).length,
    0
  )
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
          {sourceOfTruth && (
            <p className="text-xs mt-1.5 font-mono" style={{ color: 'rgba(245,158,11,0.7)' }}>
              Source of truth: {sourceOfTruth}
            </p>
          )}
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
          {!readOnly && results && hasMismatch && (
            <button
              onClick={() => setConfirmRestoreOpen(true)}
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
          className="mx-6 mt-5 rounded-lg px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-3"
          style={{ backgroundColor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', color: '#4ade80' }}
        >
          <span>{restoreMessage}</span>
          <Link to="/audit-log" className="font-semibold transition-opacity hover:opacity-80" style={{ color: '#4ade80' }}>
            View Audit Log
          </Link>
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
                      {['Value', labels.expected, labels.current, ''].map((h, j) => (
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

      <ConfirmActionDialog
        open={confirmRestoreOpen}
        title="Restore Option Set Values"
        tone="warning"
        confirmLabel="Restore Values"
        isWorking={isRestoring}
        body="This will write the source-of-truth labels back into the selected Dataverse environment."
        checkLabel="I understand this will update option set labels in Dataverse."
        details={[
          { label: 'Environment', value: environmentUrl },
          { label: 'Source', value: sourceOfTruth ?? environmentUrl },
          { label: 'Option Sets', value: `${mismatchedOptionSets.length}` },
          { label: 'Values', value: `${mismatchValueCount}` },
        ]}
        onCancel={() => setConfirmRestoreOpen(false)}
        onConfirm={handleRestore}
      />

    </div>
  )
}
