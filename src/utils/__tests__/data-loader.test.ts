import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns text content on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: () => Promise.resolve('# Article Content'),
    }))

    const result = await loadArticleContent('test-id')
    expect(result).toBe('# Article Content')
  })

  it('returns undefined on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      headers: new Headers(),
    }))

    const result = await loadArticleContent('bad-id')
    expect(result).toBeUndefined()
  })

  it('returns undefined when content-type is text/html', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
    }))

    const result = await loadArticleContent('html-id')
    expect(result).toBeUndefined()
  })

  it('returns undefined on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const result = await loadArticleContent('error-id')
    expect(result).toBeUndefined()
  })
})
