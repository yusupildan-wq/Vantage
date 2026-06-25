import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface FormData {
  tenantId: string
  clientId: string
  clientSecret: string
  adoPat: string
  aiDataConsent: boolean
}

function Field({
  label, value, onChange, type = 'text', placeholder, show, onToggleShow,
}: {
  label: string
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

function HowToGuide({ type }: { type: 'azure' | 'devops' }) {
  const [open, setOpen] = useState(false)

  const azureSteps = [
    { n: 1, text: 'Go to', link: 'https://portal.azure.com', linkText: 'portal.azure.com' },
    { n: 2, text: 'In the search bar at the top, type "App registrations" and click it' },
    { n: 3, text: 'Click "New registration" → give it any name (e.g. "Vantage") → click Register' },
    { n: 4, text: 'On the overview page, copy the "Application (client) ID" → paste it into Client ID above' },
    { n: 5, text: 'Also on the overview page, copy the "Directory (tenant) ID" → paste it into Tenant ID above' },
    { n: 6, text: 'In the left menu click "Certificates & secrets" → "New client secret" → give it any description → Add' },
    { n: 7, text: 'Copy the "Value" column (not Secret ID) → paste it into Client Secret above. ⚠ You can only see this value once.' },
    { n: 8, text: 'Finally, ask your Azure admin to grant this app "Dataverse user" permissions on your environments.' },
  ]

  const devopsSteps = [
    { n: 1, text: 'Go to', link: 'https://dev.azure.com', linkText: 'dev.azure.com' },
    { n: 2, text: 'Click your profile picture in the top right → Personal Access Tokens' },
    { n: 3, text: 'Click "New Token" → give it any name → set expiration as needed' },
    { n: 4, text: 'Under Scopes, select: Build → Read, Code → Read & Write, then click Create' },
    { n: 5, text: 'Copy the token value → paste it above. ⚠ You can only see this value once.' },
  ]

  const steps = type === 'azure' ? azureSteps : devopsSteps

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-mid)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
        style={{ backgroundColor: 'var(--bg-elevated)' }}
      >
        <span className="text-xs font-medium" style={{ color: '#a78bfa' }}>
          ✦ {type === 'azure' ? "I don't have these — show me how to get them" : "Show me how to create a Personal Access Token"}
        </span>
        <svg
          className="w-3.5 h-3.5 transition-transform"
          style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 space-y-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          {steps.map(s => (
            <div key={s.n} className="flex gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}
              >
                {s.n}
              </span>
              <span className="leading-relaxed pt-0.5">
                {s.text}{' '}
                {'link' in s && (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    style={{ color: '#a5b4fc' }}
                  >
                    {s.linkText}
                  </a>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SetupPage({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({
    tenantId: '',
    clientId: '',
    clientSecret: '',
    adoPat: '',
    aiDataConsent: false,
  })
  const [showSecret, setShowSecret] = useState(false)
  const [showPat, setShowPat] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key: 'tenantId' | 'clientId' | 'clientSecret' | 'adoPat') {
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
          aiDataConsent: form.aiDataConsent,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Setup failed. Please try again.')
        setSaving(false)
        return
      }
      setStep(4)
    } catch {
      setError('Could not reach the backend. Try closing and re-opening Vantage.')
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
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(99,102,241,0.06), transparent)' }}
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
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="absolute top-0 left-8 right-8 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)' }}
        />

        {step === 1 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <StepDots current={1} total={3} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Step 1 of 3</span>
            </div>

            <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Connect to Azure
            </h1>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Vantage needs access to your Microsoft environment. Credentials are encrypted locally; only service requests you initiate are sent to Microsoft.
            </p>

            <div className="flex flex-col gap-5 mb-5">
              <Field
                label="Tenant ID"
                value={form.tenantId}
                onChange={set('tenantId')}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <Field
                label="Client ID"
                value={form.clientId}
                onChange={set('clientId')}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <Field
                label="Client Secret"
                value={form.clientSecret}
                onChange={set('clientSecret')}
                type="password"
                show={showSecret}
                onToggleShow={() => setShowSecret(s => !s)}
                placeholder="your-client-secret-value"
              />
            </div>

            <HowToGuide type="azure" />

            <button
              className="mt-6 w-full py-2.5 rounded-lg text-sm font-medium transition-all"
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
              <StepDots current={2} total={3} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Step 2 of 3</span>
            </div>

            <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Grant Dataverse Access
            </h1>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Your app registration needs permission to read your Power Platform environments. This is a one-time step your admin can do in 2 minutes.
            </p>

            <div className="rounded-lg p-4 mb-5 space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
              {[
                { n: 1, text: 'Go to', link: 'https://admin.powerplatform.microsoft.com', linkText: 'admin.powerplatform.microsoft.com' },
                { n: 2, text: 'Select the environment you want to connect → click Settings (top bar)' },
                { n: 3, text: 'Go to Users + permissions → Application users' },
                { n: 4, text: 'Click "New app user" → search for your app by the Client ID you entered in Step 1 → select it' },
                { n: 5, text: 'Assign the "System Administrator" security role → click Create' },
                { n: 6, text: 'Repeat for each environment you want Vantage to access' },
              ].map(s => (
                <div key={s.n} className="flex gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                    {s.n}
                  </span>
                  <span className="leading-relaxed pt-0.5">
                    {s.text}{' '}
                    {'link' in s && (
                      <a href={s.link} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#a5b4fc' }}>{s.linkText}</a>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-lg px-4 py-3 text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>
              ⚠ If you skip this, Vantage will open but all features will return a "403 Forbidden" error. You can always do this later.
            </div>

            <div className="mt-6 flex gap-3">
              <button
                className="py-2.5 px-4 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                onClick={() => setStep(1)}
              >
                ← Back
              </button>
              <button
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: '#6366f1', color: '#fff', cursor: 'pointer' }}
                onClick={() => setStep(3)}
              >
                Done, continue →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <StepDots current={3} total={3} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Step 3 of 3</span>
            </div>

            <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Azure DevOps <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </h1>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Needed for the Pipeline Health Dashboard and Pipeline Optimizer. You can skip this now and add it later in Settings.
            </p>

            <div className="mb-5">
              <Field
                label="Personal Access Token"
                value={form.adoPat}
                onChange={set('adoPat')}
                type="password"
                show={showPat}
                onToggleShow={() => setShowPat(s => !s)}
                placeholder="your-devops-pat"
              />
            </div>

            <HowToGuide type="devops" />

            <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                AI features <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </h2>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Your administrator provides the shared Vantage AI agent. It performs dependency-aware pipeline optimization and flow-error explanations.
              </p>
              <label className="flex items-start gap-3 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={form.aiDataConsent}
                  onChange={event => setForm(current => ({ ...current, aiDataConsent: event.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  I understand that pipeline stage metadata and flow names/error messages are sent to Groq when I use AI features. Full credentials and complete pipeline files are not sent.
                </span>
              </label>
            </div>

            {error && (
              <p className="mt-4 text-xs rounded-lg px-3 py-2" style={{ color: '#f87171', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                onClick={() => { setStep(2); setError('') }}
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

        {step === 4 && (
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
              You're all set
            </h1>
            <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Your credentials are encrypted and saved on this machine. You won't need to do this again.
            </p>
            <button
              className="w-full py-2.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: '#6366f1', color: '#fff', cursor: 'pointer' }}
              onClick={onComplete}
            >
              Open Vantage →
            </button>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Credentials are encrypted at rest and stored locally on this machine.
      </p>
    </div>
  )
}
