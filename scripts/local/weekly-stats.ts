/**
 * 홈페이지·텔레그램·LinkedIn 주간 성과를 오너 텔레그램 DM으로 보낸다 (맥 전용, launchd 월요일 09:00).
 * 홈페이지는 wp-vps nginx 로그를 ssh로 읽고, 텔레그램은 봇 API(구독자)와 공개 웹 뷰(조회수), LinkedIn은 linkedin-channel-post.ts --analytics(로그인된 전용 크롬 프로필)로 읽는다.
 * 구독자·팔로워 전주 대비는 ~/.eck/weekly-stats.json 스냅샷과 비교한다. 한 채널이 실패해도 나머지는 보낸다.
 *
 * 수집한 값은 관리자 대시보드(/admin/stats)용 누적 기록에 합쳐 wp-vps /var/lib/ethcollective/stats-history.json에 올린다 (로컬 사본 ~/.eck/stats-history.json).
 *
 * Usage:
 *   npx tsx scripts/local/weekly-stats.ts             # 집계 후 DM, 대시보드 기록 갱신
 *   npx tsx scripts/local/weekly-stats.ts --dry       # 출력만 (DM·스냅샷·기록 저장 안 함)
 *   npx tsx scripts/local/weekly-stats.ts --backfill  # DM 없이 남아 있는 과거 데이터(채널 글 전체, 링크드인 표, 로그 14일)로 기록만 채움
 * Env: TELEGRAM_BOT_TOKEN, LINKEDIN_ALERT_CHAT|VITALIK_ALERT_CHAT, WP_HOST (기본 wp-vps), TG_CHANNEL (기본 thetickeriseth), WEEK_END (YYYY-MM-DD, 수동 구간)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as dotenv from 'dotenv';
import { emptyHistory, formatReport, lastWeek, mergeHistory, parseLinkedIn, parseLogLine, parseTgPosts, prevWeek, siteStats, inWindowKst, type HistoryUpdate, type LiPost, type LiStats, type SiteStats, type LogLine, type Report, type Snapshot, type TgPost, type Window } from '../lib/weekly-stats';
import type { StatsHistory, WeekRecord } from '../../src/types/adminStats';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

const DRY = process.argv.includes('--dry');
const BACKFILL = process.argv.includes('--backfill');
const CHANNEL = process.env.TG_CHANNEL ?? 'thetickeriseth';
const WP_HOST = process.env.WP_HOST ?? 'wp-vps';
const SNAP = join(homedir(), '.eck', 'weekly-stats.json');
const LOCAL_HISTORY = join(homedir(), '.eck', 'stats-history.json');
const REMOTE_HISTORY = '/var/lib/ethcollective/stats-history.json';
const DAY = 864e5;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const log = (m: string) => process.stderr.write(`[weekly-stats] ${m}\n`);
const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

function window(): Window {
  if (!process.env.WEEK_END) return lastWeek(new Date());
  const end = process.env.WEEK_END;
  return { start: new Date(Date.parse(end) - 6 * 864e5).toISOString().slice(0, 10), end };
}

function siteLogs(): LogLine[] {
  // 로그는 여러 vhost가 섞여 있어 서버에서 ethcollective.xyz만 걸러 받는다 (보관 14일)
  const raw = execFileSync('ssh', [WP_HOST, `zcat -f /var/log/nginx/access.log* | awk '$NF=="ethcollective.xyz"'`], { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024, timeout: 120_000 });
  return raw.split('\n').map(parseLogLine).filter((l): l is LogLine => l !== null);
}

/** 로그가 하루를 온전히 덮는 KST 날짜들 (첫날은 중간부터라 뺀다, 오늘은 진행 중이라 뺀다) */
function fullDays(lines: LogLine[], now: Date): string[] {
  const oldest = Math.min(...lines.map((l) => l.time.getTime()));
  const first = iso(oldest + 9 * 3600e3 + DAY);
  const today = iso(now.getTime() + 9 * 3600e3);
  const days: string[] = [];
  for (let t = Date.parse(first); iso(t) < today; t += DAY) days.push(iso(t));
  return days;
}

