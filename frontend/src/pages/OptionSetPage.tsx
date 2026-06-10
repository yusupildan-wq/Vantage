import { useState } from 'react'
import OptionSetGuard from '../components/OptionSetGuard'

export default function OptionSetPage() {
  const [inputUrl, setInputUrl]             = useState('')
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

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-5 animate-slide-up">
        {/* URL form */}
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
                  Set Environment
                </button>
              </div>
            </div>
          </div>
        </form>

        {environmentUrl && <OptionSetGuard environmentUrl={environmentUrl} />}
      </main>
    </>
  )
}
