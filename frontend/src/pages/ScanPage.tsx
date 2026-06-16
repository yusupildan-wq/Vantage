import { useState } from 'react'
import ScanForm from '../components/ScanForm'
import ResultsTable from '../components/ResultsTable'
import EmptyState from '../components/EmptyState'
import { ScanResult } from '../types'
import { useEnvironmentUrl } from '../hooks/useEnvironmentUrl'

const SCAN_STEPS = [
  'Connecting to environment',
  'Fetching solution components',
  'Querying active layer data',
  'Checking unmanaged customizations',
  'Analysing component statuses',
]

export default function ScanPage() {
  const [environmentUrl, setEnvironmentUrl] = useEnvironmentUrl()
  const [isScanning, setIsScanning]         = useState(false)
  const [results, setResults]               = useState<ScanResult[]>([])
  const [hasScanned, setHasScanned]         = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [currentStep, setCurrentStep]       = useState(0)

  async function handleScan() {
    setIsScanning(true)
    setResults([])
    setError(null)
    setCurrentStep(0)

    const interval = setInterval(() => {
      setCurrentStep(v => Math.min(v + 1, SCAN_STEPS.length - 1))
    }, 700)

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
      clearInterval(interval)
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
            className="rounded-xl px-5 py-4"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}
          >
            <p className="text-sm font-semibold mb-1">Scan failed</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        )}

        {/* Animated loading checklist */}
        {isScanning && (
          <div
            className="rounded-xl p-6 space-y-4 animate-fade-in"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <p className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Scanning environment…
            </p>
            <div className="space-y-2.5">
              {SCAN_STEPS.map((step, i) => {
                const done    = i < currentStep
                const current = i === currentStep
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                      style={done
                        ? { backgroundColor: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }
                        : current
                          ? { backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }
                          : { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }
                      }
                    >
                      {done    && <span className="text-green-400 text-xs leading-none">✓</span>}
                      {current && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent-bright)' }} />}
                    </div>
                    <span
                      className="text-xs transition-colors duration-300"
                      style={{ color: done ? '#4ade80' : current ? 'var(--text-primary)' : 'var(--text-muted)' }}
                    >
                      {step}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!isScanning && (hasScanned ? <ResultsTable results={results} /> : <EmptyState />)}
      </main>
    </>
  )
}
