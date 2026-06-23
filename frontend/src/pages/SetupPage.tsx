import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface FormData {
  tenantId: string
  clientId: string
  clientSecret: string
  adoPat: string
}

function Field({
  label, hint, value, onChange, type = 'text', placeholder, show, onToggleShow,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'password'
  placeholder?: string
  show?: boolean
  onToggleShow?: () => void
}) {
  const isSecret = type === 'password'
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={isSecret && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none transition-all"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            paddingRight: isSecret ? '2.75rem' : undefined,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#6366f1')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        {isSecret && onToggleShow && (
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            {show ? 'hide' : 'show'}
          </button>
        )}
      </div>
      {hint && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="rounded-full transition-all"
          style={{
            width: i + 1 === current ? '20px' : '6px',
            height: '6px',
            backgroundColor: i + 1 === current ? '#6366f1' : i + 1 < current ? '#4ade80' : 'var(--border-mid)',
          }}
        />
      ))}
    </div>
  )
}

export default function SetupPage({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({ tenantId: '', clientId: '', clientSecret: '', adoPat: '' })
  const [showSecret, setShowSecret] = useState(false)
  const [showPat, setShowPat] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key: keyof FormData) {
    return (v: string) => setForm(f => ({ ...f, [key]: v }))
  }

  function step1Valid() {
    return form.tenantId.trim() && form.clientId.trim() && form.clientSecret.trim()
  }

  async function finish() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/setup/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azureTenantId: form.tenantId.trim(),
          azureClientId: form.clientId.trim(),
          azureClientSecret: form.clientSecret.trim(),
          azureDevOpsPat: form.adoPat.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Setup failed. Please try again.')
        setSaving(false)
        return
      }
      setStep(3)
    } catch {
      setError('Could not reach the backend. Make sure Vantage is running.')
      setSaving(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(99,102,241,0.06), transparent)',
        }}
      />

      {/* Logo */}
      <div className="mb-8 text-center relative">
        <div className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
          Vantage
        </div>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Power Platform Engineering Toolkit
        </div>
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-md rounded-2xl p-8"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-8 right-8 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)' }}
        />

        {step === 1 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <StepDots current={1} total={2} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Step 1 of 2</span>
            </div>

            <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Connect to Azure
            </h1>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Vantage uses an Azure App Registration to access your Dataverse environments. These credentials stay on your machine — they are never sent anywhere else.
            </p>

            <div className="flex flex-col gap-5">
              <Field
                label="Azure Tenant ID"
                hint="Azure Portal → Azure Active Directory → Overview → Tenant ID"
                value={form.tenantId}
                onChange={set('tenantId')}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <Field
                label="Client ID (Application ID)"
                hint="Azure Portal → App registrations → your app → Application (client) ID"
                value={form.clientId}
                onChange={set('clientId')}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <Field
                label="Client Secret"
                hint="Azure Portal → App registrations → your app → Certificates & secrets"
                value={form.clientSecret}
                onChange={set('clientSecret')}
                type="password"
                show={showSecret}
                onToggleShow={() => setShowSecret(s => !s)}
                placeholder="your-client-secret-value"
              />
            </div>

            <button
              className="mt-8 w-full py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: step1Valid() ? '#6366f1' : 'var(--bg-elevated)',
                color: step1Valid() ? '#fff' : 'var(--text-muted)',
                cursor: step1Valid() ? 'pointer' : 'not-allowed',
              }}
              disabled={!step1Valid()}
              onClick={() => setStep(2)}
            >
              Continue →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <StepDots current={2} total={2} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Step 2 of 2</span>
            </div>

            <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Azure DevOps
            </h1>
            <p className="text-sm mb-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Needed for the Pipeline Health Dashboard and Pipeline Optimizer. You can skip this and add it later in Settings.
            </p>
            <p className="text-xs mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Generate at dev.azure.com → User settings (top right) → Personal Access Tokens. Required scopes: <strong>Build (Read)</strong> and <strong>Code (Read & Write)</strong>.
            </p>

            <Field
              label="Personal Access Token"
              value={form.adoPat}
              onChange={set('adoPat')}
              type="password"
              show={showPat}
              onToggleShow={() => setShowPat(s => !s)}
              placeholder="your-ado-pat"
            />

            {error && (
              <p className="mt-4 text-xs rounded-lg px-3 py-2" style={{ color: '#f87171', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}

            <div className="mt-8 flex gap-3">
              <button
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                onClick={() => { setStep(1); setError('') }}
              >
                ← Back
              </button>
              <button
                className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all"
                style={{ color: 'var(--text-muted)' }}
                onClick={finish}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Skip'}
              </button>
              <button
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: form.adoPat.trim() ? '#6366f1' : 'var(--bg-elevated)',
                  color: form.adoPat.trim() ? '#fff' : 'var(--text-muted)',
                  border: form.adoPat.trim() ? 'none' : '1px solid var(--border)',
                }}
                onClick={finish}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Finish →'}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center text-center py-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Vantage is ready
            </h1>
            <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Your credentials have been saved. You won't need to do this again.
            </p>
            <button
              className="w-full py-2.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: '#6366f1', color: '#fff' }}
              onClick={onComplete}
            >
              Open Vantage →
            </button>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Credentials are stored locally on this machine only.
      </p>
    </div>
  )
}
