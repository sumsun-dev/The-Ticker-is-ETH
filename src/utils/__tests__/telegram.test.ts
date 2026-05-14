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

  it('5월 14일 시점에 3월 활동자는 active (직전 윈도우 3-4월에 활동)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T00:00:00Z'))
    expect(isStillActive('2026-03-15T00:00:00Z')).toBe(true)
  })

  it('5월 14일 시점에 4월 활동자는 active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T00:00:00Z'))
    expect(isStillActive('2026-04-30T23:00:00Z')).toBe(true)
  })

  it('5월 14일 시점에 5월 활동자는 active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T00:00:00Z'))
    expect(isStillActive('2026-05-10T00:00:00Z')).toBe(true)
  })

  it('5월 14일 시점에 2월 활동자는 inactive (직전 윈도우 시작 3/1 이전)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T00:00:00Z'))
    expect(isStillActive('2026-02-28T23:59:59Z')).toBe(false)
  })

  it('7월 1일 윈도우 경계에서 3-4월 활동만 있으면 inactive (cutoff 5/1로 이동)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T00:00:00Z'))
    expect(isStillActive('2026-04-30T23:59:59Z')).toBe(false)
  })

  it('7월 1일 시점에 5-6월 활동자는 active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T00:00:00Z'))
    expect(isStillActive('2026-06-15T00:00:00Z')).toBe(true)
  })

  it('9월 1일 시점에 5-6월 활동만 있으면 inactive (cutoff 7/1)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'))
    expect(isStillActive('2026-06-30T23:59:59Z')).toBe(false)
  })

  it('9월 1일 시점에 7-8월 활동자는 active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'))
    expect(isStillActive('2026-07-15T00:00:00Z')).toBe(true)
  })

  it('윈도우 경계 직전(짝수월 마지막 날)에는 직전 윈도우 기준이 유지된다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-30T23:59:59Z'))
    expect(isStillActive('2026-03-15T00:00:00Z')).toBe(true)
  })

  it('연도 경계: 1월 시점은 직전 윈도우가 작년 11-12월', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
    expect(isStillActive('2025-11-15T00:00:00Z')).toBe(true)
    expect(isStillActive('2025-10-31T23:59:59Z')).toBe(false)
  })

  it('cutoff 경계 케이스: 윈도우 시작 정확히 자정 UTC 메시지는 active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T00:00:00Z'))
    expect(isStillActive('2026-03-01T00:00:00Z')).toBe(true)
    expect(isStillActive('2026-02-28T23:59:59Z')).toBe(false)
  })
})
