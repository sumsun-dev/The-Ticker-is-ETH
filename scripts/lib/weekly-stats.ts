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

export interface SiteStats {
  visitors: number;
  /** 로그 보관 기간(14일) 안에서 이번 주에 처음 본 방문자 */
  newVisitors: number;
  pageLoads: number;
  /** 모바일 UA 방문자 비율(%) */
  mobilePct: number;
  daily: Array<[string, number]>;
  /** 첫 진입이 가장 많은 KST 시간대 */
  peakHour: number | null;
  sections: Array<[string, number]>;
  topPages: Array<[string, number]>;
  sources: Array<[string, number]>;
  refHosts: Array<[string, number]>;
  bots: { search: number; ai: Array<[string, number]> };
  notFound: Array<[string, number]>;
}

const MOBILE_UA = /Mobile|Android|iPhone|iPad/;
const SEARCH_BOTS = /Googlebot|bingbot|Yeti|DuckDuckBot|Applebot|Daum|YandexBot|Baiduspider/i;
const AI_BOTS: Array<[string, RegExp]> = [
  ['OpenAI', /GPTBot|OAI-SearchBot|ChatGPT-User/i],
  ['Anthropic', /ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai/i],
  ['Perplexity', /PerplexityBot|Perplexity-User/i],
  ['Google AI', /Google-Extended|GoogleOther|Google-CloudVertexBot/i],
  ['Meta', /meta-externalagent|FacebookBot/i],
  ['ByteDance', /Bytespider/i],
  ['Amazon', /Amazonbot/i],
  ['Common Crawl', /CCBot/i],
];
const SECTIONS: Record<string, string> = { '': '홈', news: '뉴스', contents: '콘텐츠', debates: '논쟁', events: '이벤트', team: '팀', contributors: '팀', ecosystem: '생태계', research: '리서치', calls: '코어 콜', about: '소개' };

