import { useEffect, useState } from 'react'

interface ConfirmActionDialogProps {
  open: boolean
  title: string
  tone?: 'warning' | 'danger' | 'info'
  confirmLabel: string
  cancelLabel?: string
  requireCheck?: boolean
  checkLabel?: string
  isWorking?: boolean
  details: Array<{ label: string; value: string }>
  body: string
  onCancel: () => void
  onConfirm: () => void
}

const TONE = {
  warning: { color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.28)', button: '#b45309' },
  danger:  { color: '#f87171', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.28)',  button: '#dc2626' },
  info:    { color: '#2dd4bf', bg: 'rgba(45,212,191,0.08)', border: 'rgba(45,212,191,0.28)', button: '#0f766e' },
} as const

export default function ConfirmActionDialog({
  open,
  title,
  tone = 'warning',
  confirmLabel,
  cancelLabel = 'Cancel',
  requireCheck = true,
  checkLabel = 'I understand this will change an external system.',
  isWorking = false,
  details,
  body,
  onCancel,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [checked, setChecked] = useState(false)
  const style = TONE[tone]

  useEffect(() => {
    if (open) setChecked(false)
  }, [open])

  if (!open) return null

  const canConfirm = !isWorking && (!requireCheck || checked)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={isWorking ? undefined : onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        className="relative w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'var(--bg-surface)', border: `1px solid ${style.border}` }}
      >
        <div className="px-5 py-4 flex items-start gap-3" style={{ backgroundColor: style.bg, borderBottom: `1px solid ${style.border}` }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: style.color, border: `1px solid ${style.border}` }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              {tone === 'danger'
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5zm9-4.5a9 9 0 11-18 0 9 9 0 0118 0z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M12 8.25h.008v.008H12V8.25zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
            </svg>
          </div>
          <div>
            <h2 id="confirm-action-title" className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {body}
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {details.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                className="px-4 py-3 flex items-start justify-between gap-4"
                style={{ borderBottom: index < details.length - 1 ? '1px solid var(--border)' : undefined }}
              >
                <span className="text-xs font-semibold tracking-wider uppercase flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {item.label}
                </span>
                <span className="text-xs text-right break-words" style={{ color: 'var(--text-secondary)' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {requireCheck && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={e => setChecked(e.target.checked)}
                disabled={isWorking}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-transparent"
              />
              <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {checkLabel}
              </span>
            </label>
          )}
        </div>

        <div className="px-5 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isWorking}
            className="px-4 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-40"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-bright)' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: style.button }}
          >
            {isWorking && <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            {isWorking ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