function site(lines: LogLine[], w: Window): { cur: SiteStats; prev?: SiteStats } {
  const pw = prevWeek(w);
  const oldest = Math.min(...lines.map((l) => l.time.getTime()));
  // 전주 첫날(KST 0시)보다 오래된 로그가 있어야 전주 비교가 의미 있다
  const covered = oldest <= Date.parse(`${pw.start}T00:00:00+09:00`);
  return { cur: siteStats(lines, w), ...(covered ? { prev: siteStats(lines, pw) } : {}) };
}

async function telegram(w: Window, since: string): Promise<{ report: Report['tg']; all: TgPost[] }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN 없음');
  const res = (await (await fetch(`https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=@${CHANNEL}`)).json()) as { ok: boolean; result?: number; description?: string };
  if (!res.ok || res.result === undefined) throw new Error(`getChatMemberCount: ${res.description}`);
  // 웹 뷰는 한 번에 20개 안팎. 구간 시작보다 오래된 글이 나올 때까지 앞으로 넘긴다
  const posts: TgPost[] = [];
  let before = '';
  for (let i = 0; i < 300; i++) {
    const html = await (await fetch(`https://t.me/s/${CHANNEL}${before}`)).text();
    const page = parseTgPosts(html, CHANNEL);
    if (!page.length) break;
    posts.push(...page);
    if (page.some((p) => p.date && p.date.slice(0, 10) < since)) break;
    before = `?before=${Math.min(...page.map((p) => p.id))}`;
  }
  const seen = new Set<number>();
  const all = posts.filter((p) => p.date && !seen.has(p.id) && seen.add(p.id));
  return { report: { channel: CHANNEL, subscribers: res.result, posts: all.filter((p) => inWindowKst(new Date(p.date), w)) }, all };
}

