import { describe, expect, it } from 'vitest';
import { automatedTotal, mergeAeo, periods, summarize } from '../adminStats';
import type { StatsHistory } from '../../types/adminStats';

const site = (visitors: number) => ({
  visitors, newVisitors: visitors - 1, pageLoads: visitors * 2, mobilePct: 10, daily: [], peakHour: 3,
  sections: [['뉴스', 2]] as Array<[string, number]>, topPages: [['/news', 2]] as Array<[string, number]>,
  sources: [['직접', 3]] as Array<[string, number]>, refHosts: [], bots: { search: 5, ai: [['OpenAI', 2]] as Array<[string, number]> }, notFound: [],
});

const h: StatsHistory = {
  updatedAt: '2026-10-26T00:00:00Z',
  channel: 'ch',
  weeks: [
    { week: '2026-10-12', site: site(10), tg: { subscribers: 100 }, li: { followers: 7, impressions30: 0, reactions30: 0, newFollowers30: 0 } },
    { week: '2026-10-19', site: site(20), tg: { subscribers: 110 } },
  ],
  siteDaily: [
    { date: '2026-10-12', visitors: 4, pageLoads: 5 },
    { date: '2026-10-20', visitors: 6, pageLoads: 7 },
  ],
  tgPosts: [
    { id: 1, date: '2026-09-30T16:00:00+00:00', views: 50, text: '9월 30일 UTC는 10월 1일 KST' },
    { id: 2, date: '2026-10-13T01:00:00+00:00', views: 300, text: 'b' },
    { id: 3, date: '2026-10-14T01:00:00+00:00', views: 100, text: 'c' },
  ],
  liPosts: [
    { title: 'l0', urn: 'u0', date: '2026-10-06', impressions: 5, reactions: 0, comments: 0 },
    { title: 'l', urn: 'u1', date: '2026-10-13', impressions: 40, reactions: 1, comments: 0 },
  ],
};

