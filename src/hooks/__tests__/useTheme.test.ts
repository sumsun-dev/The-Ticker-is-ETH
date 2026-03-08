import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTheme } from '../useTheme'

describe('useTheme', () => {
  it('always returns dark theme', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
    expect(result.current.isDark).toBe(true)
  })

  it('toggleTheme is a no-op', () => {
    const { result } = renderHook(() => useTheme())

    result.current.toggleTheme()

    expect(result.current.theme).toBe('dark')
    expect(result.current.isDark).toBe(true)
  })
})
