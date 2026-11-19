import { describe, expect, it, vi } from 'vitest';
import { affHash, collectAffiliations, conflicts, nextSeen, pickChanged, speakerFactcheck, type SpeakerData } from '../lib/speaker-factcheck';

const data = (over: Partial<SpeakerData> = {}): SpeakerData => ({
  callSpeakers: { nixo: { name: 'Nixo', org: 'EF', role: 'ACDE 진행', handle: 'nixorokish' } },
  debates: [],
  calls: [],
  profiles: {},
  ...over,
});

describe('conflicts', () => {
  it('should flag same handle (case-insensitive) with different orgs and show where each came from', () => {
    const rows = collectAffiliations(
      data({
        callSpeakers: { gary: { name: 'Gary', org: 'EF', handle: 'Gary_Rong' } },
        debates: [{ id: 'd1', positions: [{ holders: [{ handle: 'gary_rong', name: 'Gary', role: 'Paradigm 리서처' }] }] }],
      }),
    );
    expect(rows).toHaveLength(1);
    const c = conflicts(rows);
    expect(c).toHaveLength(1);
    expect([...c[0].values]).toEqual([
      ['EF', ['콜 명단 gary']],
      ['Paradigm 리서처', ['논쟁 d1']],
    ]);
  });
  it('should not flag consistent labels sharing an org', () => {
    const rows = collectAffiliations(
      data({ debates: [{ id: 'd1', positions: [{ holders: [{ handle: 'nixorokish', name: 'Nixo', role: 'EF 프로토콜 지원' }] }] }] }),
    );
    expect(conflicts(rows)).toEqual([]);
  });
  it('should ignore holders without handle or role and strip @', () => {
    const rows = collectAffiliations(
      data({ callSpeakers: {}, debates: [{ id: 'd', positions: [{ holders: [{ name: 'x', role: 'EF' }, { handle: '@a', name: 'a' }, { handle: '@b', name: 'b', role: 'EF' }] }] }] }),
    );
    expect(rows.map((r) => r.handle)).toEqual(['b']);
  });
  it('should include call record speakers', () => {
    const rows = collectAffiliations(data({ callSpeakers: {}, calls: [{ id: 'acde-1', speakers: [{ handle: 'x', org: 'EF' }] }, { id: 'acde-2', speakers: [{ handle: 'X', org: 'Lido' }] }] }));
    expect(conflicts(rows)).toHaveLength(1);
  });
});

describe('seen comparison', () => {
  const rows = collectAffiliations(data({ callSpeakers: { a: { handle: 'A', org: 'EF' }, b: { handle: 'B', org: 'Lido' } } }));
  it('should pick new handles and changed affiliations only', () => {
    const seen = { a: affHash(rows[0]), b: 'stale' };
    expect(pickChanged(rows, seen).map((r) => r.handle)).toEqual(['B']);
    expect(pickChanged(rows, {}).map((r) => r.handle)).toEqual(['A', 'B']);
  });
  it('should record seen hashes except failed handles', () => {
    const next = nextSeen(rows, { old: 'h' }, ['b']);
    expect(next).toEqual({ old: 'h', a: affHash(rows[0]) });
    expect(pickChanged(rows, next).map((r) => r.handle)).toEqual(['B']);
  });
});

describe('speakerFactcheck', () => {
  const rows = collectAffiliations(data({ callSpeakers: { a: { handle: 'Aa', org: 'EF' }, b: { handle: 'Bb', org: 'Lido' }, c: { handle: 'Cc', org: 'Base' } } }));
  const profiles = { aa: { name: 'A', bio: 'now at @Paradigm, prev. EF' }, bb: { name: 'B', bio: '' } };
  it('should put label and bio in prompt, grade, and hold those without bio', () => {
    const ask = vi.fn(() => '[{"n":1,"grade":"contradiction","problem":"Paradigm 소속","quote":"now at @Paradigm"}]');
    const r = speakerFactcheck(rows, profiles, ask);
    const p = ask.mock.calls[0][0] as string;
    expect(p).toContain('@Aa');
    expect(p).toContain('소속 표기: EF');
    expect(p).toContain('now at @Paradigm');
    expect(r).toMatchObject({ checked: 1, held: 2 });
    expect(r.issues).toEqual([{ handle: 'Aa', grade: 'contradiction', problem: 'Paradigm 소속', quote: 'now at @Paradigm' }]);
  });
  it('should batch by 20 and continue after a failed batch, reporting failed handles', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ handle: `h${i}`, name: '', values: new Map([['EF', ['x']]]) }));
    const prof = Object.fromEntries(many.map((m) => [m.handle, { bio: 'bio' }]));
    const ask = vi.fn().mockReturnValueOnce('oops').mockReturnValueOnce('[{"n":1,"grade":"overreach"}]');
    const r = speakerFactcheck(many, prof, ask);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(r.failedHandles).toHaveLength(20);
    expect(r.failures).toHaveLength(1);
    expect(r.checked).toBe(5);
    expect(r.issues[0]).toMatchObject({ handle: 'h20', grade: 'overreach' });
  });
});
