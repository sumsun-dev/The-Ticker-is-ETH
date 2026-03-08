import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import usePageMeta from '../usePageMeta'

describe('usePageMeta', () => {
  const SITE_NAME = 'The Ticker is ETH'

  afterEach(() => {
    document.title = SITE_NAME
  })

  it('sets document title with site name suffix', () => {
    renderHook(() => usePageMeta({ title: 'About' }))
    expect(document.title).toBe(`About | ${SITE_NAME}`)
  })

  it('uses only site name when title is empty', () => {
    renderHook(() => usePageMeta({ title: '' }))
    expect(document.title).toBe(SITE_NAME)
  })

  it('restores site name on unmount', () => {
    const { unmount } = renderHook(() => usePageMeta({ title: 'Test' }))
    expect(document.title).toBe(`Test | ${SITE_NAME}`)
    unmount()
    expect(document.title).toBe(SITE_NAME)
  })

  it('sets meta description when provided', () => {
    renderHook(() => usePageMeta({ title: 'Team', description: 'Our team page' }))
    const meta = document.querySelector('meta[name="description"]')
    expect(meta?.getAttribute('content')).toBe('Our team page')
  })
})
