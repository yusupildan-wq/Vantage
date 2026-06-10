import { useState } from 'react'
import { OptionSetCheckResult } from '../types'

interface Props {
  environmentUrl: string
}

export default function OptionSetGuard({ environmentUrl }: Props) {
  const [results, setResults] = useState<OptionSetCheckResult[] | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)

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
      setRestoreMessage(`Restored ${data.restored} value(s). ${data.failed > 0 ? `${data.failed} failed.` : ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore option sets')
    } finally {
      setIsRestoring(false)
    }
  }

  const hasMismatch = results?.some(r => r.status === 'mismatch')

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Option Set Guard</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Compare protected option set values against what's currently in the environment.
          </p>
        </div>
        <div className="flex gap-2">
          {results && hasMismatch && (
            <button
              onClick={handleRestore}
              disabled={isRestoring}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-md"
            >
              {isRestoring ? 'Restoring...' : 'Restore All'}
            </button>
          )}
          <button
            onClick={handleCheck}
            disabled={isLoading || !environmentUrl}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
          >
            {isLoading ? 'Checking...' : 'Check Status'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {restoreMessage && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {restoreMessage}
        </div>
      )}

      {results && (
        <div className="space-y-3">
          {clientName && (
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
              Client: {clientName}
            </p>
          )}
          {results.map((result, i) => (
            <div key={i} className="border border-gray-100 rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <span className="text-sm font-medium text-gray-800">{result.displayName}</span>
                {result.status === 'match' && (
                  <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">All Match</span>
                )}
                {result.status === 'mismatch' && (
                  <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Mismatch</span>
                )}
                {result.status === 'error' && (
                  <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Error</span>
                )}
              </div>
              {result.status === 'error' ? (
                <p className="px-4 py-3 text-sm text-red-600">{result.error}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-gray-100">
                      <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium w-16">Value</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Expected</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Current</th>
                      <th className="px-4 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.values.map((v, j) => (
                      <tr key={j} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-500">{v.value}</td>
                        <td className="px-4 py-2 text-gray-800">{v.expectedLabel}</td>
                        <td className={`px-4 py-2 ${v.currentLabel === null ? 'text-gray-400 italic' : v.match ? 'text-gray-800' : 'text-amber-700'}`}>
                          {v.currentLabel ?? 'missing'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {v.match ? (
                            <span className="text-green-500">✓</span>
                          ) : (
                            <span className="text-amber-500">✗</span>
                          )}
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
    </div>
  )
}
