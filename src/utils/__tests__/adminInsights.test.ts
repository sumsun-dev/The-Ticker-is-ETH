import { describe, expect, it } from 'vitest';
import {
  telegramFacts, siteFacts, linkedinFacts, memberFacts,
  memberBreakdown,
  tgType,
  isMature,
  typeBreakdown,
  monthlyTg,
  timeHeat,
  bestSlot,
  ruleInsights,
  findAiInsight,
} from '../adminInsights';
import { summarize, type Period, type Summary } from '../adminStats';
import type { StatsHistory, TgPostRecord } from '../../types/adminStats';

const NOW = '2026-10-26T00:00:00Z';
const post = (id: number, date: string, views: number, text = '뉴스'): TgPostRecord => ({ id, date, views, text });

describe('tgType', () => {
  it('제목 규칙으로 콘텐츠 유형을 나눈다', () => {
    expect(tgType('ACDT #101 · 10월 19일 이더리움 클라이언트 테스트')).toBe('코어 콜');
    expect(tgType('ACDE #247 · 누가 무슨 말을 했나')).toBe('코어 콜');
    expect(tgType('기각된 EIP는 멈추지 않는다 이번 호 인사이트 · 포크')).toBe('다이제스트');
    expect(tgType('[ETH레터] 글램스테르담 후디 활성화')).toBe('ETH레터');
    expect(tgType('이더리움은 BD 조직이 있어야 하는가? » 해당 논쟁 트래킹 페이지 (ECK)')).toBe('논쟁');
    expect(tgType(': : [테크/아티클] 월간 EIP 작성자: 리자몽')).toBe('리서치 공유');
    expect(tgType('[이더리움 코리아 기관 컨퍼런스 보고서] 9월 28일')).toBe('행사·공지');
    expect(tgType('[공지] 채널 안내')).toBe('행사·공지');
    expect(tgType('폴리마켓, V2 공개')).toBe('뉴스·코멘트');
  });
});

describe('isMature', () => {
  it('3일이 지난 글만 조회가 다 쌓였다고 본다', () => {
    expect(isMature('2026-10-23T00:00:00Z', NOW)).toBe(true);
    expect(isMature('2026-10-24T00:00:00Z', NOW)).toBe(false);
  });
});

describe('typeBreakdown', () => {
  it('최근 90일 유형별 평균 조회를 높은 순으로, 아직 쌓이는 글과 오래된 글은 뺀다', () => {
    const rows = typeBreakdown(
      [
        post(1, '2026-09-01T00:00:00Z', 200, 'ACDT #1'),
        post(2, '2026-09-02T00:00:00Z', 100, 'ACDT #2'),
        post(3, '2026-09-03T00:00:00Z', 900, '[공지] 행사'),
        post(4, '2026-10-25T00:00:00Z', 5, '[공지] 방금'),
        post(5, '2026-01-01T00:00:00Z', 9999, 'ACDT #0 오래된 글'),
      ],
      NOW,
    );
    expect(rows).toEqual([
      { type: '행사·공지', posts: 1, avgViews: 900 },
      { type: '코어 콜', posts: 2, avgViews: 150 },
    ]);
  });
});

describe('monthlyTg', () => {
  it('KST 월별 글 수, 조회, 글당 평균. 아직 쌓이는 글이 있는 달은 partial', () => {
    const rows = monthlyTg(
      [post(1, '2026-08-31T16:00:00Z', 100), post(2, '2026-09-10T00:00:00Z', 300), post(3, '2026-10-24T00:00:00Z', 10)],
      NOW,
    );
    expect(rows).toEqual([
      { month: '2026-09', posts: 2, views: 400, avgViews: 200, partial: false },
      { month: '2026-10', posts: 1, views: 10, avgViews: 10, partial: true },
    ]);
  });
});

