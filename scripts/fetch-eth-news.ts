/**
 * 이더리움 뉴스 수집기 — 소스 보드에서 승인된 소스만 수집한다.
 *   RSS      : EF 블로그, ethresear.ch, Ethereum Magicians, Vitalik, r/ethereum
 *   Twitter  : RapidAPI (scripts/config/twitter-accounts.json 워치리스트)
 *   Forkcast : EF Protocol Support의 코어 개발자 콜 기록 (feed.xml → GitHub 아티팩트 tldr·key_decisions), 2026-09-08 추가
 *
 * env: FETCH_SOURCES=rss,twitter,forkcast (기본 전부) · FETCH_DRY_RUN=1 (수집 결과만 출력, 인박스에 쓰지 않음)
 *
 * 출력: src/data/eth-news-inbox.json — 표시/게시 로직과 분리된 원본 인박스.
 * 소스 하나가 실패해도 나머지는 계속 수집한다 (warn 후 진행).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { parseFeed, tweetsToItems, mergeInbox, detectDebates, parseForkcastFeed, forkcastArtifactBase, forkcastToItem, type NewsItem } from './lib/eth-news';

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

/** Forkcast: 최근 30일 콜의 아티팩트를 받아 항목으로. 아티팩트가 아직 없으면(404) 피드 정보만으로 만든다. */
async function collectForkcast(): Promise<NewsItem[]> {
  const results: NewsItem[] = [];
  try {
    const res = await fetch('https://forkcast.org/feed.xml', { headers: { 'user-agent': USER_AGENT } });
    if (!res.ok) {
      console.warn(`[WARN] forkcast: HTTP ${res.status} — skipped`);
      return results;
    }
    const cutoff = Date.now() - 30 * 86_400_000;
    const calls = parseForkcastFeed(await res.text()).filter((c) => new Date(c.date).getTime() >= cutoff);
    const getJson = async (url: string): Promise<Record<string, unknown> | null> => {
      try {
        const r = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
        return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    };
    for (const call of calls) {
      const base = forkcastArtifactBase(call);
      const [tldr, decisions, config] = await Promise.all([getJson(`${base}/tldr.json`), getJson(`${base}/key_decisions.json`), getJson(`${base}/config.json`)]);
      results.push(forkcastToItem(call, tldr, decisions, config));
    }
    console.log(`  forkcast: ${results.length} calls (${results.filter((i) => /핵심 결정/.test(i.title)).length} with decisions)`);
  } catch (error) {
    console.warn('[WARN] forkcast failed:', error instanceof Error ? error.message : error);
  }
  return results;
}

async function main() {
  console.log('Collecting Ethereum news sources...');
  const sources = new Set((process.env.FETCH_SOURCES ?? 'rss,twitter,forkcast').split(',').map((s) => s.trim()));
  const rss = sources.has('rss') ? await collectRss() : [];
  const tweets = sources.has('twitter') ? await collectTwitter() : [];
  const forkcast = sources.has('forkcast') ? await collectForkcast() : [];
  if (process.env.FETCH_DRY_RUN) {
    for (const item of [...rss, ...tweets, ...forkcast]) console.log(`\n### ${item.source} | ${item.publishedAt.slice(0, 10)} | ${item.title}\n${item.summary.slice(0, 1200)}\n${item.url}`);
    return;
  }
  // 뉴스 인박스이므로 피드가 쏟아내는 과거 아카이브는 버린다 (최근 30일만)
  const cutoff = Date.now() - 30 * 86_400_000;
  const incoming = [...rss, ...tweets, ...forkcast].filter(
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
