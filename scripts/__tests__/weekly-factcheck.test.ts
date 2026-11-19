import { describe, expect, it, vi } from 'vitest';
import { collectTargets, daysBefore, formatReport, mergeInboxVersions, weeklyFactcheck, type WeeklyData } from '../lib/weekly-factcheck';

const URL1 = 'https://x.com/ethresearch/status/111';
const data = (over: Partial<WeeklyData> = {}): WeeklyData => ({
  inbox: [{ url: URL1, author: 'ethresearch', summary: '352 bytes pre-PQ, ~5 KB post-PQ per equivocation' }],
  digests: [
    {
      date: '2026-11-19',
      intro: '인트로 문장',
      sections: [
        {
          heading: 'A',
          items: [{ title: 'FOCIL 서명 크기', summary: 'XMSS 적용 시 약 5킬로바이트', why: '의미', url: URL1, source: 'X', date: '2026-11-19' }],
        },
      ],
    },
    { date: '2026-10-01', intro: '옛 호', sections: [{ heading: 'A', items: [{ title: '옛 항목', summary: 's', why: 'w', url: URL1, source: 'X', date: '2026-10-01' }] }] },
  ],
  debates: [
    {
      title: 'SNAP 논쟁',
      summary: '요약',
      keyPoints: ['쟁점1'],
      positions: [{ label: '반대', holders: [{ handle: 'Gary_Rong' }], points: ['SNAP 재사용 반대'] }],
      timeline: [{ date: '2026-11-17', digest: '2026-11-19', by: 'Gary_Rong', url: 'https://x.com/Gary_Rong/status/1', original: 'I am concerned about SNAP reuse.' }],
    },
    { title: '옛 논쟁', summary: 's', timeline: [{ date: '2026-09-01', original: 'old' }] },
  ],
  calls: [
    { id: 'acdt-103', series: 'acdt', number: 103, date: '2026-11-16', title: 'ACDT #103', lead: '8037 결정 연기', decisions: [{ label: 'x', text: '보류', original: 'No decision on EIP-8037 today' }] },
    { id: 'acdt-90', series: 'acdt', number: 90, date: '2026-08-01', title: '옛 콜', decisions: [] },
  ],
  ...over,
});

describe('daysBefore', () => {
  it('7일 전 날짜', () => expect(daysBefore('2026-11-19', 7)).toBe('2026-11-12'));
});

describe('collectTargets', () => {
  it('최근 7일만, 종류별 원문을 매핑한다', async () => {
    const t = await collectTargets(data(), '2026-11-12', '2026-11-19');
    expect(t.map((x) => `${x.kind}:${x.title}`)).toEqual(['digest:FOCIL 서명 크기', 'digest:인트로', 'debate:SNAP 논쟁', 'call:ACDT #103']);
    expect(t[0].source).toContain('~5 KB post-PQ');
    expect(t[1].source).toContain('FOCIL 서명 크기: XMSS');
    expect(t[2].source).toContain('@Gary_Rong');
    expect(t[2].claim).toContain('@Gary_Rong');
    expect(t[3].source).toContain('No decision on EIP-8037');
  });

  it('콜 원문은 주입된 fetch 결과를 앞에 붙이고, 실패해도 계속한다', async () => {
    const ok = await collectTargets(data(), '2026-11-12', '2026-11-19', async () => '- tldr highlight');
    expect(ok[ok.length - 1]?.source.startsWith('- tldr highlight')).toBe(true);
    const bad = await collectTargets(data(), '2026-11-12', '2026-11-19', async () => {
      throw new Error('net');
    });
    expect(bad[bad.length - 1]?.source).toContain('No decision');
  });

  it('원문 없는 항목은 source 가 빈 문자열', async () => {
    const t = await collectTargets(data({ inbox: [] }), '2026-11-12', '2026-11-19');
    expect(t[0].source).toBe('');
  });
});

