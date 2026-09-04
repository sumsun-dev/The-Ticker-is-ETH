/**
 * 이더리움 뉴스 수집기 — 소스 보드에서 승인된 소스만 수집한다.
 *   RSS      : EF 블로그, ethresear.ch, Ethereum Magicians, Vitalik, r/ethereum
 *   Twitter  : RapidAPI (scripts/config/twitter-accounts.json 워치리스트)
 *
 * 출력: src/data/eth-news-inbox.json — 표시/게시 로직과 분리된 원본 인박스.
 * 소스 하나가 실패해도 나머지는 계속 수집한다 (warn 후 진행).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { parseFeed, tweetsToItems, mergeInbox, detectDebates, type NewsItem } from './lib/eth-news';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const OUTPUT = path.resolve(process.cwd(), 'src/data/eth-news-inbox.json');
const USER_AGENT = 'eck-news-bot/1.0 (+https://ethcollective.xyz)';

const FEEDS = [
  { source: 'ef-blog', url: 'https://blog.ethereum.org/en/feed.xml' },
  { source: 'ethresearch', url: 'https://ethresear.ch/latest.rss' },
  { source: 'eth-magicians', url: 'https://ethereum-magicians.org/latest.rss' },
  { source: 'vitalik', url: 'https://vitalik.eth.limo/feed.xml' },
  { source: 'reddit-ethereum', url: 'https://www.reddit.com/r/ethereum/.rss' },
];

async function collectRss(): Promise<NewsItem[]> {
  const results: NewsItem[] = [];
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'user-agent': USER_AGENT } });
      if (!res.ok) {
        console.warn(`[WARN] ${feed.source}: HTTP ${res.status} — skipped`);
        continue;
      }
      const items = parseFeed(await res.text(), feed.source);
      console.log(`  ${feed.source}: ${items.length} items`);
      results.push(...items);
    } catch (error) {
      console.warn(`[WARN] ${feed.source} failed:`, error instanceof Error ? error.message : error);
    }
  }
  return results;
}

async function collectTwitter(): Promise<NewsItem[]> {
  // env 이름·엔드포인트·응답 계약은 ai-secondbrain의 twitter-rapidapi 수집기와 동일 (twitter-api45)
  const key = process.env.X_RAPIDAPI_KEY;
  if (!key) {
    console.log('  twitter: X_RAPIDAPI_KEY not set — skipped');
    return [];
  }
  const host = process.env.X_RAPIDAPI_HOST ?? 'twitter-api45.p.rapidapi.com';
  const configPath = path.resolve(process.cwd(), 'scripts/config/twitter-accounts.json');
  const { accounts } = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
    accounts: Array<{ screenname: string }>;
  };
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const headers = { 'x-rapidapi-key': key, 'x-rapidapi-host': host };
  const fetchTweets = async (endpoint: string, screenname: string): Promise<NewsItem[]> => {
    const res = await fetch(`https://${host}/${endpoint}.php?screenname=${encodeURIComponent(screenname)}`, { headers });
    if (!res.ok) {
      console.warn(`[WARN] x:${screenname} ${endpoint}: HTTP ${res.status} — skipped`);
      return [];
    }
    const body = await res.text();
    if (!body) {
      console.warn(`[WARN] x:${screenname} ${endpoint}: empty response — skipped`);
      return [];
    }
    return tweetsToItems(JSON.parse(body), screenname);
  };

  const timelineItems: NewsItem[] = [];
  const replyItems: NewsItem[] = [];
  for (let i = 0; i < accounts.length; i++) {
    const { screenname } = accounts[i];
    if (i > 0) await sleep(500);
    try {
      const tweets = (await fetchTweets('timeline', screenname)).slice(0, 50);
      await sleep(500);
      // 리플라이는 설전(교차 대화) 감지용 — 클러스터에 속한 것만 인박스에 담는다
      const replies = (await fetchTweets('replies', screenname)).slice(0, 30).map((r) => ({ ...r, isReply: true }));
      console.log(`  x:${screenname}: ${tweets.length} tweets, ${replies.length} replies`);
      timelineItems.push(...tweets);
      replyItems.push(...replies);
    } catch (error) {
      console.warn(`[WARN] x:${screenname} failed:`, error instanceof Error ? error.message : error);
    }
  }

  const debates = detectDebates([...timelineItems, ...replyItems]);
  const debateIds = new Set(debates.flatMap((d) => d.items.map((item) => item.id)));
  const debateReplies = replyItems.filter((item) => debateIds.has(item.id));
  console.log(`  debates: ${debates.length} clusters — keeping ${debateReplies.length}/${replyItems.length} replies`);
  return [...timelineItems, ...debateReplies];
}

async function main() {
  console.log('Collecting Ethereum news sources...');
  const [rss, tweets] = [await collectRss(), await collectTwitter()];
  // 뉴스 인박스이므로 피드가 쏟아내는 과거 아카이브는 버린다 (최근 30일만)
  const cutoff = Date.now() - 30 * 86_400_000;
  const incoming = [...rss, ...tweets].filter(
    (item) => new Date(item.publishedAt).getTime() >= cutoff,
  );

  let prev: NewsItem[] = [];
  if (fs.existsSync(OUTPUT)) {
    try {
      prev = (JSON.parse(fs.readFileSync(OUTPUT, 'utf-8')) as { items: NewsItem[] }).items ?? [];
    } catch {
      console.warn('[WARN] existing inbox unreadable — starting fresh');
    }
  }

  const items = mergeInbox(prev, incoming, 900);
  fs.writeFileSync(OUTPUT, JSON.stringify({ fetchedAt: new Date().toISOString(), items }, null, 2), 'utf-8');
  console.log(`\nWritten ${items.length} items (${incoming.length} fetched) to ${OUTPUT}`);
}

main().catch((error) => {
  console.warn('[WARN] fetch-eth-news failed:', error instanceof Error ? error.message : error);
  process.exit(0);
});
