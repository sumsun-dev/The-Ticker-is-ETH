/**
 * 이더리움 뉴스 수집기 — 소스 보드에서 승인된 소스만 수집한다.
 *   RSS      : EF 블로그, ethresear.ch, Ethereum Magicians, Vitalik, r/ethereum
 *   Twitter  : RapidAPI (scripts/config/twitter-accounts.json 워치리스트)
 *   Telegram : 코인니스 채널 (기존 유저 세션 재활용)
 *
 * 출력: src/data/eth-news-inbox.json — 표시/게시 로직과 분리된 원본 인박스.
 * 소스 하나가 실패해도 나머지는 계속 수집한다 (warn 후 진행).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { parseFeed, tweetsToItems, telegramToItems, mergeInbox, type NewsItem } from './lib/eth-news';

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

  const results: NewsItem[] = [];
  for (let i = 0; i < accounts.length; i++) {
    const { screenname } = accounts[i];
    if (i > 0) await sleep(500);
    try {
      const res = await fetch(`https://${host}/timeline.php?screenname=${encodeURIComponent(screenname)}`, {
        headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
      });
      if (!res.ok) {
        console.warn(`[WARN] x:${screenname}: HTTP ${res.status} — skipped`);
        continue;
      }
      const body = await res.text();
      if (!body) {
        console.warn(`[WARN] x:${screenname}: empty response — skipped`);
        continue;
      }
      const items = tweetsToItems(JSON.parse(body), screenname).slice(0, 50);
      console.log(`  x:${screenname}: ${items.length} tweets`);
      results.push(...items);
    } catch (error) {
      console.warn(`[WARN] x:${screenname} failed:`, error instanceof Error ? error.message : error);
    }
  }
  return results;
}

async function collectCoinness(): Promise<NewsItem[]> {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH ?? '';
  const session = process.env.TELEGRAM_SESSION ?? '';
  if (!apiId || !apiHash || !session) {
    console.log('  coinness: TELEGRAM_* env not set — skipped');
    return [];
  }
  const channel = process.env.COINNESS_CHANNEL ?? 'coinnesskr';
  try {
    const { TelegramClient } = await import('telegram');
    const { StringSession } = await import('telegram/sessions');
    const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
    await client.connect();
    const messages: Array<{ id: number; date: string; text: string }> = [];
    for await (const msg of client.iterMessages(channel, { limit: 80 })) {
      messages.push({
        id: msg.id,
        date: new Date((msg.date ?? 0) * 1000).toISOString(),
        text: msg.message ?? '',
      });
    }
    await client.disconnect();
    const items = telegramToItems(messages, channel);
    console.log(`  tg:${channel}: ${items.length} messages`);
    return items;
  } catch (error) {
    console.warn(`[WARN] tg:${channel} failed:`, error instanceof Error ? error.message : error);
    return [];
  }
}

async function main() {
  console.log('Collecting Ethereum news sources...');
  const [rss, tweets, coinness] = [await collectRss(), await collectTwitter(), await collectCoinness()];
  // 뉴스 인박스이므로 피드가 쏟아내는 과거 아카이브는 버린다 (최근 30일만)
  const cutoff = Date.now() - 30 * 86_400_000;
  const incoming = [...rss, ...tweets, ...coinness].filter(
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

  const items = mergeInbox(prev, incoming);
  fs.writeFileSync(OUTPUT, JSON.stringify({ fetchedAt: new Date().toISOString(), items }, null, 2), 'utf-8');
  console.log(`\nWritten ${items.length} items (${incoming.length} fetched) to ${OUTPUT}`);
}

main().catch((error) => {
  console.warn('[WARN] fetch-eth-news failed:', error instanceof Error ? error.message : error);
  process.exit(0);
});
