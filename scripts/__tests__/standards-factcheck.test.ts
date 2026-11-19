import { describe, expect, it, vi } from 'vitest';
import { bodyOf, claimOf, composeReport, metaMismatches, mismatchItem, selectStandards, standardsFactcheck, stdIssueItem, type StdRec, type StdTarget } from '../lib/standards-factcheck';

const md = (over: Record<string, string> = {}, body = '## Abstract\nTransfers cost 21000 gas.\n') => {
  const fm = { eip: '20', title: 'Token Standard', status: 'Final', type: 'Standards Track', category: 'ERC', created: '2015-11-19', requires: '165, 721', ...over };
  return `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n${body}`;
};
const rec = (over: Partial<StdRec> = {}): StdRec => ({
  number: 20,
  titleKo: '토큰 표준',
  summary: '가스 21000을 씁니다',
  deep: [{ title: 'A', body: '본문 진술' }],
  iface: [{ sig: 'function transfer(address to, uint256 v)', ko: '전송' }],
  safety: [{ title: '주의', body: '승인 경쟁' }],
  meta: { title: 'Token Standard', description: '', status: 'Final', type: 'Standards Track', category: 'ERC', created: '2015-11-19', authors: [], requires: [165, 721] },
  generatedAt: '2026-11-18T00:00:00Z',
  ...over,
});
const target = (n = 20, markdown = md(), over: Partial<StdRec> = {}): StdTarget => ({ kind: 'EIP', rec: rec({ number: n, ...over }), markdown });

describe('metaMismatches', () => {
  it('should be empty when meta matches', () => {
    expect(metaMismatches('EIP', rec(), md())).toEqual([]);
  });
  it('should list each differing field', () => {
    const m = metaMismatches('EIP', rec(), md({ status: 'Last Call', requires: '165', created: '2016-01-01' }));
    expect(m.map((x) => x.field).sort()).toEqual(['created', 'requires', 'status']);
    expect(m.find((x) => x.field === 'status')).toMatchObject({ recorded: 'Final', source: 'Last Call' });
  });
  it('should ignore requires order and treat missing category as empty', () => {
    const r = rec({ meta: { ...rec().meta, category: undefined, requires: [721, 165] } });
    expect(metaMismatches('EIP', r, md({ category: '' }))).toEqual([]);
  });
  it('should return nothing when source has no parsable meta', () => {
    expect(metaMismatches('EIP', rec(), 'not a spec')).toEqual([]);
  });
});

describe('selectStandards', () => {
  const recs = [rec({ number: 1, generatedAt: '2026-11-18T01:00:00Z' }), rec({ number: 2, generatedAt: '2026-10-01T00:00:00Z' })];
  it('should pick only records generated since the date', () => {
    expect(selectStandards(recs, '2026-11-12', false).map((r) => r.number)).toEqual([1]);
  });
  it('should pick everything with all', () => {
    expect(selectStandards(recs, '2026-11-12', true)).toHaveLength(2);
  });
});

describe('bodyOf', () => {
  it('should drop frontmatter and put Abstract/Motivation/Specification first', () => {
    const b = bodyOf(md({}, '## Rationale\nR\n## Specification\nS\n## Abstract\nA\n## Motivation\nM\n'));
    expect(b).not.toContain('eip:');
    expect(b.indexOf('## Abstract')).toBeLessThan(b.indexOf('## Motivation'));
    expect(b.indexOf('## Motivation')).toBeLessThan(b.indexOf('## Specification'));
    expect(b.indexOf('## Specification')).toBeLessThan(b.indexOf('## Rationale'));
  });
  it('should cap at 6000 chars', () => {
    expect(bodyOf(md({}, `## Abstract\n${'x'.repeat(9000)}`)).length).toBe(6000);
  });
});

describe('claimOf', () => {
  it('should include facts, skip why, and cap at 3000 chars', () => {
    const c = claimOf(rec({ deep: [{ title: 'A', body: 'y'.repeat(5000) }], why: '비유 이야기' } as Partial<StdRec>));
    expect(c).toContain('가스 21000');
    expect(c).toContain('function transfer');
    expect(c).not.toContain('비유 이야기');
    expect(c.length).toBe(3000);
  });
});

describe('standardsFactcheck', () => {
  it('should put claim and source in the prompt and parse grades', () => {
    const ask = vi.fn(() => '[{"n":1,"grade":"contradiction","problem":"가스 틀림","quote":"21000 gas"}]');
    const r = standardsFactcheck([target()], ask);
    const p = ask.mock.calls[0][0] as string;
    expect(p).toContain('가스 21000을 씁니다');
    expect(p).toContain('Transfers cost 21000 gas.');
    expect(p).not.toContain('requires: 165');
    expect(r.checked).toBe(1);
    expect(r.issues).toEqual([{ kind: 'EIP', number: 20, title: '토큰 표준', grade: 'contradiction', problem: '가스 틀림', quote: '21000 gas' }]);
  });
  it('should batch by 4 and keep going when a batch fails', () => {
    const ts = [1, 2, 3, 4, 5].map((n) => target(n));
    const ask = vi
      .fn()
      .mockReturnValueOnce('not json')
      .mockReturnValueOnce('[{"n":1,"grade":"overreach","problem":"보장"}]');
    const r = standardsFactcheck(ts, ask);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain('EIP-1');
    expect(r.checked).toBe(1);
    expect(r.issues[0]).toMatchObject({ number: 5, grade: 'overreach' });
  });
  it('should hold targets without source and skip ok verdicts', () => {
    const ask = vi.fn(() => '[{"n":1,"grade":"ok"}]');
    const r = standardsFactcheck([target(1), target(2, '')], ask);
    expect(r).toMatchObject({ checked: 1, held: 1, issues: [] });
  });
});

describe('composeReport', () => {
  const item = (grade: 'contradiction' | 'overreach' | 'mech', n: number, len = 10) => ({ grade, block: `${grade}${n}${'x'.repeat(len)}` });
  it('should return empty when nothing to report', () => {
    expect(composeReport('h', [], [])).toBe('');
  });
  it('should sort contradiction first and summarize overflow within max', () => {
    const items = [item('overreach', 1, 300), ...Array.from({ length: 12 }, (_, i) => item('contradiction', i, 300)), item('mech', 99, 300)];
    const out = composeReport('head', items, ['검사 실패: x'], 1500);
    expect(out.length).toBeLessThanOrEqual(1500);
    expect(out.indexOf('contradiction0')).toBeLessThan(out.indexOf('mech99') === -1 ? 1e9 : out.indexOf('mech99'));
    expect(out).toMatch(/외 \d+건 생략 \(/);
    expect(out).toContain('검사 실패: x');
  });
  it('should render meta mismatch and issue blocks', () => {
    expect(mismatchItem({ kind: 'EIP', number: 7, field: 'status', recorded: 'Draft', source: 'Final' }).block).toBe('[메타 불일치] EIP-7 status: 기록 "Draft" / 원문 "Final"');
    expect(stdIssueItem({ kind: 'ERC', number: 7, title: 't', grade: 'overreach', problem: 'p', quote: 'q' }).block).toContain('[과대] ERC-7 t');
  });
});
