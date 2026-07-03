import * as fs from 'fs';
import * as path from 'path';

// --- Types matching raw JSON structure ---

interface LinkEntity {
  offset: number;
  length: number;
  url: string;
}

interface RawMessage {
  id: number;
  date: string;
  text: string;
  postAuthor: string;
  views: number;
  forwards: number;
  forwarded?: boolean;
  forwardedFrom?: string;
  linkEntities?: LinkEntity[];
  imageUrls?: string[];
}

interface RawContributor {
  name: string;
  messageCount: number;
  firstMessageDate: string;
  lastMessageDate: string;
  messages: RawMessage[];
}

interface TelegramData {
  channel: string;
  fetchedAt: string;
  totalMessages: number;
  contributors: RawContributor[];
}

// --- Output types ---

interface Activity {
  id: string;
  date: string;
  type: string;
  content: string;
  link: string;
  views?: number;
  forwards?: number;
  sourceUrl?: string;
}

interface EnrichedContributor {
  name: string;
  messageCount: number;
  firstMessageDate: string;
  lastMessageDate: string;
  /** Sparse map: only dates with count > 0. Key = "YYYY-MM-DD", value = count */
  contributionMap: Record<string, number>;
  recentActivity: Activity[];
}

interface TeamEnrichment {
  channel: string;
  contributors: EnrichedContributor[];
}

interface ResearchArticle {
  id: string;
  title: string;
  author: string;
  authorId: string;
  authorAvatar: string;
  date: string;
  category: string;
  forwardedFrom?: string;
  summary: string;
  content: string;
  thumbnailUrl: string;
  readTime: string;
}

// --- Utility functions (replicated from src/utils/telegram.ts) ---

function formatDate(dateInput: string | Date): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  // Use UTC so output is deterministic regardless of the runner's timezone
  // (CI runs in UTC; local machines may not), avoiding spurious date churn.
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}

function extractFirstSentence(text: string): string {
  const cleaned = text.replace(/\n+/g, ' ').trim();
  const match = cleaned.match(/^.+?[.!?]\s/);
  const sentence = match ? match[0].trim() : cleaned;
  return sentence.length > 100 ? sentence.slice(0, 97) + '...' : sentence;
}

function buildContributionMap(messages: { date: string }[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const msg of messages) {
    const key = msg.date.slice(0, 10);
    map[key] = (map[key] ?? 0) + 1;
  }
  return map;
}

function buildActivityLog(
  contributor: RawContributor,
  channel: string,
): Activity[] {
  const recentMessages = [...contributor.messages]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return recentMessages.map((msg) => {
    const urlMatch = msg.text.match(/https?:\/\/[^\s),]+/);
    const activity: Activity = {
      id: `tg-${msg.id}`,
      date: new Date(msg.date)
        .toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          timeZone: 'UTC',
        })
        .replace(/\. /g, '.')
        .replace(/\.$/, ''),
      type: 'telegram',
      content: extractFirstSentence(msg.text),
      link: `https://t.me/${channel}/${msg.id}`,
    };
    if (msg.views) activity.views = msg.views;
    if (msg.forwards) activity.forwards = msg.forwards;
    // Prefer an inline URL; otherwise fall back to the first hidden hyperlink.
    if (urlMatch?.[0]) activity.sourceUrl = urlMatch[0];
    else if (msg.linkEntities?.[0]) activity.sourceUrl = msg.linkEntities[0].url;
    return activity;
  });
}

/**
 * Reconstruct hidden hyperlinks by splicing `[display](url)` into the text at
 * each entity's offset. Processed back-to-front so earlier offsets stay valid.
 */
function applyLinkEntities(text: string, entities?: LinkEntity[]): string {
  if (!entities?.length) return text;
  const origLen = text.length;
  const sorted = [...entities].sort((a, b) => b.offset - a.offset);
  let result = text;
  for (const e of sorted) {
    // Skip entities that fall outside the (possibly truncated) text.
    if (e.offset < 0 || e.offset + e.length > origLen) continue;
    const display = result.slice(e.offset, e.offset + e.length);
    result = result.slice(0, e.offset) + `[${display}](${e.url})` + result.slice(e.offset + e.length);
  }
  return result;
}

function formatTelegramToMarkdown(
  text: string,
  linkEntities?: LinkEntity[],
  imageUrls?: string[],
  alt = '',
): string {
  const body = applyLinkEntities(text, linkEntities)
    // Auto-link bare URLs, but leave those already inside a markdown link intact.
    .replace(/(?<!\[|\()(https?:\/\/[^\s),\]]+)/g, '[$1]($1)')
    .replace(/\n{1,}/g, '\n\n');

  if (!imageUrls?.length) return body;

  // Sanitize alt for markdown (brackets would break the syntax).
  const safeAlt = alt.replace(/[[\]]/g, '').trim() || 'ECK 텔레그램 이미지';
  const multi = imageUrls.length > 1;
  const images = imageUrls
    // Add a "(n/total)" suffix for multi-image posts so each alt is unique;
    // duplicate identical alt text is an SEO smell.
    .map((url, i) => `![${safeAlt}${multi ? ` (${i + 1}/${imageUrls.length})` : ''}](${url})`)
    .join('\n\n');
  // Images lead the article so they appear at the top of the body, above the text.
  return body ? `${images}\n\n${body}` : images;
}

