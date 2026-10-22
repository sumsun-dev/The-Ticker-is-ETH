/** 관리자 성과 대시보드 집계: 누적 기록(StatsHistory)을 주·월 단위로 묶는다 */
import type { LiPostRecord, Ranked, SiteWeek, StatsHistory, TgPostRecord } from '../types/adminStats';

export type Mode = 'week' | 'month';
export interface Period { key: string; label: string; start: string; end: string }

const DAY = 864e5;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** UTC 시각 문자열의 KST 날짜 */
export const kstDate = (s: string) => iso(Date.parse(s) + 9 * 3600e3);
const inP = (d: string, p: Period) => d >= p.start && d <= p.end;

/** 데이터가 있는 가장 이른 날부터. 주는 지난주까지, 월은 진행 중인 이번 달까지. 최신이 앞 */
export function periods(h: StatsHistory, mode: Mode, today: string, limit = mode === 'week' ? 26 : 24): Period[] {
  const firsts = [h.siteDaily[0]?.date, h.tgPosts[0] && kstDate(h.tgPosts[0].date), h.liPosts[0]?.date, h.weeks[0]?.week].filter(Boolean) as string[];
  if (!firsts.length) return [];
  const first = firsts.sort()[0];
  const out: Period[] = [];
  if (mode === 'week') {
    const t = Date.parse(today);
    let mon = t - ((new Date(t).getUTCDay() + 6) % 7) * DAY - 7 * DAY; // 지난주 월요일
    while (out.length < limit && iso(mon + 6 * DAY) >= first) {
      const start = iso(mon);
      const end = iso(mon + 6 * DAY);
      out.push({ key: start, label: `${start.slice(5).replace('-', '.')} 주`, start, end });
      mon -= 7 * DAY;
    }
  } else {
    let [y, m] = today.split('-').map(Number);
    m += 1;
    for (let i = 0; i < limit; i++) {
      m -= 1;
      if (m === 0) [y, m] = [y - 1, 12];
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const end = iso(Date.UTC(y, m, 1) - DAY);
      if (end < first) break;
      const ongoing = end >= today;
      out.push({ key: start.slice(0, 7), label: `${y}.${String(m).padStart(2, '0')}${ongoing ? ' (진행 중)' : ''}`, start, end });
    }
  }
  return out;
}

/** 여러 주의 순위표를 합친다 */
function mergeRanked(lists: Ranked[], top = 10): Ranked {
  const m = new Map<string, number>();
  for (const list of lists) for (const [k, v] of list) m.set(k, (m.get(k) ?? 0) + v);
  return [...m].sort((a, b) => b[1] - a[1]).slice(0, top);
}

export interface Summary {
  /** 주는 주간 고유 방문자, 월은 일별 방문자 합 (로그가 있는 날만). 주인데 로그가 7일을 다 덮지 못하면 null (부분 주와 비교하면 증감이 왜곡된다) */
  visitors: number | null;
  pageLoads: number | null;
  siteDays: number;
  site?: Pick<SiteWeek, 'sources' | 'sections' | 'topPages' | 'refHosts'> & { bots: SiteWeek['bots']; newVisitors?: number; mobilePct?: number; daily?: Ranked };
  titles: Record<string, string>;
  tgPosts: number;
  tgViews: number;
  subscribers: number | null;
  liPosts: number;
  /** 링크드인 기록이 시작되기 전이거나 기간 일부만 덮으면 null */
  liImpressions: number | null;
  liReactions: number;
  liComments: number;
  followers: number | null;
  topTg: TgPostRecord[];
  topLi: LiPostRecord[];
}

export function summarize(h: StatsHistory, p: Period): Summary {
  const days = h.siteDaily.filter((d) => inP(d.date, p));
  const weeks = h.weeks.filter((w) => inP(w.week, p));
  const siteWeeks = weeks.flatMap((w) => (w.site ? [w.site] : []));
  const exactWeek = weeks.length === 1 && weeks[0].week === p.start && p.end === iso(Date.parse(p.start) + 6 * DAY) ? weeks[0].site : undefined;
  const tg = h.tgPosts.filter((x) => inP(kstDate(x.date), p));
  const li = h.liPosts.filter((x) => inP(x.date, p));
  const weekMode = p.end === iso(Date.parse(p.start) + 6 * DAY);
  const liStart = h.liPosts[0]?.date;
  // 주는 기간 전체를 덮어야, 월은 기록이 시작된 달부터 보여 준다 (부분 주끼리 비교하면 증감이 왜곡된다)
  const liCovered = !!liStart && (weekMode ? liStart <= p.start : liStart <= p.end);
  const last = <T,>(xs: Array<T | undefined>) => xs.filter((x): x is T => x !== undefined).at(-1) ?? null;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    visitors: exactWeek ? exactWeek.visitors : days.length && !(weekMode && days.length < 7) ? sum(days.map((d) => d.visitors)) : null,
    pageLoads: exactWeek ? exactWeek.pageLoads : days.length && !(weekMode && days.length < 7) ? sum(days.map((d) => d.pageLoads)) : null,
    siteDays: days.length,
    site: siteWeeks.length
      ? {
          sources: mergeRanked(siteWeeks.map((s) => s.sources)),
          sections: mergeRanked(siteWeeks.map((s) => s.sections)),
          topPages: mergeRanked(siteWeeks.map((s) => s.topPages)),
          refHosts: mergeRanked(siteWeeks.map((s) => s.refHosts), 5),
          bots: { search: sum(siteWeeks.map((s) => s.bots.search)), ai: mergeRanked(siteWeeks.map((s) => s.bots.ai)) },
          ...(exactWeek ? { newVisitors: exactWeek.newVisitors, mobilePct: exactWeek.mobilePct, daily: exactWeek.daily } : {}),
        }
      : undefined,
    titles: Object.assign({}, ...weeks.map((w) => w.site?.titles ?? {})),
    tgPosts: tg.length,
    tgViews: sum(tg.map((x) => x.views)),
    subscribers: last(weeks.map((w) => w.tg?.subscribers)),
    liPosts: li.length,
    liImpressions: liCovered ? sum(li.map((x) => x.impressions)) : null,
    liReactions: sum(li.map((x) => x.reactions)),
    liComments: sum(li.map((x) => x.comments)),
    followers: last(weeks.map((w) => w.li?.followers)),
    topTg: [...tg].sort((a, b) => b.views - a.views).slice(0, 5),
    topLi: [...li].sort((a, b) => b.impressions - a.impressions).slice(0, 5),
  };
}
