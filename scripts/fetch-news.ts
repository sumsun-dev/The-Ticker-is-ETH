import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';

interface AtomEntry {
  title: string;
  link: { '@_href': string } | Array<{ '@_href': string; '@_rel'?: string }>;
  published?: string;
  updated?: string;
  summary?: string;
  content?: { '#text'?: string } | string;
  author?: { name?: string } | string;
}

interface AtomFeed {
  feed: {
    title: string;
    subtitle?: string;
    entry: AtomEntry | AtomEntry[];
  };
}

function extractLink(link: AtomEntry['link']): string {
  if (Array.isArray(link)) {
    const alternate = link.find((l) => l['@_rel'] === 'alternate') ?? link[0];
    return alternate?.['@_href'] ?? '';
  }
  return link?.['@_href'] ?? '';
}

function extractId(link: string): string {
  // Extract date slug from URL like https://eth.rejamong.com/ko/posts/2026-02-20/
  const match = link.match(/\/(\d{4}-\d{2}-\d{2})\/?$/);
  if (match) return match[1];

  // Fallback: use last path segment
  const segments = link.replace(/\/$/, '').split('/');
  return segments[segments.length - 1] ?? 'unknown';
}

function extractContent(content: AtomEntry['content']): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object' && '#text' in content) return content['#text'] ?? '';
  return '';
}

function extractAuthor(author: AtomEntry['author']): string {
  if (typeof author === 'string') return author;
  if (author && typeof author === 'object' && 'name' in author) return author.name ?? '@r2jamong';
  return '@r2jamong';
}

async function main() {
  const RSS_URL = 'https://eth.rejamong.com/ko/feed.xml';
  console.log(`Fetching RSS feed from ${RSS_URL}...`);

  const response = await fetch(RSS_URL);
  if (!response.ok) {
    console.warn(`[WARN] RSS fetch failed: ${response.status} ${response.statusText} — keeping existing news-feed.json`);
    process.exit(0);
  }

  const xml = await response.text();
  console.log(`Received ${xml.length} bytes of XML`);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });

  const parsed = parser.parse(xml) as AtomFeed;
  const feed = parsed.feed;

  if (!feed) {
    console.warn('[WARN] Invalid Atom feed: no <feed> element found — keeping existing news-feed.json');
    process.exit(0);
  }

  const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [];
  console.log(`Found ${entries.length} entries`);

  const items = entries.map((entry) => {
    const link = extractLink(entry.link);
    return {
      id: extractId(link),
      title: typeof entry.title === 'string' ? entry.title : String(entry.title),
      link,
      published: entry.published ?? entry.updated ?? new Date().toISOString(),
      updated: entry.updated ?? entry.published ?? new Date().toISOString(),
      summary: typeof entry.summary === 'string' ? entry.summary : '',
      content: extractContent(entry.content),
      author: extractAuthor(entry.author),
    };
  });

  const output = {
    feedTitle: typeof feed.title === 'string' ? feed.title : String(feed.title),
    feedSubtitle: typeof feed.subtitle === 'string' ? feed.subtitle : '',
    fetchedAt: new Date().toISOString(),
    items,
  };

  const outputPath = path.resolve(process.cwd(), 'src/data/news-feed.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nWritten to ${outputPath}`);
  console.log(`Items: ${items.length}`);
  for (const item of items) {
    console.log(`  - [${item.id}] ${item.title}`);
  }
}

main().catch((err) => {
  console.warn('[WARN] Error fetching news:', err instanceof Error ? err.message : err, '— keeping existing news-feed.json');
  process.exit(0);
});
