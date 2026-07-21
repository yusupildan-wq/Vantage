import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEnvironmentUrl } from './useEnvironmentUrl'

describe('useEnvironmentUrl', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('starts empty when nothing is saved', () => {
    const { result } = renderHook(() => useEnvironmentUrl('vtg_env_url'))
    expect(result.current[0]).toBe('')
  })

  it('reads an existing value under the current key', () => {
    localStorage.setItem('vtg_env_url', 'https://current.crm.dynamics.com')
    const { result } = renderHook(() => useEnvironmentUrl('vtg_env_url'))
    expect(result.current[0]).toBe('https://current.crm.dynamics.com')
  })

  it('migrates a legacy ala_-prefixed value on first read and removes the old key', () => {
    localStorage.setItem('ala_env_url', 'https://legacy.crm.dynamics.com')
    const { result } = renderHook(() => useEnvironmentUrl('vtg_env_url'))

    expect(result.current[0]).toBe('https://legacy.crm.dynamics.com')
    expect(localStorage.getItem('vtg_env_url')).toBe('https://legacy.crm.dynamics.com')
    expect(localStorage.getItem('ala_env_url')).toBeNull()
  })

  it('prefers the new key over a legacy key when both exist', () => {
    localStorage.setItem('vtg_env_url', 'https://new.crm.dynamics.com')
    localStorage.setItem('ala_env_url', 'https://old.crm.dynamics.com')
    const { result } = renderHook(() => useEnvironmentUrl('vtg_env_url'))

    expect(result.current[0]).toBe('https://new.crm.dynamics.com')
    // Legacy key is only migrated when the new key is absent — untouched here.
    expect(localStorage.getItem('ala_env_url')).toBe('https://old.crm.dynamics.com')
  })

  it('setUrl updates state and persists the trimmed value', () => {
    const { result } = renderHook(() => useEnvironmentUrl('vtg_env_url'))

    act(() => result.current[1]('  https://env.crm.dynamics.com  '))

    expect(result.current[0]).toBe('  https://env.crm.dynamics.com  ')
    expect(localStorage.getItem('vtg_env_url')).toBe('https://env.crm.dynamics.com')
  })

  it('setUrl with a blank value updates state but does not persist or clear storage', () => {
    localStorage.setItem('vtg_env_url', 'https://env.crm.dynamics.com')
    const { result } = renderHook(() => useEnvironmentUrl('vtg_env_url'))

    act(() => result.current[1]('   '))

    expect(result.current[0]).toBe('   ')
    // Known quirk: blanking the field leaves the previous saved URL in storage.
    expect(localStorage.getItem('vtg_env_url')).toBe('https://env.crm.dynamics.com')
  })

  it('keeps separate storage keys independent', () => {
    const { result: target } = renderHook(() => useEnvironmentUrl('vtg_target_url'))

    act(() => target.current[1]('https://target.crm.dynamics.com'))

    expect(localStorage.getItem('vtg_env_url')).toBeNull()
    expect(localStorage.getItem('vtg_target_url')).toBe('https://target.crm.dynamics.com')
  })
})
