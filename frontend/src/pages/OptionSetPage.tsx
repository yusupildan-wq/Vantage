import { useState } from 'react'
import OptionSetGuard from '../components/OptionSetGuard'
import OptionSetComparison from '../components/OptionSetComparison'
import { useEnvironmentUrl } from '../hooks/useEnvironmentUrl'
import { apiFetch, API_URL } from '../api'

// ─── Copy-Paste vs Dev inline result types ───────────────────────────────────

interface PasteValueResult {
  value: number
  pastedLabel: string
  devLabel: string | null
  match: boolean
}

type MatchMethod = 'displayName' | 'logicalName' | 'fuzzy' | 'valueOverlap'

interface PasteCompareResult {
  tableTitle: string
  matchedConfigName: string | null
  matchMethod: MatchMethod | null
  matchedType: 'local' | 'global' | null
  status: 'match' | 'mismatch' | 'unmatched'
  values: PasteValueResult[]
  devOnly: Array<{ value: number; label: string }>
}

interface PasteCompareResponse {
  devName: string
  tablesFound: number
  availableOptionSets: string[]
  results: PasteCompareResult[]
}

// ─── Copy-Paste vs Dev component ─────────────────────────────────────────────

function PasteVsDevSection() {
  const [pastedText, setPastedText] = useState('')
  const [devUrl, setDevUrl]         = useEnvironmentUrl()
  const [isLoading, setIsLoading]   = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [data, setData]             = useState<PasteCompareResponse | null>(null)
  const [showMismatchOnly, setShowMismatchOnly] = useState(false)

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setData(null)
    try {
      let resp: Response
      try {
        resp = await apiFetch(`${API_URL}/api/optionsets/paste-compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pastedText, devUrl: devUrl.trim() }),
        })
      } catch {
        setError(`Cannot reach the backend server at ${API_URL}. Make sure the backend is running (cd backend && npm run dev).`)
        return
      }
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? 'Comparison failed')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setIsLoading(false)
    }
  }

  const visibleResults = showMismatchOnly
    ? data?.results.filter(r => r.status !== 'match')
    : data?.results

  return (
    <>
      {/* Form */}
      <form
        onSubmit={handleCompare}
        className="relative rounded-xl overflow-hidden gradient-top-line-amber"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="px-6 py-6 space-y-5">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase" style={{ color: 'var(--text-muted)' }}>
            Configuration
          </p>

          {/* Textarea */}
          <div>
            <label className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
              Paste Table Content
            </label>
            <textarea
              placeholder={'Paste a copied table here from any app (Loop, Excel, Sheets, Notion…)\n\nExpected format — one or more tables separated by blank lines:\n\nApplication Review Status\nValue\tLabel\n914310009\tDraft\n914310010\tPending Application Fee'}
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              required
              rows={8}
              className="w-full rounded-lg px-4 py-3 text-sm font-mono transition-all duration-200 focus:outline-none resize-y"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-mid)',
                color: 'var(--text-primary)',
                caretColor: '#f59e0b',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)' }}
              onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-mid)';    e.currentTarget.style.boxShadow = 'none' }}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Table titles (a line with no tabs before the data rows) are used to match against the config. Blank lines separate multiple tables.
            </p>
          </div>

          {/* Dev URL */}
          <div>
            <label className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
              Dev Environment URL
            </label>
            <input
              type="url"
              placeholder="https://yourorg-dev.crm.dynamics.com"
              value={devUrl}
              onChange={e => setDevUrl(e.target.value)}
              required
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
            <button
              type="submit"
              disabled={isLoading || !pastedText.trim() || !devUrl.trim()}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#b45309', boxShadow: '0 0 20px rgba(180,83,9,0.25)' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#d97706' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#b45309' }}
            >
              {isLoading ? 'Comparing…' : 'Compare'}
            </button>
          </div>
        </div>
      </form>

      {/* General error */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 text-xs"
          style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {data && (
        <div
          className="relative rounded-xl overflow-hidden gradient-top-line-amber"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                Document vs {data.devName}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {data.tablesFound} table{data.tablesFound !== 1 ? 's' : ''} detected
                {' · '}
                {data.results.filter(r => r.status !== 'unmatched').length} matched
              </p>
            </div>
            <button
              onClick={() => setShowMismatchOnly(v => !v)}
              className="px-3 py-2 text-xs font-medium rounded-lg transition-all"
              style={showMismatchOnly
                ? { backgroundColor: 'rgba(245,158,11,0.07)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.22)' }
                : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)' }
              }
            >
              {showMismatchOnly ? 'Show All' : 'Mismatches Only'}
            </button>
          </div>

          <div className="p-6 space-y-3">
            {visibleResults?.map((result, i) => (
              <div key={i} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-mid)' }}>
                {/* Row header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: result.status !== 'unmatched' ? '1px solid var(--border)' : undefined }}
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {result.tableTitle}
                    </span>
                    {result.matchedConfigName && result.matchedConfigName !== result.tableTitle && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        → {result.matchedConfigName}
                      </span>
                    )}
                    {/* Global / Local type badge */}
                    {result.matchedType && (
                      <span
                        className="ml-2 text-xs px-1.5 py-0.5 rounded font-mono"
                        style={result.matchedType === 'global'
                          ? { color: '#818cf8', backgroundColor: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }
                          : { color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.2)' }
                        }
                      >
                        {result.matchedType === 'global' ? 'Global' : 'Local'}
                      </span>
                    )}
                    {/* Match method badge — shows HOW the option set was identified */}
                    {result.matchMethod && (() => {
                      const cfg: Record<MatchMethod, { label: string; color: string; bg: string; border: string; title: string }> = {
                        displayName:  { label: 'Name',         color: '#4ade80', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.2)',   title: 'Matched by display name — high confidence' },
                        logicalName:  { label: 'Logical Name', color: '#4ade80', bg: 'rgba(34,197,94,0.07)',   border: 'rgba(34,197,94,0.2)',   title: 'Matched by field logical name — high confidence' },
                        fuzzy:        { label: 'Fuzzy Name',   color: '#fbbf24', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)', title: 'Matched by partial name — verify this is the right option set' },
                        valueOverlap: { label: 'Value Match',  color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)', title: 'Matched by value numbers — verify this is the right option set' },
                      }
                      const c = cfg[result.matchMethod]
                      return (
                        <span
                          className="ml-2 text-xs px-1.5 py-0.5 rounded font-mono cursor-help"
                          style={{ color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}` }}
                          title={c.title}
                        >
                          {c.label}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                  {result.status === 'match' && (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ color: '#4ade80', backgroundColor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)' }}>All Match</span>
                  )}
                  {result.status === 'mismatch' && (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ color: '#fbbf24', backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>Mismatch</span>
                  )}
                  {result.status === 'unmatched' && (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.2)' }}>No Config Match</span>
                  )}
                  </div>
                </div>

                {/* Unmatched: show hint instead of empty table */}
                {result.status === 'unmatched' ? (
                  <div className="px-4 py-4 space-y-2">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      The table title <span className="font-mono px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(148,163,184,0.1)' }}>{result.tableTitle || '(untitled)'}</span> did not match any option set in the config.
                    </p>
                    {data.availableOptionSets.length > 0 && (
                      <div>
                        <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Available option sets in this config:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.availableOptionSets.map((name, k) => (
                            <span key={k} className="text-xs px-2 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)' }}>
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Value', 'Document', 'Dev', ''].map((h, j) => (
                          <th
                            key={j}
                            className={`px-4 py-2.5 font-semibold tracking-wider uppercase text-left ${j === 3 ? 'w-8' : j === 0 ? 'w-24' : ''}`}
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.values.map((v, j) => (
                        <tr key={j} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>{v.value}</td>
                          <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{v.pastedLabel}</td>
                          <td
                            className="px-4 py-2.5"
                            style={{
                              color: v.devLabel === null ? 'var(--text-muted)' : v.match ? 'var(--text-secondary)' : '#fbbf24',
                              fontStyle: v.devLabel === null ? 'italic' : undefined,
                            }}
                          >
                            {v.devLabel ?? 'missing'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {v.match ? <span style={{ color: '#4ade80' }}>✓</span> : <span style={{ color: '#fbbf24' }}>✗</span>}
                          </td>
                        </tr>
                      ))}
                      {result.devOnly.map((v, j) => {
                        const isSystemValue = v.value < 10
                        return (
                          <tr key={`devonly-${j}`} style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(99,102,241,0.03)', opacity: isSystemValue ? 0.45 : 1 }}>
                            <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>{v.value}</td>
                            <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              not in document{isSystemValue && <span className="ml-2 text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', color: 'var(--text-muted)', fontStyle: 'normal' }}>system value</span>}
                            </td>
                            <td className="px-4 py-2.5" style={{ color: '#60a5fa' }}>{v.label}</td>
                            <td className="px-4 py-2.5 text-center"><span style={{ color: '#60a5fa' }}>+</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OptionSetPage() {
  const [inputUrl, setInputUrl]             = useEnvironmentUrl()
  const [environmentUrl, setEnvironmentUrl] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEnvironmentUrl(inputUrl.trim())
  }

  return (
    <>
      {/* Page hero */}
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.05) 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)' }}
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-16 animate-fade-in">
          <p className="text-xs font-semibold tracking-[0.28em] uppercase mb-4" style={{ color: '#f59e0b' }}>
            Feature 02
          </p>
          <h1
            className="font-display font-semibold leading-tight"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: 'var(--text-primary)' }}
          >
            Option Set Guard
          </h1>
          <p className="text-sm mt-3 max-w-lg" style={{ color: 'var(--text-secondary)' }}>
            Enter your environment URL to compare protected option set values and restore any that have drifted.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10 animate-slide-up space-y-10">

        {/* ── Section 1: Option Set Guard ── */}
        <section className="space-y-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] uppercase mb-1" style={{ color: '#f59e0b' }}>
              Section 01
            </p>
            <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
              Option Set Guard
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Enter an environment URL to check protected option set values against dev and restore any that have drifted.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="relative rounded-xl overflow-hidden gradient-top-line-amber"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div className="px-6 py-6">
              <p className="text-xs font-semibold tracking-[0.22em] uppercase mb-5" style={{ color: 'var(--text-muted)' }}>
                Environment Configuration
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label htmlFor="os-env-url" className="block text-xs font-medium tracking-wider uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Environment URL
                  </label>
                  <input
                    id="os-env-url"
                    type="url"
                    placeholder="https://yourorg.crm.dynamics.com"
                    value={inputUrl}
                    onChange={e => setInputUrl(e.target.value)}
                    required
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
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={inputUrl.trim() === ''}
                    className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#b45309', boxShadow: '0 0 20px rgba(180,83,9,0.25)' }}
                    onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#d97706' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#b45309' }}
                  >
                    Scan
                  </button>
                </div>
              </div>
            </div>
          </form>

          {environmentUrl && <OptionSetGuard environmentUrl={environmentUrl} />}
        </section>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--border-bright), transparent)' }} />

        {/* ── Section 2: Loop Document vs Dev ── */}
        <section className="space-y-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] uppercase mb-1" style={{ color: '#f59e0b' }}>
              Section 02
            </p>
            <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
              Document vs Dev
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Copy a table from any app (Loop, Excel, Google Sheets, Notion…) and paste it here to compare against the dev environment.
            </p>
          </div>
          <PasteVsDevSection />
        </section>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--border-bright), transparent)' }} />

        {/* ── Section 3: Environment Comparison ── */}
        <section className="space-y-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] uppercase mb-1" style={{ color: '#f59e0b' }}>
              Section 03
            </p>
            <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
              Environment Comparison
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Compare option set values between two environments side by side.
            </p>
          </div>
          <OptionSetComparison />
        </section>

      </main>
    </>
  )
}