describe('weeklyFactcheck', () => {
  const targets = () => collectTargets(data(), '2026-11-12', '2026-11-19');

  it('11-19 회귀: overreach 판정이 보고에 근거와 함께 나온다', async () => {
    const ask = vi.fn((p: string) =>
      p.includes('XMSS')
        ? JSON.stringify([
            { n: 1, grade: 'overreach', problem: '조건 없이 XMSS 적용 시로 일반화', quote: '352 bytes pre-PQ, ~5 KB post-PQ per equivocation' },
            { n: 2, grade: 'ok' },
          ])
        : '[]',
    );
    const r = weeklyFactcheck(await targets(), '2026-11-12', '2026-11-19', ask);
    expect(r.issues).toHaveLength(1);
    const text = formatReport(r);
    expect(text).toContain('[과대] 다이제스트 11-19 · FOCIL 서명 크기');
    expect(text).toContain('~5 KB post-PQ per equivocation');
    expect(text).toContain(URL1);
  });

  it('응답 앞뒤 잡글과 ok 만 있으면 문제 없음 → 빈 보고', async () => {
    const ask = () => `결과:\n${JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ n: i + 1, grade: 'ok' })))}`;
    const r = weeklyFactcheck(await targets(), '2026-11-12', '2026-11-19', ask);
    expect(r.checked).toBe(4);
    expect(formatReport(r)).toBe('');
  });

  it('원문 없는 항목은 판정하지 않고 개수만 센다', async () => {
    const ask = vi.fn(() => '[]');
    const t = await collectTargets(data({ inbox: [] }), '2026-11-12', '2026-11-19');
    const r = weeklyFactcheck(t, '2026-11-12', '2026-11-19', ask);
    expect(r.held).toBe(1);
    expect(r.checked).toBe(3);
  });

  it('잘못된 등급·비 JSON 은 그 묶음만 검사 실패, 다른 묶음은 계속', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ kind: 'digest' as const, date: '2026-11-19', title: `t${i}`, claim: 'c', source: 's', urls: [] }));
    let call = 0;
    const ask = () => (++call === 1 ? 'not json' : JSON.stringify([{ n: 1, grade: 'contradiction', problem: 'p', quote: 'q' }]));
    const r = weeklyFactcheck(many, 'a', 'b', ask);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain('검사 실패');
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].title).toBe('t8');
    const bad = weeklyFactcheck(many.slice(0, 2), 'a', 'b', () => '[{"n":1,"grade":"weird"}]');
    expect(bad.failures).toHaveLength(1);
    expect(formatReport(bad)).toContain('검사 실패');
  });
});

describe('formatReport', () => {
  const issue = (i: number, grade: 'contradiction' | 'overreach') => ({
    kind: 'debate' as const, date: '2026-11-1' + (i % 10), title: `제목${i}`, grade, problem: '문제 '.repeat(20), quote: 'q'.repeat(100), urls: ['https://x.com/a/status/1'],
  });
  const result = (issues: ReturnType<typeof issue>[]) => ({ since: 'a', today: 'b', checked: 99, held: 0, issues, failures: [] });

  it('3500자를 넘지 않고 모순을 먼저, 넘친 건 개수로 요약한다', () => {
    const issues = [...Array.from({ length: 30 }, (_, i) => issue(i, 'overreach')), ...Array.from({ length: 30 }, (_, i) => issue(100 + i, 'contradiction'))];
    const text = formatReport(result(issues));
    expect(text.length).toBeLessThanOrEqual(3500);
    expect(text.indexOf('[모순]')).toBeLessThan(text.indexOf('[과대]') === -1 ? Infinity : text.indexOf('[과대]'));
    expect(text).toMatch(/외 \d+건 생략 \(모순 \d+, 과대 \d+\)/);
    expect(text).not.toContain('[과대]'); // 모순만으로 한도 소진
  });

  it('문제도 실패도 없으면 빈 문자열', () => expect(formatReport(result([]))).toBe(''));
});

describe('mergeInboxVersions', () => {
  const e = (url: string, summary: string) => ({ url, author: 'a', summary });
  it('같은 url 은 앞(최신) 버전이 이기고, 지난 버전에만 있던 url 도 남는다', () => {
    const r = mergeInboxVersions([{ items: [e('u1', 'new')] }, { items: [e('u1', 'old'), e('u2', 'only-old')] }]);
    expect(r.map((x) => `${x.url}:${x.summary}`)).toEqual(['u1:new', 'u2:only-old']);
  });
  it('깨진 버전은 건너뛴다', () => {
    const r = mergeInboxVersions([null, 'x', { items: 5 }, { items: [e('u1', 's')] }]);
    expect(r).toHaveLength(1);
  });
});

describe('논쟁 입장 주인 코드 대조', () => {
  it('holder 가 타임라인 by 에 없으면 모델 없이 모순으로 보고한다', async () => {
    const d = data();
    d.debates[0].positions = [{ label: '반대', holders: [{ handle: 'barnabemonnot' }, { handle: 'GARY_rong' }], points: ['p'] }];
    const t = await collectTargets(d, '2026-11-12', '2026-11-19');
    const ask = vi.fn(() => '[]');
    const r = weeklyFactcheck(t, '2026-11-12', '2026-11-19', ask);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].grade).toBe('contradiction');
    expect(r.issues[0].problem).toBe('입장 주인 @barnabemonnot 가 타임라인 원문에 없음');
  });
  it('원문이 없어도 걸리고, holder 가 모두 타임라인에 있으면 안 걸린다', async () => {
    const d = data({ inbox: [] });
    d.debates[0].positions = [{ label: 'x', holders: [{ handle: 'zed' }], points: [] }];
    d.debates[0].timeline = [{ date: '2026-11-17', by: 'Gary_Rong' }];
    const r = weeklyFactcheck(await collectTargets(d, '2026-11-12', '2026-11-19'), 'a', 'b', () => '[]');
    expect(r.issues.map((i) => i.problem)).toEqual(['입장 주인 @zed 가 타임라인 원문에 없음']);
    const ok = weeklyFactcheck(await collectTargets(data(), '2026-11-12', '2026-11-19'), 'a', 'b', () => '[]');
    expect(ok.issues).toHaveLength(0);
  });
});
