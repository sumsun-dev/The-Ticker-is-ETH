import { describe, expect, it } from 'vitest';
import { buildInsightInput, buildInsightPrompt, parseAiInsight, insightTargets, withAiInsights, MAX_INSIGHTS } from '../lib/stats-insights';
import type { AiInsight, StatsHistory } from '../../src/types/adminStats';

const h: StatsHistory = {
  updatedAt: '2026-10-26T00:00:00Z',
  channel: 'ch',
  weeks: [{ week: '2026-10-19', tg: { subscribers: 1500 } }],
  siteDaily: [{ date: '2026-10-19', visitors: 30, pageLoads: 40 }],
  tgPosts: [
    { id: 1, date: '2026-10-13T01:00:00Z', views: 300, text: 'ACDT #100 · 콜' },
    { id: 2, date: '2026-10-20T01:00:00Z', views: 120, text: '[ETH레터] 소식' },
  ],
  liPosts: [
    { title: '이전 글', urn: 'u0', date: '2026-10-10', impressions: 20, reactions: 0, comments: 0 },
    { title: '영상 글', urn: 'u1', date: '2026-10-21', impressions: 230, reactions: 6, comments: 0 },
  ],
};

const MODEL_OUT = `여기 결과입니다
\`\`\`json
{"headline":"영상 글이 링크드인 노출을 끌어올렸다","summary":"요약 문단","highlights":[{"channel":"linkedin","title":"영상 글 230회","detail":"평소의 10배","tone":"up"}],"actions":["영상 글을 텔레그램에도 올린다"],"caveats":["홈페이지 기록은 2주치뿐"]}
\`\`\``;

describe('insightTargets', () => {
  it('지난주와 진행 중인 이번 달', () => {
    expect(insightTargets(h, '2026-10-27').map((p) => p.key)).toEqual(['2026-10-19', '2026-10']);
  });
});

describe('buildInsightInput / buildInsightPrompt', () => {
  it('기간 지표, 이전 기간, 규칙 인사이트, 유형 분석을 담는다', () => {
    const [week] = insightTargets(h, '2026-10-27');
    const input = buildInsightInput(h, week, 'week', '2026-10-27');
    expect(input.period).toMatchObject({ start: '2026-10-19', end: '2026-10-25', mode: 'week' });
    expect(input.current.telegram.posts).toBe(1);
    expect(input.previous?.telegram.posts).toBe(1);
    expect(input.current.linkedin.impressions).toBe(230);
    expect(input.ruleInsights.length).toBeGreaterThan(0);
    const prompt = buildInsightPrompt(input);
    expect(prompt).toContain('"start": "2026-10-19"');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('<data>');
    expect(input.period.isPartial).toBe(false);
  });

  it('진행 중인 달은 부분 기간으로 표시하고 합계 비교를 막는다', () => {
    const month = insightTargets(h, '2026-10-27')[1];
    const input = buildInsightInput(h, month, 'month', '2026-10-27');
    expect(input.period).toMatchObject({ isPartial: true, elapsedDays: 26 });
    expect(input.dataNotes.some((x) => x.includes('진행 중'))).toBe(true);
  });
});

describe('parseAiInsight', () => {
  it('모델 응답에서 JSON을 꺼내 검증하고 메타를 붙인다', () => {
    const ai = parseAiInsight(MODEL_OUT, { key: '2026-10-19', mode: 'week', model: 'fable', generatedAt: '2026-10-27T00:00:00Z' });
    expect(ai.headline).toBe('영상 글이 링크드인 노출을 끌어올렸다');
    expect(ai.highlights[0]).toEqual({ channel: 'linkedin', title: '영상 글 230회', detail: '평소의 10배', tone: 'up' });
    expect(ai.key).toBe('2026-10-19');
  });

  it('형식이 틀리면 던진다', () => {
    expect(() => parseAiInsight('{"headline":""}', { key: 'k', mode: 'week', model: 'm', generatedAt: 'g' })).toThrow();
  });
});

describe('withAiInsights', () => {
  it('기간마다 claude를 불러 같은 키는 바꾸고, 실패한 기간은 이전 분석을 남긴다', () => {
    const old: AiInsight = { key: '2026-10', mode: 'month', generatedAt: 'old', model: 'm', headline: '예전', summary: '', highlights: [], actions: [], caveats: [] };
    const calls: string[] = [];
    const run = (prompt: string) => {
      calls.push(prompt);
      if (prompt.includes('"mode": "month"')) throw new Error('limit');
      return MODEL_OUT;
    };
    const { history, errors } = withAiInsights({ ...h, aiInsights: [old] }, '2026-10-27', run, 'fable', new Date('2026-10-27T00:00:00Z'));
    expect(calls).toHaveLength(2);
    expect(errors).toEqual([expect.stringContaining('2026-10')]);
    expect(history.aiInsights?.map((x) => x.key).sort()).toEqual(['2026-10', '2026-10-19']);
    expect(history.aiInsights?.find((x) => x.key === '2026-10')?.headline).toBe('예전');
  });

  it(`최근 ${MAX_INSIGHTS}개만 남긴다`, () => {
    const many: AiInsight[] = Array.from({ length: MAX_INSIGHTS + 5 }, (_, i) => ({ key: `2020-01-${String(i).padStart(2, '0')}`, mode: 'week', generatedAt: `2020-01-01T00:00:${String(i).padStart(2, '0')}Z`, model: 'm', headline: 'h', summary: '', highlights: [], actions: [], caveats: [] }));
    const { history } = withAiInsights({ ...h, aiInsights: many }, '2026-10-27', () => MODEL_OUT, 'fable', new Date('2026-10-27T00:00:00Z'));
    expect(history.aiInsights).toHaveLength(MAX_INSIGHTS);
    expect(history.aiInsights?.some((x) => x.key === '2026-10-19')).toBe(true);
  });
});
