export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const API_KEY = import.meta.env.VITE_API_KEY ?? ''

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'X-API-Key': API_KEY,
      ...options.headers,
    },
  })
}
