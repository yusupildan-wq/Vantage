export const API_URL = import.meta.env.VITE_API_URL ?? ''

let sessionPromise: Promise<void> | null = null

async function ensureSession(): Promise<void> {
  if (!sessionPromise) {
    sessionPromise = fetch(`${API_URL}/session`, {
      method: 'POST',
      credentials: 'include',
    }).then(response => {
      if (!response.ok) throw new Error('Could not establish a local Vantage session.')
    }).catch(error => {
      sessionPromise = null
      throw error
    })
  }
  return sessionPromise
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  await ensureSession()
  const apiKey = import.meta.env.VITE_API_KEY
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      ...options.headers,
    },
  })
}
