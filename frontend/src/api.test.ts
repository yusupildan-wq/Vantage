import { describe, it, expect, beforeEach, vi } from 'vitest'

// api.ts caches its session promise at module scope, so each test needs a fresh import.
async function freshApiModule() {
  vi.resetModules()
  return import('./api')
}

describe('apiFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('establishes a session before the first request', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // POST /session
      .mockResolvedValueOnce(new Response('ok', { status: 200 })) // actual request

    const { apiFetch } = await freshApiModule()
    await apiFetch('/scan')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('/session')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(fetchMock.mock.calls[1][0]).toBe('/scan')
  })

  it('only establishes the session once across concurrent and sequential requests', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }))

    const { apiFetch } = await freshApiModule()
    await Promise.all([apiFetch('/a'), apiFetch('/b')])
    await apiFetch('/c')

    const sessionCalls = fetchMock.mock.calls.filter(call => String(call[0]).includes('/session'))
    expect(sessionCalls).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(4) // 1 session + 3 requests
  })

  it('retries the session on the next call after a failed session request', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 })) // session fails
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // session retried, succeeds
      .mockResolvedValueOnce(new Response('ok', { status: 200 })) // actual request

    const { apiFetch } = await freshApiModule()
    await expect(apiFetch('/scan')).rejects.toThrow('Could not establish a local Vantage session.')
    await apiFetch('/scan')

    const sessionCalls = fetchMock.mock.calls.filter(call => String(call[0]).includes('/session'))
    expect(sessionCalls).toHaveLength(2)
  })

  it('sends credentials on every request', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }))

    const { apiFetch } = await freshApiModule()
    await apiFetch('/scan')

    expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: 'include' })
  })

  it('lets caller-supplied headers override defaults', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }))

    const { apiFetch } = await freshApiModule()
    await apiFetch('/scan', { headers: { 'Content-Type': 'application/json' } })

    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ 'Content-Type': 'application/json' })
  })
})
