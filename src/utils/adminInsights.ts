/**
 * 성과 대시보드 인사이트: 텔레그램 콘텐츠 유형·시간대 분석과, 기간 요약을 읽어 문장으로 짚는 규칙.
 * AI 분석(aiInsights)이 없을 때도 이것만으로 "그래서 뭐가 달라졌나"를 보여 준다.
 */
import type { AiInsight, StatsHistory, TgPostRecord } from '../types/adminStats';
import { isMature, kstDate, MATURE_DAYS, type Summary } from './adminStats';

export { isMature };

export const TG_TYPES = ['코어 콜', '다이제스트', 'ETH레터', '논쟁', '리서치 공유', '행사·공지', '뉴스·코멘트'] as const;
export type TgType = (typeof TG_TYPES)[number];

/** 채널 글머리 규칙. 앞에서부터 처음 맞는 유형 */
const TYPE_RULES: Array<[TgType, RegExp]> = [
  ['코어 콜', /^ACD[A-Z]{0,2}\s*#/],
  ['다이제스트', /이번 호 인사이트/],
  ['ETH레터', /^\[ETH레터\]/],
  ['논쟁', /논쟁 트래킹/],
  ['리서치 공유', /^:\s*:\s*\[/],
  ['행사·공지', /^\[(?:공지|안내|채용)\]|이더리움 코리아|컨퍼런스|밋업|meetup/i],
];

export const tgType = (text: string): TgType => TYPE_RULES.find(([, re]) => re.test(text.trim()))?.[0] ?? '뉴스·코멘트';

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const DAY_MS = 864e5;

export interface TypeRow { type: TgType; posts: number; avgViews: number }

/**
 * 최근 days일 유형별 글당 평균 조회 (조회가 다 쌓인 글만), 높은 순.
 * 채널 전체 조회 수준이 해마다 달라 전 기간으로 비교하면 최근에 생긴 형식이 불리해진다
 */
export function typeBreakdown(posts: TgPostRecord[], now: string, days = 90): TypeRow[] {
  const groups = new Map<TgType, number[]>();
  const since = Date.parse(now) - days * DAY_MS;
  for (const p of posts) {
    if (Date.parse(p.date) < since || !isMature(p.date, now)) continue;
    const t = tgType(p.text);
    groups.set(t, [...(groups.get(t) ?? []), p.views]);
  }
  return [...groups].map(([type, vs]) => ({ type, posts: vs.length, avgViews: avg(vs) })).sort((a, b) => b.avgViews - a.avgViews);
}

export interface MonthRow { month: string; posts: number; views: number; avgViews: number; partial: boolean }

/** KST 월별 글 수·누적 조회·글당 평균. 조회가 아직 쌓이는 글이 있는 달은 partial */
export function monthlyTg(posts: TgPostRecord[], now: string, limit = 24): MonthRow[] {
  const m = new Map<string, { views: number[]; partial: boolean }>();
  for (const p of posts) {
    const k = kstDate(p.date).slice(0, 7);
    const cur = m.get(k) ?? { views: [], partial: false };
    m.set(k, { views: [...cur.views, p.views], partial: cur.partial || !isMature(p.date, now) });
  }
  return [...m]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-limit)
    .map(([month, { views, partial }]) => ({ month, posts: views.length, views: views.reduce((a, b) => a + b, 0), avgViews: avg(views), partial }));
}

/** 하루를 4시간씩 6칸으로 (0: 0~4시 … 5: 20~24시, KST) */
export const HOUR_BLOCKS = 6;
export interface HeatCell { posts: number; medianViews: number | null }
/** [요일: 월=0 … 일=6][시간 칸] */
export type Heat = HeatCell[][];

/** 최근 days일 동안 조회가 다 쌓인 글의 요일·시간대별 조회 중앙값 (튀는 글 하나에 흔들리지 않게) */
export function timeHeat(posts: TgPostRecord[], now: string, days = 180): Heat {
  const cells = Array.from({ length: 7 }, () => Array.from({ length: HOUR_BLOCKS }, () => [] as number[]));
  const since = Date.parse(now) - days * DAY_MS;
  for (const p of posts) {
    const t = Date.parse(p.date);
    if (t < since || !isMature(p.date, now)) continue;
    const kst = new Date(t + 9 * 3600e3);
    cells[(kst.getUTCDay() + 6) % 7][Math.floor(kst.getUTCHours() / (24 / HOUR_BLOCKS))].push(p.views);
  }
  return cells.map((row) => row.map((vs) => ({ posts: vs.length, medianViews: vs.length ? median(vs) : null })));
}

export interface Slot { day: number; block: number; posts: number; medianViews: number }

/** 글이 minPosts개 이상인 칸 중 조회 중앙값이 가장 높은 칸 */
export function bestSlot(heat: Heat, minPosts = 8): Slot | null {
  let best: Slot | null = null;
  heat.forEach((row, day) =>
    row.forEach((c, block) => {
      if (c.posts >= minPosts && c.medianViews !== null && (!best || c.medianViews > best.medianViews)) best = { day, block, posts: c.posts, medianViews: c.medianViews };
    }),
  );
  return best;
}

export const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
export const blockLabel = (block: number) => `${block * (24 / HOUR_BLOCKS)}~${(block + 1) * (24 / HOUR_BLOCKS)}시`;

/* ── 규칙 기반 인사이트 ─────────────────────────────────────────── */

export type InsightTone = 'up' | 'down' | 'neutral' | 'caveat';
export interface Insight { channel: 'site' | 'telegram' | 'linkedin' | 'overall'; tone: InsightTone; text: string }

const fmt = (x: number) => x.toLocaleString('en-US');
const pct = (cur: number, prev: number) => Math.round(((cur - prev) / prev) * 100);
const signed = (p: number) => `${p > 0 ? '+' : ''}${p}%`;
/** ±5% 안은 변화 없음으로 본다 */
const toneOf = (p: number): InsightTone => (p >= 5 ? 'up' : p <= -5 ? 'down' : 'neutral');
const clip = (s: string, n = 28) => (Array.from(s).length > n ? `${Array.from(s).slice(0, n).join('')}…` : s);

function compare(channel: Insight['channel'], label: string, unit: string, cur: number | null, prev: number | null | undefined): Insight | null {
  if (cur === null) return null;
  if (prev === null || prev === undefined || prev === 0) return { channel, tone: 'neutral', text: `${label} ${fmt(cur)}${unit}` };
  const p = pct(cur, prev);
  return { channel, tone: toneOf(p), text: `${label} ${fmt(cur)}${unit}, 이전 기간보다 ${signed(p)}` };
}

export const MIN_TYPE_POSTS = 3;

export interface RuleInput {
  cur: Summary;
  prev: Summary | null;
  /** 최근 유형별 성과 (typeBreakdown) */
  types: TypeRow[];
  /** 최근 최적 시간대 (bestSlot) */
  slot: Slot | null;
}

/** 기간 요약을 읽어 짚을 만한 점을 문장으로. 중요한 것부터 */
export function ruleInsights({ cur, prev, types, slot }: RuleInput): Insight[] {
  const out: Array<Insight | null> = [];
  out.push(compare('telegram', '텔레그램 글당 평균 조회', '회', cur.tgAvgViews, prev?.tgAvgViews));

  const top = cur.topTg[0];
  if (top && cur.tgAvgViews && top.views >= cur.tgAvgViews * 1.5) {
    out.push({ channel: 'telegram', tone: 'up', text: `가장 많이 본 글은 「${clip(top.text || '미디어 글')}」 ${fmt(top.views)}회로 평균의 ${(top.views / cur.tgAvgViews).toFixed(1)}배` });
  }

  out.push(compare('site', '홈페이지 방문자', '명', cur.visitors, prev?.visitors));
  const sources = cur.site?.sources ?? [];
  const total = sources.reduce((a, [, v]) => a + v, 0);
  const search = sources.find(([k]) => k === '검색')?.[1] ?? 0;
  if (total >= 20) out.push({ channel: 'site', tone: search / total < 0.15 ? 'down' : 'neutral', text: `첫 진입 중 검색 유입은 ${Math.round((search / total) * 100)}%, 직접 유입이 ${Math.round(((sources.find(([k]) => k === '직접')?.[1] ?? 0) / total) * 100)}%` });
  const ai = cur.site?.bots.ai ?? [];
  const aiTotal = ai.reduce((a, [, v]) => a + v, 0);
  if (aiTotal) out.push({ channel: 'site', tone: 'neutral', text: `AI 크롤러가 ${fmt(aiTotal)}회 읽어 갔다. 가장 많이 온 곳은 ${ai[0][0]} (${fmt(ai[0][1])}회)` });

  if (cur.liEngagement !== null) out.push({ channel: 'linkedin', tone: cur.liEngagement >= 2 ? 'up' : 'neutral', text: `링크드인 참여율 ${cur.liEngagement}% (노출 ${fmt(cur.liImpressions as number)}, 반응 ${fmt(cur.liReactions)}, 댓글 ${fmt(cur.liComments)})` });
  const li = cur.topLi[0];
  if (li && cur.liPosts > 1) out.push({ channel: 'linkedin', tone: 'neutral', text: `링크드인에서 노출이 가장 많은 글은 「${clip(li.title)}」 ${fmt(li.impressions)}회` });

  // 글이 몇 개 안 되는 유형은 우연에 좌우되니 비교에서 뺀다
  const comparable = types.filter((t) => t.posts >= MIN_TYPE_POSTS);
  if (comparable.length >= 2) {
    const [best, worst] = [comparable[0], comparable.at(-1)!];
    out.push({ channel: 'telegram', tone: 'neutral', text: `최근 90일 반응이 가장 좋은 유형은 ${best.type}(글당 ${fmt(best.avgViews)}회), 가장 낮은 유형은 ${worst.type}(${fmt(worst.avgViews)}회)` });
  }
  if (slot) out.push({ channel: 'telegram', tone: 'neutral', text: `최근 6개월 ${DAY_LABELS[slot.day]}요일 ${blockLabel(slot.block)}에 올린 글이 보통 ${fmt(slot.medianViews)}회로 가장 잘 읽혔다 (글 ${slot.posts}개, 중앙값)` });

  if (cur.tgFresh) out.push({ channel: 'telegram', tone: 'caveat', text: `최근 ${MATURE_DAYS}일 안에 올린 글 ${cur.tgFresh}개는 조회가 아직 쌓이는 중이라 평균에서 뺐다` });
  return out.filter((x): x is Insight => x !== null);
}

export const findAiInsight = (h: StatsHistory, key: string): AiInsight | null => h.aiInsights?.find((x) => x.key === key) ?? null;

export interface Author { name: string; avatar: string }
export interface MemberRow extends Author {
  posts: number;
  views: number;
  /** 조회가 다 쌓인 글만의 글당 평균. 그런 글이 없으면 null */
  avgViews: number | null;
  top: TgPostRecord;
}

/** 기간 안 텔레그램 글을 작성자별로 묶는다. 작성자를 모르는 글(사이트 인덱스에 아직 없는 글)은 빠진다. 조회 합 높은 순 */
export function memberBreakdown(posts: TgPostRecord[], authorOf: (id: number) => Author | undefined, now: string): MemberRow[] {
  const groups = new Map<string, { author: Author; posts: TgPostRecord[] }>();
  for (const p of posts) {
    const a = authorOf(p.id);
    if (!a) continue;
    const g = groups.get(a.name) ?? { author: a, posts: [] };
    g.posts.push(p);
    groups.set(a.name, g);
  }
  return [...groups.values()]
    .map(({ author, posts: ps }) => {
      const mature = ps.filter((p) => isMature(p.date, now)).map((p) => p.views);
      return {
        ...author,
        posts: ps.length,
        views: ps.reduce((a, p) => a + p.views, 0),
        avgViews: mature.length ? avg(mature) : null,
        top: ps.reduce((a, b) => (b.views > a.views ? b : a)),
      };
    })
    .sort((a, b) => b.views - a.views);
}

/* ── 채널별 수치 인사이트 (탭 맨 위 숫자 칸) ─────────────────────── */

export interface Fact {
  label: string;
  value: string;
  detail: string;
  tone?: 'up' | 'down';
}

const share = (part: number, whole: number) => Math.round((part / whole) * 100);
const times = (a: number, b: number) => (a / b).toFixed(1);
const vsPrev = (cur: number | null, prev: number | null | undefined, suffix = '%'): { text: string; tone?: Fact['tone'] } => {
  if (cur === null || prev === null || prev === undefined || prev === 0) return { text: '지난 기간 비교 없음' };
  const p = suffix === '%p' ? Math.round((cur - prev) * 10) / 10 : pct(cur, prev);
  const t = toneOf(suffix === '%p' ? p * 10 : p);
  return { text: `지난 기간 ${p > 0 ? '+' : ''}${p}${suffix}`, tone: t === 'up' || t === 'down' ? t : undefined };
};

export function telegramFacts(cur: Summary, prev: Summary | null, types: TypeRow[], slot: Slot | null): Fact[] {
  const out: Fact[] = [];
  if (cur.tgAvgViews !== null) {
    const d = vsPrev(cur.tgAvgViews, prev?.tgAvgViews);
    out.push({ label: '글당 평균 조회', value: `${fmt(cur.tgAvgViews)}회`, detail: d.text, tone: d.tone });
    if (cur.subscribers) out.push({ label: '구독자 도달률', value: `${share(cur.tgAvgViews, cur.subscribers)}%`, detail: `글 하나를 구독자 ${fmt(cur.subscribers)}명 중 몇 %가 보는지` });
  }
  const top = cur.topTg[0];
  if (top && cur.tgViews) out.push({ label: '최고 조회 글', value: `${fmt(top.views)}회`, detail: `이 기간 조회의 ${share(top.views, cur.tgViews)}%${cur.tgAvgViews ? ` · 평균의 ${times(top.views, cur.tgAvgViews)}배` : ''}` });
  const comparable = types.filter((t) => t.posts >= MIN_TYPE_POSTS);
  if (comparable.length >= 2) {
    const [best, worst] = [comparable[0], comparable.at(-1)!];
    out.push({ label: '잘 읽히는 유형', value: best.type, detail: `글당 ${fmt(best.avgViews)}회, ${worst.type}의 ${times(best.avgViews, worst.avgViews)}배 (최근 90일)` });
  }
  if (slot) out.push({ label: '올리기 좋은 시간', value: `${DAY_LABELS[slot.day]} ${blockLabel(slot.block)}`, detail: `조회 중앙값 ${fmt(slot.medianViews)}회 (최근 6개월, 글 ${slot.posts}개)` });
  return out;
}

export function siteFacts(cur: Summary, prev: Summary | null, days: Array<{ date: string; visitors: number }>): Fact[] {
  const out: Fact[] = [];
  if (days.length) {
    const avgDay = Math.round(days.reduce((a, d) => a + d.visitors, 0) / days.length);
    const peak = days.reduce((a, b) => (b.visitors > a.visitors ? b : a));
    out.push({ label: '하루 평균 방문자', value: `${fmt(avgDay)}명`, detail: `가장 많은 날 ${peak.date.slice(5).replace('-', '.')} ${fmt(peak.visitors)}명` });
  }
  const s = cur.site;
  if (s?.newVisitors !== undefined && cur.visitors) out.push({ label: '신규 방문자 비중', value: `${share(s.newVisitors, cur.visitors)}%`, detail: `재방문 ${fmt(cur.visitors - s.newVisitors)}명` });
  if (cur.visitors !== null && cur.pageLoads !== null && cur.visitors) out.push({ label: '방문자당 첫 진입', value: `${(cur.pageLoads / cur.visitors).toFixed(2)}회`, detail: vsPrev(cur.pageLoads, prev?.pageLoads).text.replace('지난 기간', '첫 진입 지난 기간') });
  const total = s ? s.sources.reduce((a, [, v]) => a + v, 0) : 0;
  if (s && total) {
    const search = s.sources.find(([k]) => k === '검색')?.[1] ?? 0;
    const ext = s.refHosts[0];
    out.push({ label: '검색 유입', value: `${share(search, total)}%`, detail: `직접 ${share(s.sources.find(([k]) => k === '직접')?.[1] ?? 0, total)}%${ext ? ` · 외부 1위 ${ext[0]}` : ''}`, tone: search / total < 0.15 ? 'down' : undefined });
  }
  if (s?.sections.length) {
    const secTotal = s.sections.reduce((a, [, v]) => a + v, 0);
    out.push({ label: '가장 많이 본 분야', value: s.sections[0][0], detail: `첫 진입의 ${share(s.sections[0][1], secTotal)}%` });
  }
  const aiTotal = s ? s.bots.ai.reduce((a, [, v]) => a + v, 0) : 0;
  if (s && aiTotal) out.push({ label: 'AI 크롤러', value: `${fmt(aiTotal)}회`, detail: `${cur.visitors ? `방문자의 ${times(aiTotal, cur.visitors)}배 · ` : ''}${s.bots.ai[0][0]} 최다` });
  return out;
}

export function linkedinFacts(cur: Summary, prev: Summary | null, posts: Array<{ impressions: number; reactions: number; comments: number }>): Fact[] {
  const out: Fact[] = [];
  if (cur.liImpressions !== null && posts.length) {
    const per = Math.round(cur.liImpressions / posts.length);
    const prevPer = prev?.liImpressions != null && prev.liPosts ? Math.round(prev.liImpressions / prev.liPosts) : null;
    const d = vsPrev(per, prevPer);
    out.push({ label: '글당 노출', value: `${fmt(per)}회`, detail: `글 ${posts.length}개 · ${d.text}`, tone: d.tone });
    if (cur.followers) out.push({ label: '팔로워 대비 노출', value: `${share(per, cur.followers)}%`, detail: `글당 노출 ÷ 팔로워 ${fmt(cur.followers)}명` });
  }
  if (cur.liEngagement !== null) {
    const d = vsPrev(cur.liEngagement, prev?.liEngagement, '%p');
    out.push({ label: '참여율', value: `${cur.liEngagement}%`, detail: `반응 ${fmt(cur.liReactions)} · 댓글 ${fmt(cur.liComments)} · ${d.text}`, tone: d.tone });
  }
  if (posts.length) {
    const silent = posts.filter((p) => p.reactions + p.comments === 0).length;
    out.push({ label: '반응 없는 글', value: `${silent}/${posts.length}`, detail: '반응·댓글이 하나도 없는 글', tone: silent / posts.length > 0.5 ? 'down' : undefined });
    const best = posts.reduce((a, b) => (b.impressions > a.impressions ? b : a));
    const avg = cur.liImpressions ? cur.liImpressions / posts.length : 0;
    if (avg) out.push({ label: '최고 노출 글', value: `${fmt(best.impressions)}회`, detail: `글당 평균의 ${times(best.impressions, avg)}배` });
  }
  return out;
}

export function memberFacts(members: MemberRow[], periodPosts: number): Fact[] {
  if (!members.length) return [];
  const known = members.reduce((a, m) => a + m.posts, 0);
  const most = members.reduce((a, b) => (b.posts > a.posts ? b : a));
  const out: Fact[] = [
    { label: '참여 기여자', value: `${members.length}명`, detail: `작성자 확인된 글 ${known}/${periodPosts}개` },
    { label: '가장 많이 쓴 기여자', value: most.name, detail: `글 ${most.posts}개, 전체의 ${share(most.posts, known)}%` },
    { label: '조회 합 1위', value: members[0].name, detail: `${fmt(members[0].views)}회, 전체의 ${share(members[0].views, members.reduce((a, m) => a + m.views, 0))}%` },
  ];
  const avgRank = members.filter((m) => m.avgViews !== null && m.posts >= 2).sort((a, b) => (b.avgViews as number) - (a.avgViews as number));
  if (avgRank.length) out.push({ label: '글당 평균 1위', value: avgRank[0].name, detail: `${fmt(avgRank[0].avgViews as number)}회 (글 2개 이상)` });
  return out;
}
