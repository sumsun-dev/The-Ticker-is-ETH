/**
 * 홈페이지·텔레그램·LinkedIn 주간 성과를 오너 텔레그램 DM으로 보낸다 (맥 전용, launchd 월요일 09:00).
 * 홈페이지는 wp-vps nginx 로그를 ssh로 읽고, 텔레그램은 봇 API(구독자)와 공개 웹 뷰(조회수), LinkedIn은 linkedin-channel-post.ts --analytics(로그인된 전용 크롬 프로필)로 읽는다.
 * 구독자·팔로워 전주 대비는 ~/.eck/weekly-stats.json 스냅샷과 비교한다. 한 채널이 실패해도 나머지는 보낸다.
 *
 * Usage:
 *   npx tsx scripts/local/weekly-stats.ts          # 집계 후 DM
 *   npx tsx scripts/local/weekly-stats.ts --dry    # 출력만 (DM·스냅샷 저장 안 함)
 * Env: TELEGRAM_BOT_TOKEN, LINKEDIN_ALERT_CHAT|VITALIK_ALERT_CHAT, WP_HOST (기본 wp-vps), TG_CHANNEL (기본 thetickeriseth), WEEK_END (YYYY-MM-DD, 수동 구간)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as dotenv from 'dotenv';
import { formatReport, lastWeek, parseLinkedIn, parseLogLine, parseTgPosts, prevWeek, siteStats, inWindowKst, type LiPost, type LogLine, type Report, type Snapshot, type TgPost, type Window } from '../lib/weekly-stats';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

const DRY = process.argv.includes('--dry');
const CHANNEL = process.env.TG_CHANNEL ?? 'thetickeriseth';
const WP_HOST = process.env.WP_HOST ?? 'wp-vps';
const SNAP = join(homedir(), '.eck', 'weekly-stats.json');
const log = (m: string) => process.stderr.write(`[weekly-stats] ${m}\n`);
const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

function window(): Window {
  if (!process.env.WEEK_END) return lastWeek(new Date());
  const end = process.env.WEEK_END;
  return { start: new Date(Date.parse(end) - 6 * 864e5).toISOString().slice(0, 10), end };
}

function site(w: Window): Report['site'] {
  // 로그는 여러 vhost가 섞여 있어 서버에서 ethcollective.xyz만 걸러 받는다 (보관 14일이라 전주 비교까지 가능)
  const raw = execFileSync('ssh', [WP_HOST, `zcat -f /var/log/nginx/access.log* | awk '$NF=="ethcollective.xyz"'`], { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024, timeout: 120_000 });
  const lines = raw.split('\n').map(parseLogLine).filter((l): l is LogLine => l !== null);
  const pw = prevWeek(w);
  const oldest = Math.min(...lines.map((l) => l.time.getTime()));
  // 전주 첫날(KST 0시)보다 오래된 로그가 있어야 전주 비교가 의미 있다
  const covered = oldest <= Date.parse(`${pw.start}T00:00:00+09:00`);
  return { cur: siteStats(lines, w), ...(covered ? { prev: siteStats(lines, pw) } : {}) };
}

async function telegram(w: Window): Promise<Report['tg']> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN 없음');
  const res = (await (await fetch(`https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=@${CHANNEL}`)).json()) as { ok: boolean; result?: number; description?: string };
  if (!res.ok || res.result === undefined) throw new Error(`getChatMemberCount: ${res.description}`);
  // 웹 뷰는 한 번에 20개 안팎. 구간 시작보다 오래된 글이 나올 때까지 앞으로 넘긴다
  const posts: TgPost[] = [];
  let before = '';
  for (let i = 0; i < 20; i++) {
    const html = await (await fetch(`https://t.me/s/${CHANNEL}${before}`)).text();
    const page = parseTgPosts(html, CHANNEL);
    if (!page.length) break;
    posts.push(...page);
    if (page.some((p) => p.date && p.date.slice(0, 10) < w.start)) break;
    before = `?before=${Math.min(...page.map((p) => p.id))}`;
  }
  const seen = new Set<number>();
  const week = posts.filter((p) => p.date && inWindowKst(new Date(p.date), w) && !seen.has(p.id) && seen.add(p.id));
  return { channel: CHANNEL, subscribers: res.result, posts: week };
}

function linkedin(w: Window): Report['li'] {
  // ponytail: 게시 작업(10:30·18:30)과 시간을 나눠 잠금 없이 돈다. 겹치게 옮기면 잠금을 공유해야 한다
  const out = execFileSync('npx', ['tsx', 'scripts/local/linkedin-channel-post.ts', '--analytics', `--since=${w.start}`], { encoding: 'utf-8', timeout: 180_000, maxBuffer: 32 * 1024 * 1024 });
  const json = out.split('\n').find((l) => l.startsWith('{'));
  if (!json) throw new Error('분석 화면 출력 없음');
  const { followers, updates, posts } = JSON.parse(json) as { followers: string; updates: string; posts: LiPost[] };
  return { ...parseLinkedIn(followers, updates), posts };
}

/** 많이 들어온 페이지의 제목. 정적 셸(콘텐츠·논쟁·멤버)에만 고유 제목이 있고, 나머지는 사이트 기본 제목이라 버린다 */
async function pageTitles(paths: string[]): Promise<Record<string, string>> {
  const titleOf = async (p: string) => {
    const html = await (await fetch(`https://ethcollective.xyz${p}`, { signal: AbortSignal.timeout(10_000) })).text();
    return (/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '').replace(/\s*\|\s*ECK.*$/, '').replace(/&amp;/g, '&').trim();
  };
  const home = await titleOf('/').catch(() => '');
  const entries = await Promise.all(paths.map(async (p) => [p, await titleOf(p).catch(() => '')] as const));
  return Object.fromEntries(entries.filter(([p, t]) => p !== '/' && t && t !== home));
}

async function send(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.LINKEDIN_ALERT_CHAT ?? process.env.VITALIK_ALERT_CHAT;
  if (!token || !chat) throw new Error('TELEGRAM_BOT_TOKEN 또는 알림 DM chat id 없음');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`sendMessage ${res.status}: ${await res.text()}`);
}

async function main() {
  const w = window();
  const prev = existsSync(SNAP) ? (JSON.parse(readFileSync(SNAP, 'utf-8')) as Snapshot) : undefined;
  const report: Report = { w, prev: prev && prev.week < w.start ? prev : undefined };
  try { report.site = site(w); } catch (e) { report.site = asError(e); }
  if (report.site && !(report.site instanceof Error)) report.titles = await pageTitles(report.site.cur.topPages.map(([p]) => p));
  try { report.tg = await telegram(w); } catch (e) { report.tg = asError(e); }
  try { report.li = linkedin(w); } catch (e) { report.li = asError(e); }
  const text = formatReport(report);
  process.stdout.write(`${text}\n`);
  if (DRY) return;
  await send(text);
  const snap: Snapshot = {
    week: w.start,
    ...(report.tg && !(report.tg instanceof Error) ? { subscribers: report.tg.subscribers } : { subscribers: prev?.subscribers }),
    ...(report.li && !(report.li instanceof Error) ? { followers: report.li.followers } : { followers: prev?.followers }),
  };
  mkdirSync(join(homedir(), '.eck'), { recursive: true });
  writeFileSync(SNAP, JSON.stringify(snap, null, 2));
  log(`DM 전송, 스냅샷 저장 (${w.start} ~ ${w.end})`);
}

main().catch((e) => {
  log(`실패: ${asError(e).message}`);
  process.exitCode = 1;
});
