import { useState } from 'react'
import Header from './components/Header'
import ScanForm from './components/ScanForm'
import ResultsTable from './components/ResultsTable'
import EmptyState from './components/EmptyState'
import { ScanResult } from './types'

export default function App() {
  const [environmentUrl, setEnvironmentUrl] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [results, setResults] = useState<ScanResult[]>([])
  const [hasScanned, setHasScanned] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleScan() {
    setIsScanning(true)
    setResults([])
    setError(null)

    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentUrl }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Scan failed')
      }

      const data = await response.json()
      setResults(data.results)
      setHasScanned(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to backend')
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">
            Identify active-layer customizations in your Dataverse environment before solution export.
          </p>
        </div>

        <ScanForm
          environmentUrl={environmentUrl}
          isScanning={isScanning}
          onChange={setEnvironmentUrl}
          onScan={handleScan}
        />

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {hasScanned ? (
          <ResultsTable results={results} />
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  )
}
