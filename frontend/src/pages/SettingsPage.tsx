import { useState, useEffect } from 'react'
import { API_URL, apiFetch } from '../api'

interface CurrentConfig {
  azureTenantId: string
  azureClientId: string
  azureClientSecretMasked: string
  azureDevOpsPatMasked: string
  hasDevOpsPat: boolean
}

function Field({
  label, hint, placeholder, value, onChange, type = 'text', masked,
}: {
  label: string
  hint?: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  type?: string
  masked?: string
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
        {label}
      </label>
      {hint && <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      <div className="relative">
        <input
          type={isPassword && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={masked ? `Current: ${masked}` : placeholder}
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-mid)',
            color: 'var(--text-primary)',
            caretColor: 'var(--accent-bright)',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(129,140,248,0.5)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [config, setConfig] = useState<CurrentConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [devOpsPat, setDevOpsPat] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    apiFetch(`${API_URL}/api/setup/current`)
      .then(r => r.json())
      .then(d => { setConfig(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setSaveStatus('idle')
    try {
      const body: Record<string, string> = {}
      if (tenantId.trim())     body.azureTenantId = tenantId.trim()
      if (clientId.trim())     body.azureClientId = clientId.trim()
      if (clientSecret.trim()) body.azureClientSecret = clientSecret.trim()
      if (devOpsPat.trim())    body.azureDevOpsPat = devOpsPat.trim()

      if (Object.keys(body).length === 0) {
        setSaveStatus('error')
        setSaveError('No changes to save — fill in any field you want to update.')
        setSaving(false)
        return
      }

      const resp = await apiFetch(`${API_URL}/api/setup/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!resp.ok) {
        const d = await resp.json()
        throw new Error(d.error ?? 'Failed to save')
      }

      setTenantId('')
      setClientId('')
      setClientSecret('')
      setDevOpsPat('')

      const refreshed = await apiFetch(`${API_URL}/api/setup/current`).then(r => r.json())
      setConfig(refreshed)
      setSaveStatus('success')
    } catch (err) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    setResetting(true)
    try {
      await apiFetch(`${API_URL}/api/setup/reset`, { method: 'POST' })
      window.location.reload()
    } catch {
      setResetting(false)
      setConfirmReset(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="font-display text-3xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Update your Azure credentials. Leave a field blank to keep the current value.
        </p>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <>
          {/* Current config summary */}
          <div className="rounded-xl p-5 mb-8" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: 'var(--text-muted)' }}>
              Current Configuration
            </p>
            <div className="space-y-2">
              {[
                { label: 'Tenant ID', value: config?.azureTenantId },
                { label: 'Client ID', value: config?.azureClientId },
                { label: 'Client Secret', value: config?.azureClientSecretMasked },
                { label: 'DevOps PAT', value: config?.hasDevOpsPat ? config.azureDevOpsPatMasked : 'Not set' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Update form */}
          <div className="rounded-xl p-6 mb-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold tracking-wider uppercase mb-6" style={{ color: 'var(--text-muted)' }}>
              Update Credentials
            </p>
            <div className="space-y-5">
              <Field label="Azure Tenant ID" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={tenantId} onChange={setTenantId} masked={config?.azureTenantId ? `${config.azureTenantId.slice(0,8)}…` : undefined} />
              <Field label="Client ID (Application ID)" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={clientId} onChange={setClientId} masked={config?.azureClientId ? `${config.azureClientId.slice(0,8)}…` : undefined} />
              <Field label="Client Secret" placeholder="Enter new secret value" value={clientSecret} onChange={setClientSecret} type="password" masked={config?.azureClientSecretMasked} />
              <Field label="Azure DevOps PAT" hint="Required for Pipeline Health Dashboard and Pipeline Optimizer." placeholder="Enter new PAT" value={devOpsPat} onChange={setDevOpsPat} type="password" masked={config?.hasDevOpsPat ? config.azureDevOpsPatMasked : undefined} />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: 'linear-gradient(135deg, rgba(91,95,199,0.4), rgba(91,95,199,0.2))',
                  border: '1px solid rgba(129,140,248,0.35)',
                  color: '#a5b4fc',
                  opacity: saving ? 0.6 : 1,
                  cursor: saving ? 'wait' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>

              {saveStatus === 'success' && (
                <span className="text-sm font-medium" style={{ color: '#4ade80' }}>✓ Saved</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-sm" style={{ color: '#f87171' }}>{saveError}</span>
              )}
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-xs font-semibold tracking-wider uppercase mb-1" style={{ color: '#f87171' }}>
              Danger Zone
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Reset Vantage to factory settings. This deletes all saved credentials and forces you through setup again on next launch.
            </p>
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer' }}
              >
                Reset Vantage
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={reset}
                  disabled={resetting}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#f87171', cursor: resetting ? 'wait' : 'pointer' }}
                >
                  {resetting ? 'Resetting…' : 'Yes, reset everything'}
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