describe('timeHeat / bestSlot', () => {
  it('요일(월=0)·4시간 단위 KST 칸별 조회 중앙값', () => {
    // 2026-10-05는 월요일. 00:30 UTC = 09:30 KST → 8~12시 칸(2)
    const views = [100, 110, 120, 130, 5000];
    const posts = views.map((v, i) => post(i, `2026-${i < 3 ? '09-14' : '09-21'}T00:30:00Z`, v));
    const heat = timeHeat(posts, NOW);
    expect(heat[0][2]).toEqual({ posts: 5, medianViews: 120 });
    expect(heat[1][2]).toEqual({ posts: 0, medianViews: null });
    expect(bestSlot(heat, 5)).toEqual({ day: 0, block: 2, posts: 5, medianViews: 120 });
    expect(bestSlot(heat)).toBeNull();
  });
});

const h: StatsHistory = {
  updatedAt: NOW,
  channel: 'ch',
  weeks: [],
  siteDaily: [],
  tgPosts: [
    post(1, '2026-10-06T01:00:00Z', 100, 'a'),
    post(2, '2026-10-07T01:00:00Z', 100, 'b'),
    post(6, '2026-10-08T01:00:00Z', 100, 'd'),
    post(3, '2026-10-13T01:00:00Z', 400, '[이더리움 코리아 기관 컨퍼런스 보고서] 보고서'),
    post(4, '2026-10-14T01:00:00Z', 100, 'c'),
    post(5, '2026-10-15T01:00:00Z', 250, 'e'),
  ],
  liPosts: [
    { title: '이전 글', urn: 'u0', date: '2026-10-01', impressions: 10, reactions: 0, comments: 0 },
    { title: '영상 글', urn: 'u1', date: '2026-10-13', impressions: 200, reactions: 6, comments: 2 },
  ],
};
const p = (start: string, end: string): Period => ({ key: start, label: start, start, end });

describe('summarize 추가 지표', () => {
  it('글당 평균 조회와 링크드인 참여율', () => {
    const s = summarize(h, p('2026-10-12', '2026-10-18'));
    expect(s.tgAvgViews).toBe(250);
    expect(s.tgFresh).toBe(0);
    expect(s.liEngagement).toBe(4);
  });

  it('조회 쌓인 글이 3개 미만이면 평균을 내지 않는다', () => {
    expect(summarize(h, p('2026-10-13', '2026-10-14')).tgAvgViews).toBeNull();
  });

  it('링크드인 기록이 기간을 다 덮지 못하면 참여율도 null', () => {
    const late = { ...h, liPosts: h.liPosts.slice(1) };
    expect(summarize(late, p('2026-10-12', '2026-10-18')).liEngagement).toBeNull();
  });
});

describe('ruleInsights', () => {
  it('지난 기간과 비교하고, 눈에 띄는 글과 크롤러를 짚는다', () => {
    const cur = summarize(h, p('2026-10-12', '2026-10-18'));
    const prev = summarize(h, p('2026-10-05', '2026-10-11'));
    const list = ruleInsights({ cur, prev, types: typeBreakdown(h.tgPosts, NOW), slot: null });
    const texts = list.map((x) => x.text);
    expect(list[0]).toMatchObject({ channel: 'telegram', tone: 'up' });
    expect(texts[0]).toContain('글당 평균 조회 250회');
    expect(texts[0]).toContain('+150%');
    expect(texts.some((t) => t.includes('컨퍼런스 보고서') && t.includes('1.6배'))).toBe(true);
    expect(texts.some((t) => t.includes('참여율 4%'))).toBe(true);
  });

  it('조회가 아직 쌓이는 글이 있으면 주의 문구를 단다', () => {
    const fresh = { ...h, tgPosts: [...h.tgPosts, post(9, '2026-10-24T00:00:00Z', 3, 'x')] };
    const cur = summarize(fresh, p('2026-10-19', '2026-10-25'));
    const list = ruleInsights({ cur, prev: null, types: [], slot: null });
    expect(list.some((x) => x.tone === 'caveat' && x.text.includes('1개'))).toBe(true);
  });
});