// --- Main ---

function main() {
  const root = process.cwd();
  const inputPath = path.resolve(root, 'src/data/telegram-contributors.json');
  const teamOutputPath = path.resolve(root, 'src/data/team-enrichment.json');
  const researchIndexPath = path.resolve(root, 'src/data/research-index.json');
  const articlesDir = path.resolve(root, 'src/data/articles');

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const data: TelegramData = JSON.parse(raw);

  console.log(
    `Processing ${data.totalMessages} messages from ${data.contributors.length} contributors...`,
  );

  // --- Generate team-enrichment.json ---
  const enrichedContributors: EnrichedContributor[] = data.contributors.map(
    (contributor) => ({
      name: contributor.name,
      messageCount: contributor.messageCount,
      firstMessageDate: contributor.firstMessageDate,
      lastMessageDate: contributor.lastMessageDate,
      contributionMap: buildContributionMap(contributor.messages),
      recentActivity: buildActivityLog(contributor, data.channel),
    }),
  );

  const teamEnrichment: TeamEnrichment = {
    channel: data.channel,
    contributors: enrichedContributors,
  };

  fs.writeFileSync(teamOutputPath, JSON.stringify(teamEnrichment), 'utf-8');
  const teamSize = (fs.statSync(teamOutputPath).size / 1024).toFixed(1);
  console.log(`Written: team-enrichment.json (${teamSize} KB)`);

  // --- Generate research-index.json + individual article .md files ---
  if (!fs.existsSync(articlesDir)) {
    fs.mkdirSync(articlesDir, { recursive: true });
  }

  // Preserve manually-published entries (research-* IDs) so the sync run
  // does not wipe entries added via the publish API.
  const preservedEntries: Omit<ResearchArticle, 'content'>[] = [];
  if (fs.existsSync(researchIndexPath)) {
    try {
      const existingRaw = fs.readFileSync(researchIndexPath, 'utf-8');
      const existing = JSON.parse(existingRaw) as Array<Omit<ResearchArticle, 'content'>>;
      for (const entry of existing) {
        if (!entry.id?.startsWith('tg-')) preservedEntries.push(entry);
      }
    } catch (err) {
      console.warn('[preprocess-telegram] failed to parse existing research-index.json:', err);
    }
  }

  const index: Omit<ResearchArticle, 'content'>[] = [];
  let articlesWritten = 0;

  for (const contributor of data.contributors) {
    const avatar = `/assets/team/${contributor.name.toLowerCase()}.jpg`;

    for (const msg of contributor.messages) {
      const hasImages = Boolean(msg.imageUrls?.length);
      // Keep posts with meaningful text, or image-only posts.
      if (msg.text.length < 10 && !hasImages) continue;

      const text = msg.text;
      const id = `tg-${msg.id}`;
      const tagMatch = text.match(/^\[([^\]]+)\]/);
      const derivedTitle = tagMatch
        ? tagMatch[1]
        : text.split('\n')[0].slice(0, 80).replace(/\s+$/, '');
      // Image-only posts have no text to derive a title from; use a descriptive,
      // author-attributed fallback instead of a bare "Image" (better UX + alt/SEO).
      const title = derivedTitle || `${contributor.name}님이 공유한 이미지`;
      const readTime = `${Math.max(1, Math.round(text.length / 500))} min`;
      const date = formatDate(msg.date);

      const category = msg.forwarded ? 'Forwarded' : 'Short';
      const summary = text.slice(0, 200).replace(/\n+/g, ' ').trim();

      const entry: Omit<ResearchArticle, 'content'> = {
        id,
        title,
        author: contributor.name,
        authorId: '',
        authorAvatar: avatar,
        date,
        category,
        summary,
        // Use the first attached photo as the card thumbnail when present.
        thumbnailUrl: msg.imageUrls?.[0] ?? '',
        readTime,
      };

      if (msg.forwarded && msg.forwardedFrom) {
        entry.forwardedFrom = msg.forwardedFrom;
      }

      index.push(entry);

      const articlePath = path.resolve(articlesDir, `${id}.md`);
      fs.writeFileSync(
        articlePath,
        formatTelegramToMarkdown(text, msg.linkEntities, msg.imageUrls, title),
        'utf-8',
      );
      articlesWritten++;
    }
  }

  const merged = [...preservedEntries, ...index];
  merged.sort((a, b) => b.date.localeCompare(a.date));

  fs.writeFileSync(researchIndexPath, JSON.stringify(merged), 'utf-8');
  const indexSize = (fs.statSync(researchIndexPath).size / 1024).toFixed(1);
  console.log(`Written: research-index.json (${indexSize} KB)`);
  console.log(`Written: ${articlesWritten} article .md files → src/data/articles/`);

  // --- Summary ---
  const inputSize = (fs.statSync(inputPath).size / 1024).toFixed(1);
  console.log(`\nSummary:`);
  console.log(`  Input:  telegram-contributors.json (${inputSize} KB)`);
  console.log(`  Output: team-enrichment.json (${teamSize} KB) + research-index.json (${indexSize} KB) + ${articlesWritten} article .md files`);
  console.log('Preprocessing complete.');
}

main();
