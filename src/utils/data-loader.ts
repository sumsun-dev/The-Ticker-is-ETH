/**
 * Lazy JSON loader with cache.
 * Wraps dynamic import() so each JSON module is fetched at most once.
 */
const cache = new Map<string, unknown>();

export async function lazyLoadJson<T>(
  loader: () => Promise<{ default: T }>,
  key: string,
): Promise<T> {
  if (cache.has(key)) return cache.get(key) as T;
  const { default: data } = await loader();
  cache.set(key, data);
  return data;
}

export function loadTeamEnrichment() {
  return lazyLoadJson<unknown>(
    () => import('../data/team-enrichment.json'),
    'team-enrichment',
  );
}

/**
 * Load article content by ID.
 * Dev: fetches local .md file via Vite asset serving.
 * Prod: fetches from Vercel serverless API (GitHub-backed).
 */
export async function loadArticleContent(id: string): Promise<string | undefined> {
  const isDev = import.meta.env.DEV;

  if (isDev) {
    try {
      const res = await fetch(`/src/data/articles/${id}.md`);
      if (!res.ok) return undefined;
      const text = await res.text();
      if (text.startsWith('import ') || text.startsWith('export ')) return undefined;
      return text;
    } catch {
      return undefined;
    }
  }

  try {
    const res = await fetch(`/api/research/content?id=${encodeURIComponent(id)}`);
    if (!res.ok) return undefined;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) return undefined;
    return await res.text();
  } catch {
    return undefined;
  }
}
