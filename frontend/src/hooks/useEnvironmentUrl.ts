import { useState } from 'react'

export function useEnvironmentUrl(storageKey = 'ala_env_url'): [string, (v: string) => void] {
  const [url, setUrlState] = useState<string>(() => localStorage.getItem(storageKey) ?? '')

  function setUrl(next: string) {
    setUrlState(next)
    if (next.trim()) localStorage.setItem(storageKey, next.trim())
  }

  return [url, setUrl]
}