function linkedin(since: string): LiStats & { posts: LiPost[] } {
  // ponytail: 게시 작업(10:30·18:30)과 시간을 나눠 잠금 없이 돈다. 겹치게 옮기면 잠금을 공유해야 한다
  const out = execFileSync('npx', ['tsx', 'scripts/local/linkedin-channel-post.ts', '--analytics', `--since=${since}`], { encoding: 'utf-8', timeout: 600_000, maxBuffer: 32 * 1024 * 1024 });
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

function loadHistory(): StatsHistory {
  // 서버 사본이 기준이다. 못 읽으면 로컬 사본, 그것도 없으면 새로 시작
  try {
    const raw = execFileSync('ssh', [WP_HOST, `cat ${REMOTE_HISTORY} 2>/dev/null || true`], { encoding: 'utf-8', timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
    if (raw.trim()) return JSON.parse(raw) as StatsHistory;
  } catch (e) {
    log(`서버 기록 읽기 실패, 로컬 사본 사용: ${asError(e).message.split('\n')[0]}`);
  }
  return existsSync(LOCAL_HISTORY) ? (JSON.parse(readFileSync(LOCAL_HISTORY, 'utf-8')) as StatsHistory) : emptyHistory(CHANNEL);
}

function saveHistory(h: StatsHistory) {
  const json = JSON.stringify(h);
  mkdirSync(join(homedir(), '.eck'), { recursive: true });
  writeFileSync(LOCAL_HISTORY, json);
  // 웹 루트 밖에 두고 API(www-data)가 읽는다. 임시 파일에 쓰고 옮겨 반쯤 쓴 파일을 읽지 않게
  execFileSync('ssh', [WP_HOST, `mkdir -p /var/lib/ethcollective && cat > ${REMOTE_HISTORY}.tmp && chmod 644 ${REMOTE_HISTORY}.tmp && mv ${REMOTE_HISTORY}.tmp ${REMOTE_HISTORY}`], { input: json, timeout: 60_000 });
}

async function send(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.LINKEDIN_ALERT_CHAT ?? process.env.VITALIK_ALERT_CHAT;
  if (!token || !chat) throw new Error('TELEGRAM_BOT_TOKEN 또는 알림 DM chat id 없음');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`sendMessage ${res.status}: ${await res.text()}`);
}

async function main() {
  const now = new Date();
  const w = window();
  const prev = existsSync(SNAP) ? (JSON.parse(readFileSync(SNAP, 'utf-8')) as Snapshot) : undefined;
  const report: Report = { w, prev: prev && prev.week < w.start ? prev : undefined };
  const update: HistoryUpdate = {};

  try {
    const lines = siteLogs();
    const siteNow = site(lines, w);
    report.site = siteNow;
    report.titles = await pageTitles(siteNow.cur.topPages.map(([p]) => p));
    const days = fullDays(lines, now);
    update.siteDaily = days.map((d) => {
      const s = siteStats(lines, { start: d, end: d });
      return { date: d, visitors: s.visitors, pageLoads: s.pageLoads };
    });
    // 백필이면 로그가 온전히 덮는 지난 주들도 주 기록으로 남긴다
    const mondays = BACKFILL ? days.filter((d) => new Date(d).getUTCDay() === 1 && days.includes(iso(Date.parse(d) + 6 * DAY))) : [w.start];
    update.weeks = mondays.map((m): WeekRecord => {
      if (m === w.start) return { week: m, site: { ...siteNow.cur, titles: report.titles } };
      return { week: m, site: siteStats(lines, { start: m, end: iso(Date.parse(m) + 6 * DAY) }) };
    });
  } catch (e) {
    report.site = asError(e);
  }
  try {
    const { report: tg, all } = await telegram(w, BACKFILL ? '0000-00-00' : w.start);
    report.tg = tg;
    update.tgPosts = all;
  } catch (e) {
    report.tg = asError(e);
  }
  try {
    const li = linkedin(BACKFILL ? '0000-00-00' : w.start);
    report.li = li;
    update.liPosts = li.posts;
  } catch (e) {
    report.li = asError(e);
  }

  const ok = <T,>(x: T | Error | undefined): x is T => x !== undefined && !(x instanceof Error);
  const thisWeek: WeekRecord = {
    week: w.start,
    ...(ok(report.tg) ? { tg: { subscribers: report.tg.subscribers } } : {}),
    ...(ok(report.li) ? { li: { followers: report.li.followers, impressions30: report.li.impressions30, reactions30: report.li.reactions30, newFollowers30: report.li.newFollowers30 } } : {}),
  };
  update.weeks = [...(update.weeks ?? []).filter((x) => x.week !== w.start), { ...update.weeks?.find((x) => x.week === w.start), ...thisWeek }];

  const text = formatReport(report);
  process.stdout.write(`${text}\n`);
  if (DRY) return;

  const history = mergeHistory(loadHistory(), update, now);
  saveHistory(history);
  log(`대시보드 기록 갱신: 주 ${history.weeks.length}개, 일 ${history.siteDaily.length}일, 텔레그램 글 ${history.tgPosts.length}개, 링크드인 글 ${history.liPosts.length}개`);
  if (BACKFILL) return;

  await send(text);
  const snap: Snapshot = {
    week: w.start,
    ...(ok(report.tg) ? { subscribers: report.tg.subscribers } : { subscribers: prev?.subscribers }),
    ...(ok(report.li) ? { followers: report.li.followers } : { followers: prev?.followers }),
  };
  writeFileSync(SNAP, JSON.stringify(snap, null, 2));
  log(`DM 전송, 스냅샷 저장 (${w.start} ~ ${w.end})`);
}

main().catch((e) => {
  log(`실패: ${asError(e).message}`);
  process.exitCode = 1;
});
