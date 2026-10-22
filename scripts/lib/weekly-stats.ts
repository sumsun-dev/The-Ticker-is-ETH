/**
 * 오너 DM용 주간 성과 리포트의 순수 로직: nginx 로그 집계, 텔레그램 웹 뷰 조회수, LinkedIn 분석 화면 텍스트 파싱, 메시지 포맷.
 * 수집(ssh·fetch·브라우저)과 송출은 scripts/local/weekly-stats.ts가 맡는다.
 */

const DAY = 24 * 60 * 60 * 1000;
const KST = 9 * 60 * 60 * 1000;

export interface Window { start: string; end: string }

/** now(KST) 기준 직전 월~일 구간. 'YYYY-MM-DD' (KST 날짜) */
export function lastWeek(now: Date): Window {
  const kst = new Date(now.getTime() + KST);
  const dow = (kst.getUTCDay() + 6) % 7; // 월=0
  const thisMon = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - dow * DAY;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  return { start: iso(thisMon - 7 * DAY), end: iso(thisMon - DAY) };
}

export const prevWeek = (w: Window): Window => {
  const shift = (d: string) => new Date(Date.parse(d) - 7 * DAY).toISOString().slice(0, 10);
  return { start: shift(w.start), end: shift(w.end) };
};

/** UTC 시각의 KST 날짜가 구간 안인지 */
export const inWindowKst = (t: Date, w: Window): boolean => {
  const d = new Date(t.getTime() + KST).toISOString().slice(0, 10);
  return d >= w.start && d <= w.end;
};

/* ── 홈페이지 (nginx vhost 로그) ─────────────────────────────────── */

export interface LogLine { ip: string; time: Date; method: string; path: string; status: number; referer: string; ua: string }

