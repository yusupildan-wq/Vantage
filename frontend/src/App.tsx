import { useState } from 'react'
import Header from './components/Header'
import ScanForm from './components/ScanForm'
import ResultsTable from './components/ResultsTable'
import EmptyState from './components/EmptyState'
import { MOCK_RESULTS } from './mockData'
import { ScanResult } from './types'

export default function App() {
  const [environmentUrl, setEnvironmentUrl] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [results, setResults] = useState<ScanResult[]>([])
  const [hasScanned, setHasScanned] = useState(false)

  function handleScan() {
    setIsScanning(true)
    setResults([])

    // Simulate async API call with 1.5s delay
    setTimeout(() => {
      setResults(MOCK_RESULTS)
      setHasScanned(true)
      setIsScanning(false)
    }, 1500)
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

        {hasScanned ? (
          <ResultsTable results={results} />
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  )
}