describe('findAiInsight', () => {
  it('선택한 기간의 AI 분석, 없으면 null', () => {
    const ai = { key: '2026-10-12', mode: 'week' as const, generatedAt: NOW, model: 'm', headline: 'h', summary: 's', highlights: [], actions: [], caveats: [] };
    expect(findAiInsight({ ...h, aiInsights: [ai] }, '2026-10-12')).toBe(ai);
    expect(findAiInsight({ ...h, aiInsights: [ai] }, '2026-10-19')).toBeNull();
    expect(findAiInsight(h, '2026-10-12')).toBeNull();
  });
});

describe('memberBreakdown', () => {
  const now = '2026-10-20T00:00:00Z';
  const post = (id: number, date: string, views: number) => ({ id, date, views, text: `글 ${id}` });
  const authors: Record<number, { name: string; avatar: string }> = { 1: { name: 'Jay', avatar: '/j.jpg' }, 2: { name: 'Jay', avatar: '/j.jpg' }, 3: { name: 'sose', avatar: '' } };

  it('작성자별로 글 수·조회 합·대표 글을 묶고, 평균은 조회가 쌓인 글만 쓴다', () => {
    const rows = memberBreakdown([post(1, '2026-10-10T00:00:00Z', 300), post(2, '2026-10-19T00:00:00Z', 50), post(3, '2026-10-11T00:00:00Z', 200), post(4, '2026-10-11T00:00:00Z', 999)], (id) => authors[id], now);
    expect(rows.map((r) => [r.name, r.posts, r.views, r.avgViews, r.top.id])).toEqual([
      ['Jay', 2, 350, 300, 1],
      ['sose', 1, 200, 200, 3],
    ]);
  });

  it('조회가 쌓인 글이 없으면 평균은 null', () => {
    expect(memberBreakdown([post(2, '2026-10-19T00:00:00Z', 50)], (id) => authors[id], now)[0].avgViews).toBeNull();
  });
});

describe('channel facts', () => {
  const base = { visitors: 240, pageLoads: 325, siteDays: 7, titles: {}, tgPosts: 17, tgViews: 5132, tgAvgViews: 302, tgFresh: 0, subscribers: 1510, liPosts: 2, liImpressions: 40, liReactions: 1, liComments: 0, liEngagement: 2.5, followers: 70, topTg: [{ id: 3, date: '2026-10-13T00:00:00Z', views: 1600, text: '보고서' }], topLi: [] } as unknown as Summary;
  const facts = (xs: Array<{ label: string; value: string; detail: string }>) => Object.fromEntries(xs.map((f) => [f.label, `${f.value} | ${f.detail}`]));

  it('텔레그램: 도달률·최고 글 비중·지난 기간 대비', () => {
    const f = facts(telegramFacts(base, { ...base, tgAvgViews: 315 } as Summary, [], null));
    expect(f['글당 평균 조회']).toBe('302회 | 지난 기간 -4%');
    expect(f['구독자 도달률']).toMatch(/^20% \|/);
    expect(f['최고 조회 글']).toBe('1,600회 | 이 기간 조회의 31% · 평균의 5.3배');
  });

  it('링크드인: 글당 노출과 반응 없는 글', () => {
    const f = facts(linkedinFacts(base, null, [{ impressions: 30, reactions: 1, comments: 0 }, { impressions: 10, reactions: 0, comments: 0 }]));
    expect(f['글당 노출']).toBe('20회 | 글 2개 · 지난 기간 비교 없음');
    expect(f['반응 없는 글']).toBe('1/2 | 반응·댓글이 하나도 없는 글');
    expect(f['최고 노출 글']).toBe('30회 | 글당 평균의 1.5배');
  });

  it('홈페이지: 하루 평균과 가장 많은 날', () => {
    const f = facts(siteFacts(base, null, [{ date: '2026-10-12', visitors: 20 }, { date: '2026-10-13', visitors: 40 }]));
    expect(f['하루 평균 방문자']).toBe('30명 | 가장 많은 날 10.13 40명');
  });

  it('기여자: 비어 있으면 빈 목록', () => {
    expect(memberFacts([], 5)).toEqual([]);
  });
});