const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const LINE = /^(\S+) \S+ \S+ \[(\d{2})\/(\w{3})\/(\d{4}):(\d{2}:\d{2}:\d{2}) ([+-]\d{4})\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ "([^"]*)" "([^"]*)"/;

export function parseLogLine(line: string): LogLine | null {
  const m = LINE.exec(line);
  if (!m) return null;
  const [, ip, dd, mon, yyyy, hms, tz, method, path, status, referer, ua] = m;
  const time = new Date(`${yyyy}-${MONTHS[mon]}-${dd}T${hms}${tz.slice(0, 3)}:${tz.slice(3)}`);
  return { ip, time, method, path, status: Number(status), referer, ua };
}

const BOT_UA = /bot|crawl|spider|slurp|preview|fetch|curl|wget|python|go-http|java\/|headless|lighthouse|monitor/i;
const isAsset = (p: string) => /^\/assets\/.+\.js(\?|$)/.test(p);
const isPage = (p: string) => !/\.[a-z0-9]{2,5}(\?|$)/i.test(p.split('?')[0]) || /\.html(\?|$)/.test(p);

export function refererSource(referer: string, site = 'ethcollective.xyz'): string {
  if (!referer || referer === '-') return '직접';
  const host = (() => {
    try {
      return new URL(referer).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  if (!host || host === site) return '직접';
  if (/(^|\.)t\.me$|telegram/.test(host)) return '텔레그램';
  if (/(^|\.)(x\.com|t\.co|twitter\.com)$/.test(host)) return 'X';
  if (/linkedin\.com$|lnkd\.in$/.test(host)) return '링크드인';
  if (/google\.|naver\.com$|daum\.net$|bing\.com$|duckduckgo\.com$|yahoo\./.test(host)) return '검색';
  return '기타';
}

export interface SiteStats { visitors: number; pageLoads: number; topPages: Array<[string, number]>; sources: Array<[string, number]> }

/**
 * SPA라 서버에는 첫 진입만 남는다. 앱 JS(/assets/*.js)를 받아 간 IP+UA만 사람 방문자로 센다 (HTML만 긁는 스크래퍼 제외).
 * ponytail: IP+UA 기준 추정치. 정확도가 필요하면 Umami 같은 분석 도구를 붙인다
 */
export function siteStats(lines: LogLine[], w: Window): SiteStats {
  const inW = lines.filter((l) => l.method === 'GET' && l.status < 400 && !BOT_UA.test(l.ua) && inWindowKst(l.time, w));
  const key = (l: LogLine) => `${l.ip}|${l.ua}`;
  const humans = new Set(inW.filter((l) => isAsset(l.path)).map(key));
  const pages = inW.filter((l) => humans.has(key(l)) && isPage(l.path));
  const count = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  return {
    visitors: humans.size,
    pageLoads: pages.length,
    topPages: count(pages.map((l) => l.path.split('?')[0])).slice(0, 5),
    sources: count(pages.map((l) => refererSource(l.referer))),
  };
}

/* ── 텔레그램 채널 웹 뷰 (t.me/s/<channel>) ────────────────────────── */

export interface TgPost { id: number; date: string; views: number; text: string }

/** "1.2K" → 1200 */
export const parseCount = (s: string): number => {
  const m = /^([\d.]+)\s*([KM]?)$/i.exec(s.trim().replace(/,/g, ''));
  if (!m) return 0;
  return Math.round(Number(m[1]) * (m[2].toUpperCase() === 'K' ? 1e3 : m[2].toUpperCase() === 'M' ? 1e6 : 1));
};

export function parseTgPosts(html: string, channel: string): TgPost[] {
  const starts = [...html.matchAll(new RegExp(`data-post="${channel}/(\\d+)"`, 'g'))].map((m) => ({ id: Number(m[1]), at: m.index ?? 0 }));
  return starts.map((s, i) => {
    const block = html.slice(s.at, starts[i + 1]?.at ?? html.length);
    const text = (/js-message_text[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1] ?? '')
      .replace(/<br\s*\/?>/g, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    return {
      id: s.id,
      date: /<time[^>]*datetime="([^"]+)"/.exec(block)?.[1] ?? '',
      views: parseCount(/tgme_widget_message_views">([^<]*)</.exec(block)?.[1] ?? '0'),
      text,
    };
  });
}

/* ── LinkedIn 페이지 분석 화면 텍스트 ──────────────────────────────── */

export interface LiStats { followers: number; newFollowers30: number; impressions30: number; reactions30: number; comments30: number }

const num = (s: string | undefined) => (s ? Number(s.replace(/,/g, '')) : NaN);
const before = (text: string, label: string) => num(new RegExp(`([\\d,]+)\\s*\\n\\s*${label}`).exec(text)?.[1]);

export function parseLinkedIn(followersText: string, updatesText: string): LiStats {
  const s = {
    followers: before(followersText, '총 팔로워'),
    newFollowers30: before(followersText, '최근 30일의 새 팔로워'),
    impressions30: before(updatesText, '노출'),
    reactions30: before(updatesText, '반응'),
    comments30: before(updatesText, '댓글'),
  };
  if (Number.isNaN(s.followers)) throw new Error('LinkedIn 분석 화면에서 팔로워 수를 찾지 못했습니다 (로그인 또는 화면 구조 확인)');
  return s;
}

/* ── 메시지 ─────────────────────────────────────────────────────── */

export interface Snapshot { week: string; subscribers?: number; followers?: number }

const n = (x: number) => x.toLocaleString('en-US');
const delta = (cur: number, prev: number | undefined) => (prev === undefined ? '' : ` (전주 대비 ${cur - prev >= 0 ? '+' : ''}${n(cur - prev)})`);
const short = (s: string, len = 40) => (s.length > len ? `${s.slice(0, len)}…` : s);
const md = (d: string) => d.slice(5).replace('-', '.');

export interface Report {
  w: Window;
  /** prev는 로그 보관 기간(14일)이 전주를 다 덮을 때만 */
  site?: { cur: SiteStats; prev?: SiteStats } | Error;
  tg?: { channel: string; subscribers: number; posts: TgPost[] } | Error;
  li?: LiStats | Error;
  prev?: Snapshot;
}

export function formatReport(r: Report): string {
  const out = [`ECK 주간 성과 (${md(r.w.start)} ~ ${md(r.w.end)})`];
  const fail = (e: Error) => `수집 실패: ${e.message.split('\n')[0]}`;

  out.push('', '[홈페이지]');
  if (r.site instanceof Error) out.push(fail(r.site));
  else if (r.site) {
    const { cur, prev } = r.site;
    out.push(`방문자 ${n(cur.visitors)}명${delta(cur.visitors, prev?.visitors)}, 첫 진입 ${n(cur.pageLoads)}회`);
    if (cur.topPages.length) out.push(`많이 들어온 페이지: ${cur.topPages.map(([p, c]) => `${p} ${c}`).join(', ')}`);
    if (cur.sources.length) out.push(`유입: ${cur.sources.map(([s, c]) => `${s} ${c}`).join(' · ')}`);
  }

  out.push('', `[텔레그램${r.tg && !(r.tg instanceof Error) ? ` @${r.tg.channel}` : ''}]`);
  if (r.tg instanceof Error) out.push(fail(r.tg));
  else if (r.tg) {
    const { subscribers, posts, channel } = r.tg;
    const total = posts.reduce((s, p) => s + p.views, 0);
    out.push(`구독자 ${n(subscribers)}명${delta(subscribers, r.prev?.subscribers)}`);
    out.push(`이번 주 글 ${posts.length}개, 조회 합계 ${n(total)}, 글당 평균 ${posts.length ? n(Math.round(total / posts.length)) : 0}`);
    const top = [...posts].sort((a, b) => b.views - a.views).slice(0, 3);
    if (top.length) out.push('많이 본 글:', ...top.map((p) => `· ${n(p.views)}회 ${short(p.text) || '(미디어)'} t.me/${channel}/${p.id}`));
  }

  out.push('', '[링크드인 ECK 페이지]');
  if (r.li instanceof Error) out.push(fail(r.li));
  else if (r.li) {
    const li = r.li;
    out.push(`팔로워 ${n(li.followers)}명${delta(li.followers, r.prev?.followers)}`);
    out.push(`최근 30일: 노출 ${n(li.impressions30)}, 반응 ${n(li.reactions30)}, 댓글 ${n(li.comments30)}, 새 팔로워 ${n(li.newFollowers30)}`);
  }
  return out.join('\n');
}
