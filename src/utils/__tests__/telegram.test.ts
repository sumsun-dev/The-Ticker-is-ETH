import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatDate, isStillActive } from '../telegram'

describe('formatDate', () => {
  it('formats Date object as YYYY.MM.DD', () => {
    const result = formatDate(new Date(2025, 0, 5))
    expect(result).toBe('2025.01.05')
  })

  it('formats ISO string as YYYY.MM.DD', () => {
    const result = formatDate('2025-03-15T00:00:00Z')
    expect(result).toMatch(/2025\.03\.1[45]/)
  })

  it('pads single-digit months and days', () => {
    const result = formatDate(new Date(2024, 2, 3))
    expect(result).toBe('2024.03.03')
  })
})

describe('isStillActive', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true for a date within the last month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15'))
    expect(isStillActive('2025-06-01')).toBe(true)
  })

  it('returns false for a date older than one month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15'))
    expect(isStillActive('2025-04-01')).toBe(false)
  })

  it('returns true for today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15'))
    expect(isStillActive('2025-06-15')).toBe(true)
  })

  it('returns true for exactly one month ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15'))
    expect(isStillActive('2025-05-15')).toBe(true)
  })
})
