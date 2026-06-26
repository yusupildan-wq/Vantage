import { useState } from 'react'

export function useEnvironmentUrl(storageKey = 'vtg_env_url'): [string, (v: string) => void] {
  const [url, setUrlState] = useState<string>(() => {
    const current = localStorage.getItem(storageKey)
    if (current !== null) return current
    // One-time migration from the old 'ala_' prefix
    const oldKey = storageKey.replace(/^vtg_/, 'ala_')
    const legacy = localStorage.getItem(oldKey)
    if (legacy !== null) {
      localStorage.setItem(storageKey, legacy)
      localStorage.removeItem(oldKey)
      return legacy
    }
    return ''
  })

  function setUrl(next: string) {
    setUrlState(next)
    if (next.trim()) localStorage.setItem(storageKey, next.trim())
  }

  return [url, setUrl]
}
