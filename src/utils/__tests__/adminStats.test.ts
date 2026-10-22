import { describe, expect, it } from 'vitest';
import { periods, summarize } from '../adminStats';
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
});
