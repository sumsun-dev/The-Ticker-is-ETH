import { describe, it, expect, vi } from 'vitest'
import { lazyLoadJson, loadArticleContent } from '../data-loader'

describe('lazyLoadJson', () => {
  it('loads and caches JSON data', async () => {
    const mockData = { items: [1, 2, 3] }
    const loader = vi.fn().mockResolvedValue({ default: mockData })

    const result1 = await lazyLoadJson(loader, 'test-key-1')
    expect(result1).toEqual(mockData)
    expect(loader).toHaveBeenCalledTimes(1)

    const result2 = await lazyLoadJson(loader, 'test-key-1')
    expect(result2).toEqual(mockData)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('uses different cache keys for different resources', async () => {
    const loader1 = vi.fn().mockResolvedValue({ default: 'a' })
    const loader2 = vi.fn().mockResolvedValue({ default: 'b' })

    const r1 = await lazyLoadJson(loader1, 'key-a')
    const r2 = await lazyLoadJson(loader2, 'key-b')

    expect(r1).toBe('a')
    expect(r2).toBe('b')
  })
})

describe('loadArticleContent', () => {
  it('returns raw markdown for an existing article id', async () => {
    const result = await loadArticleContent('tg-1000')
    expect(typeof result).toBe('string')
    expect((result ?? '').length).toBeGreaterThan(0)
  })

  it('returns undefined for an unknown article id', async () => {
    const result = await loadArticleContent('does-not-exist')
    expect(result).toBeUndefined()
  })

  it('returns undefined when id contains path traversal', async () => {
    const result = await loadArticleContent('../secrets')
    expect(result).toBeUndefined()
  })
})
