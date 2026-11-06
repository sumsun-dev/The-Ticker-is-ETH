#!/usr/bin/env node
/**
 * 텔레그램 채널 구독자 수를 하루 한 번 /var/lib/ethcollective/tg-daily.json에 쌓는다 (wp-vps cron, 매일 23:50 KST).
 * 봇 토큰 없이 공개 채널 소개 페이지(t.me/<채널>)의 "1 506 subscribers"를 읽는다. /api/admin/stats가 이 파일을 tgDaily로 붙여 준다.
 * 주 1회 수집(scripts/local/weekly-stats.ts)은 stats-history.json을 통째로 다시 쓰므로, 겹쳐 쓰지 않게 파일을 따로 둔다.
 *
 * cron: 50 14 * * * root /usr/bin/node /opt/ethcollective/repo/deploy/tg-subscribers.mjs >> /var/log/ethcollective-tg.log 2>&1
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CHANNEL = process.env.TG_CHANNEL ?? 'thetickeriseth';
const FILE = process.env.TG_DAILY_FILE ?? '/var/lib/ethcollective/tg-daily.json';

/** "1 506 subscribers" → 1506. 반올림 표기(1.5K)나 형식이 바뀌면 null */
export function parseSubscribers(html) {
  const m = /tgme_page_extra">([\d\s ]+) subscribers/.exec(html);
  if (!m) return null;
  const n = Number(m[1].replace(/[\s ]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 같은 날은 덮어쓰고 날짜순 */
export function upsertDay(list, day) {
  return [...list.filter((d) => d.date !== day.date), day].sort((a, b) => a.date.localeCompare(b.date));
}

async function main() {
  const res = await fetch(`https://t.me/${CHANNEL}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`t.me ${res.status}`);
  const subscribers = parseSubscribers(await res.text());
  if (subscribers === null) throw new Error('구독자 수를 찾지 못함 (페이지 형식 변경?)');
  const date = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  let list = [];
  try {
    list = JSON.parse(readFileSync(FILE, 'utf-8'));
  } catch {
    // 첫 실행
  }
  writeFileSync(`${FILE}.tmp`, JSON.stringify(upsertDay(list, { date, subscribers })));
  renameSync(`${FILE}.tmp`, FILE);
  process.stdout.write(`[tg-daily] ${new Date().toISOString()} ${date} ${subscribers}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    process.stderr.write(`[tg-daily] ${new Date().toISOString()} 실패: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  });
}
