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

// Bundles every article markdown at build time as lazy raw chunks.
// Removes runtime dependency on GitHub Contents API + PAT for reads.
const articleModules = import.meta.glob('../data/articles/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

export async function loadArticleContent(id: string): Promise<string | undefined> {
  const loader = articleModules[`../data/articles/${id}.md`];
  if (!loader) return undefined;
  try {
    return await loader();
  } catch {
    return undefined;
  }
}
