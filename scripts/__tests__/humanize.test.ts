import { describe, expect, it } from 'vitest';
import { guardRewrites, humanizeTexts, normalizeTerms } from '../lib/humanize';

const originals = ['글램스테르담이 세폴리아에서 활성화됐습니다.', 'ACDE #247에서 후디 포크 일정을 정했습니다.'];

describe('guardRewrites', () => {
  it('should take rewrites of similar length', () => {
    const rewrites = ['글램스테르담이 세폴리아에서 켜졌습니다.', 'ACDE #247이 후디 포크 일정을 정했습니다.'];
    expect(guardRewrites(originals, rewrites)).toEqual({ texts: rewrites, reverted: 0 });
  });

  it('should revert a sentence that changed more than half its length or came back empty', () => {
    const { texts, reverted } = guardRewrites(originals, ['짧음', '']);
    expect(texts).toEqual(originals);
    expect(reverted).toBe(2);
  });

  it('should keep all originals when the count does not match', () => {
    expect(guardRewrites(originals, ['하나만'])).toEqual({ texts: originals, reverted: 2 });
  });
});

describe('humanizeTexts', () => {
  it('should parse the model JSON and keep order', () => {
    const run = () => '```json\n{"texts": ["글램스테르담이 세폴리아에서 켜졌습니다.", "ACDE #247이 후디 포크 일정을 정했습니다."]}\n```';
    expect(humanizeTexts(originals, '테스트', run)).toEqual(['글램스테르담이 세폴리아에서 켜졌습니다.', 'ACDE #247이 후디 포크 일정을 정했습니다.']);
  });

  it('should fall back to originals when the model call fails', () => {
    const run = () => {
      throw new Error('out of usage');
    };
    expect(humanizeTexts(originals, '테스트', run)).toBe(originals);
  });

  it('should not call the model for an empty list', () => {
    const run = () => {
      throw new Error('should not be called');
    };
    expect(humanizeTexts([], '테스트', run)).toEqual([]);
  });
});

describe('normalizeTerms', () => {
  it('should unify the Glamsterdam spelling in every nested string', () => {
    const out = normalizeTerms({ title: '글램스터담 포크', items: [{ text: '후디 글램스터담, 글램스테르담' }], n: 1 });
    expect(out).toEqual({ title: '글램스테르담 포크', items: [{ text: '후디 글램스테르담, 글램스테르담' }], n: 1 });
  });
});