const kstDate = (t: Date) => new Date(t.getTime() + KST).toISOString().slice(0, 10);
const count = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
const hostOf = (referer: string) => {
  try {
    return new URL(referer).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * SPA라 서버에는 첫 진입만 남는다(사이트 안 이동은 안 잡힌다). 앱 JS(/assets/*.js)를 받아 간 IP+UA만 사람 방문자로 센다 (HTML만 긁는 스크래퍼 제외).
 * lines는 보관된 로그 전체를 받는다. 구간 이전 기록으로 신규 방문자를 가린다.
 * ponytail: IP+UA 기준 추정치. 정확도가 필요하면 Umami 같은 분석 도구를 붙인다
 */
export function siteStats(lines: LogLine[], w: Window): SiteStats {
  const key = (l: LogLine) => `${l.ip}|${l.ua}`;
  const get = lines.filter((l) => l.method === 'GET');
  const inW = get.filter((l) => inWindowKst(l.time, w));
  const people = inW.filter((l) => !BOT_UA.test(l.ua));
  const ok = people.filter((l) => l.status < 400);
  const humans = new Set(ok.filter((l) => isAsset(l.path)).map(key));
  const seenBefore = new Set(get.filter((l) => kstDate(l.time) < w.start && isAsset(l.path) && l.status < 400).map(key));
  const pages = ok.filter((l) => humans.has(key(l)) && isPage(l.path));
  const firstSeen = new Map<string, string>();
  for (const l of ok) if (humans.has(key(l)) && isAsset(l.path) && !firstSeen.has(key(l))) firstSeen.set(key(l), kstDate(l.time));
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(w.start) + i * DAY).toISOString().slice(0, 10));
  const dailyCount = count([...firstSeen.values()]);
  const hours = count(pages.map((l) => String(new Date(l.time.getTime() + KST).getUTCHours())));
  const site = (h: string) => h === 'ethcollective.xyz';
  const external = pages.map((l) => hostOf(l.referer)).filter((h) => h && !site(h));
  return {
    visitors: humans.size,
    newVisitors: [...humans].filter((k) => !seenBefore.has(k)).length,
    pageLoads: pages.length,
    mobilePct: humans.size ? Math.round((100 * [...humans].filter((k) => MOBILE_UA.test(k)).length) / humans.size) : 0,
    daily: days.map((d) => [d, dailyCount.find(([x]) => x === d)?.[1] ?? 0]),
    peakHour: hours.length ? Number(hours[0][0]) : null,
    sections: count(pages.map((l) => SECTIONS[l.path.split('?')[0].split('/')[1] ?? ''] ?? '기타')),
    topPages: count(pages.map((l) => l.path.split('?')[0])).slice(0, 10),
    sources: count(pages.map((l) => refererSource(l.referer))),
    refHosts: count(external).slice(0, 5),
    bots: {
      search: inW.filter((l) => SEARCH_BOTS.test(l.ua)).length,
      ai: count(inW.flatMap((l) => AI_BOTS.filter(([, re]) => re.test(l.ua)).map(([name]) => name))),
    },
    // 취약점 스캐너(.env·.git 탐색)는 앱 JS를 받지 않으니, 실제 방문자가 겪은 깨진 링크만 남는다
    notFound: count(people.filter((l) => l.status === 404 && humans.has(key(l)) && isPage(l.path)).map((l) => l.path.split('?')[0])).slice(0, 3),
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

export interface LiStats { followers: number; newFollowers30: number; impressions30: number; reactions30: number }

export interface LiPost { title: string; urn: string; date: string; impressions: number; reactions: number; comments: number }

/**
 * 구간 안 게시물 합계와 노출 Top 3. 댓글은 자동 게시가 글마다 다는 첫 댓글(링크) 1개를 빼고 센다.
 * ponytail: 사람이 직접 올려 첫 댓글이 없는 글도 1을 뺀다. 그런 글이 늘면 게시물 화면에서 작성자로 거른다
 */
export function liWeek(posts: LiPost[], w: Window) {
  const seen = new Set<string>();
  const week = posts.filter((p) => p.date >= w.start && p.date <= w.end && !seen.has(p.urn) && seen.add(p.urn));
  const external = (p: LiPost) => Math.max(0, p.comments - 1);
  return {
    count: week.length,
    impressions: week.reduce((s, p) => s + p.impressions, 0),
    reactions: week.reduce((s, p) => s + p.reactions, 0),
    comments: week.reduce((s, p) => s + external(p), 0),
    top: [...week].sort((a, b) => b.impressions - a.impressions).slice(0, 3).map((p) => ({ ...p, comments: external(p) })),
  };
}

const num = (s: string | undefined) => (s ? Number(s.replace(/,/g, '')) : NaN);
const before = (text: string, label: string) => num(new RegExp(`([\\d,]+)\\s*\\n\\s*${label}`).exec(text)?.[1]);

export function parseLinkedIn(followersText: string, updatesText: string): LiStats {
  const s = {
    followers: before(followersText, '총 팔로워'),
    newFollowers30: before(followersText, '최근 30일의 새 팔로워'),
    impressions30: before(updatesText, '노출'),
    reactions30: before(updatesText, '반응'),
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
  li?: (LiStats & { posts: LiPost[] }) | Error;
  prev?: Snapshot;
  /** 많이 들어온 페이지의 제목 (path → title) */
  titles?: Record<string, string>;
}

export function formatReport(r: Report): string {
  const out = [`ECK 주간 성과 (${md(r.w.start)} ~ ${md(r.w.end)})`];
  const fail = (e: Error) => `수집 실패: ${e.message.split('\n')[0]}`;

  out.push('', '[홈페이지]');
  if (r.site instanceof Error) out.push(fail(r.site));
  else if (r.site) {
    const { cur, prev } = r.site;
    const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
    const dow = ['월', '화', '수', '목', '금', '토', '일'];
    out.push(`방문자 ${n(cur.visitors)}명${delta(cur.visitors, prev?.visitors)}, 첫 진입 ${n(cur.pageLoads)}회${delta(cur.pageLoads, prev?.pageLoads)}`);
    out.push(`신규 ${n(cur.newVisitors)}명 · 재방문 ${n(cur.visitors - cur.newVisitors)}명, 모바일 ${cur.mobilePct}%`);
    out.push(`요일별 방문자: ${cur.daily.map(([, c], i) => `${dow[i]} ${c}`).join(' · ')}`);
    if (cur.peakHour !== null) out.push(`가장 붐빈 시간: ${cur.peakHour}시대`);
    if (cur.sections.length) out.push(`분야별 첫 진입: ${cur.sections.map(([s, c]) => `${s} ${c}`).join(' · ')}`);
    if (cur.topPages.length) {
      out.push('많이 들어온 페이지:');
      out.push(...cur.topPages.map(([p, c], i) => `${i + 1}. ${r.titles?.[p] ? `${short(r.titles[p], 30)} (${p})` : p} ${c}회`));
    }
    if (cur.sources.length) out.push(`유입 경로: ${cur.sources.map(([s, c]) => `${s} ${c}(${pct(c, cur.pageLoads)}%)`).join(' · ')}`);
    if (cur.refHosts.length) out.push(`외부 유입 사이트: ${cur.refHosts.map(([h, c]) => `${h} ${c}`).join(' · ')}`);
    out.push(`크롤러 요청: 검색엔진 ${n(cur.bots.search)}회${cur.bots.ai.length ? `, AI ${cur.bots.ai.map(([b, c]) => `${b} ${n(c)}`).join(' · ')}` : ''}`);
    if (cur.notFound.length) out.push(`없는 페이지(404): ${cur.notFound.map(([p, c]) => `${p} ${c}`).join(', ')}`);
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
    const wk = liWeek(li.posts, r.w);
    out.push(`이번 주 글 ${wk.count}개, 노출 합계 ${n(wk.impressions)}, 글당 평균 ${wk.count ? n(Math.round(wk.impressions / wk.count)) : 0}, 반응 ${n(wk.reactions)}, 댓글 ${n(wk.comments)} (자체 링크 댓글 제외)`);
    if (wk.top.length) out.push('노출 많은 글:', ...wk.top.map((p) => `· ${n(p.impressions)}회 (반응 ${p.reactions}, 댓글 ${p.comments}) ${short(p.title)} linkedin.com/feed/update/${p.urn}`));
    out.push(`최근 30일: 노출 ${n(li.impressions30)}, 반응 ${n(li.reactions30)}, 새 팔로워 ${n(li.newFollowers30)}`);
  }
  return out.join('\n');
}