describe('adminStats', () => {
  it('periods: 지난주부터 데이터 시작까지, 최신이 앞', () => {
    const ws = periods(h, 'week', '2026-10-27');
    expect(ws[0]).toMatchObject({ start: '2026-10-19', end: '2026-10-25' });
    expect(ws.at(-1)?.start).toBe('2026-09-28');
    const ms = periods(h, 'month', '2026-11-03');
    expect(ms.map((m) => m.label)).toEqual(['2026.11 (진행 중)', '2026.10']);
  });

  it('periods: 일은 마지막 수집 전날부터 거꾸로, 하루짜리 기간', () => {
    const ds = periods(h, 'day', '2026-10-27');
    expect(ds[0]).toMatchObject({ key: '2026-10-25', start: '2026-10-25', end: '2026-10-25' });
    expect(ds[1].key).toBe('2026-10-24');
    expect(ds.at(-1)?.key).toBe('2026-10-01');
  });

  it('summarize: 일은 그날 방문자와 글만, 주간 순위표는 붙이지 않는다', () => {
    const s = summarize(h, { key: '2026-10-12', label: '', start: '2026-10-12', end: '2026-10-12' });
    expect(s.visitors).toBe(4);
    expect(s.pageLoads).toBe(5);
    expect(s.site).toBeUndefined();
    const t = summarize(h, { key: '2026-10-13', label: '', start: '2026-10-13', end: '2026-10-13' });
    expect(t.tgPosts).toBe(1);
    expect(t.tgViews).toBe(300);
    expect(t.liImpressions).toBe(40);
  });

  it('summarize: 일은 그날 상세(siteDaily.site)와 그날 구독자(tgDaily)를 쓴다', () => {
    const day = { sources: [['검색', 2]] as Array<[string, number]>, sections: [], topPages: [['/roadmap', 3]] as Array<[string, number]>, refHosts: [], bots: { search: 1, ai: [['OpenAI', 4]] as Array<[string, number]> }, notFound: [], newVisitors: 2, mobilePct: 50 };
    const hd: StatsHistory = {
      ...h,
      siteDaily: [{ date: '2026-10-20', visitors: 6, pageLoads: 7, site: day }],
      tgDaily: [{ date: '2026-10-20', subscribers: 1506 }],
    };
    const s = summarize(hd, { key: '2026-10-20', label: '', start: '2026-10-20', end: '2026-10-20' });
    expect(s.site?.sources).toEqual([['검색', 2]]);
    expect(s.site?.bots.ai).toEqual([['OpenAI', 4]]);
    expect(s.site?.newVisitors).toBe(2);
    expect(s.titles).toEqual({});
    expect(s.subscribers).toBe(1506);
    // 서버가 매일 남긴 구독자가 마지막 주간 수집보다 새로우면 그날까지 보여 준다
    expect(periods({ ...hd, tgDaily: [{ date: '2026-10-28', subscribers: 1 }] }, 'day', '2026-10-29')[0].key).toBe('2026-10-28');
    // 그날 기록이 없으면 비운다 (월요일 주 기록 값을 끌어오지 않는다)
    expect(summarize(hd, { key: '2026-10-19', label: '', start: '2026-10-19', end: '2026-10-19' }).subscribers).toBeNull();
  });

  it('summarize: 주는 주간 고유 방문자, 글은 KST 날짜로 묶는다', () => {
    const s = summarize(h, { key: '2026-10-12', label: '', start: '2026-10-12', end: '2026-10-18' });
    expect(s.visitors).toBe(10);
    expect(s.tgViews).toBe(400);
    expect(s.topTg.map((x) => x.id)).toEqual([2, 3]);
    expect(s.subscribers).toBe(100);
    expect(s.followers).toBe(7);
    expect(s.liImpressions).toBe(40);
    expect(s.site?.newVisitors).toBe(9);
  });

  it('summarize: 월은 일별 방문자 합, 순위표는 주들을 합친다, 지표는 월말 값', () => {
    const s = summarize(h, { key: '2026-10', label: '', start: '2026-10-01', end: '2026-10-31' });
    expect(s.visitors).toBe(10);
    expect(s.tgPosts).toBe(3);
    expect(s.subscribers).toBe(110);
    expect(s.followers).toBe(7);
    expect(s.site?.sources).toEqual([['직접', 6]]);
    expect(s.site?.newVisitors).toBeUndefined();
  });

  it('summarize: 로그가 일부만 있는 주, 링크드인 기록 전 기간은 null', () => {
    const partial = summarize(h, { key: '2026-10-19', label: '', start: '2026-10-19', end: '2026-10-25' });
    expect(partial.visitors).toBe(20); // 주 기록이 있으면 그 값
    const noWeek = summarize({ ...h, weeks: [] }, { key: '2026-10-19', label: '', start: '2026-10-19', end: '2026-10-25' });
    expect(noWeek.visitors).toBeNull();
    expect(summarize(h, { key: '2026-10-05', label: '', start: '2026-10-05', end: '2026-10-11' }).liImpressions).toBeNull();
  });

  it('summarize: 데이터 없는 기간은 null', () => {
    const s = summarize(h, { key: '2026-08', label: '', start: '2026-08-01', end: '2026-08-31' });
    expect(s.visitors).toBeNull();
    expect(s.subscribers).toBeNull();
    expect(s.site).toBeUndefined();
  });

  it('mergeAeo: 주별 AEO를 합치고, 페이지는 AI 요청 순', () => {
    expect(mergeAeo([])).toBeUndefined();
    const a = { referrals: [['ChatGPT', 2]], kinds: [['실시간 답변', 3]], pages: [['/a', 3, 1]], errors: [] } as const;
    const b = { referrals: [['ChatGPT', 1], ['Perplexity', 1]], kinds: [['학습 수집', 5]], pages: [['/a', 1, 0], ['/b', 5, 0]], errors: [['404 /x', 2]] } as const;
    const m = mergeAeo([structuredClone(a) as never, structuredClone(b) as never]);
    expect(m?.referrals).toEqual([['ChatGPT', 3], ['Perplexity', 1]]);
    expect(m?.kinds).toEqual([['학습 수집', 5], ['실시간 답변', 3]]);
    expect(m?.pages).toEqual([['/b', 5, 0], ['/a', 4, 1]]);
    expect(m?.errors).toEqual([['404 /x', 2]]);
  });
});

describe('automated visits in summarize', () => {
  const day = (automated?: Array<[string, number]>) => ({ sources: [], sections: [], topPages: [], refHosts: [], bots: { search: 0, ai: [] }, notFound: [], newVisitors: 1, mobilePct: 0, ...(automated ? { automated } : {}) });

  it('should merge automated visits by source across days', () => {
    const hd: StatsHistory = {
      ...h,
      weeks: [],
      siteDaily: [
        { date: '2026-11-05', visitors: 286, pageLoads: 300, site: day([['텐센트 클라우드', 260]]) },
        { date: '2026-11-06', visitors: 24, pageLoads: 30, site: day([['텐센트 클라우드', 16], ['검색엔진 렌더링', 2]]) },
      ],
    };
    const s = summarize(hd, { key: '2026-11', label: '', start: '2026-11-01', end: '2026-11-30' });
    expect(s.automated).toEqual([['텐센트 클라우드', 276], ['검색엔진 렌더링', 2]]);
    expect(automatedTotal(s.automated)).toBe(278);
  });

  it('should be null when the period has no classification yet', () => {
    const s = summarize(h, { key: '2026-10-12', label: '', start: '2026-10-12', end: '2026-10-12' });
    expect(s.automated).toBeNull();
    expect(automatedTotal(s.automated)).toBeNull();
  });
});
