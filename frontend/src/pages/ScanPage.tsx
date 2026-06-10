import { useState } from 'react'
import ScanForm from '../components/ScanForm'
import ResultsTable from '../components/ResultsTable'
import EmptyState from '../components/EmptyState'
import { ScanResult } from '../types'

export default function ScanPage() {
  const [environmentUrl, setEnvironmentUrl] = useState('')
  const [isScanning, setIsScanning]         = useState(false)
  const [results, setResults]               = useState<ScanResult[]>([])
  const [hasScanned, setHasScanned]         = useState(false)
  const [error, setError]                   = useState<string | null>(null)

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
    <>
      {/* Page hero */}
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(91,95,199,0.07) 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(129,140,248,0.4), transparent)' }}
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-16 animate-fade-in">
          <p className="text-xs font-semibold tracking-[0.28em] uppercase mb-4" style={{ color: 'var(--accent-bright)' }}>
            Feature 01
          </p>
          <h1
            className="font-display font-semibold leading-tight text-gradient"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)' }}
          >
            Active Layer Scanner
          </h1>
          <p className="text-sm mt-3 max-w-lg" style={{ color: 'var(--text-secondary)' }}>
            Enter your environment URL and run a scan to identify all active-layer customizations before solution export.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-5 animate-slide-up">
        <ScanForm
          environmentUrl={environmentUrl}
          isScanning={isScanning}
          onChange={setEnvironmentUrl}
          onScan={handleScan}
        />

        {error && (
          <div
            className="rounded-xl px-5 py-4 text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}
          >
            {error}
          </div>
        )}

        {hasScanned ? <ResultsTable results={results} /> : <EmptyState />}
      </main>
    </>
  )
}
