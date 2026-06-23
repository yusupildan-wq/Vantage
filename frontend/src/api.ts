export const API_URL = import.meta.env.VITE_API_URL ?? ''

let _apiKey: string | null = null

async function resolveApiKey(): Promise<string> {
  if (_apiKey !== null) return _apiKey
  if (import.meta.env.VITE_API_KEY) {
    _apiKey = import.meta.env.VITE_API_KEY
    return _apiKey
  }
  // Production: fetch key from backend (same-origin, served by Express)
  try {
    const res = await fetch(`${API_URL}/config`)
    const data = await res.json()
    _apiKey = data.apiKey ?? ''
  } catch {
    _apiKey = ''
  }
  return _apiKey
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const key = await resolveApiKey()
  return fetch(url, {
    ...options,
    headers: {
      'X-API-Key': key,
      ...options.headers,
    },
  })
}
