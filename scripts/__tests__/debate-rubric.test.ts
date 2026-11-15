import { describe, it, expect } from 'vitest';
import { codeScores, urlHandle, grade } from '../lib/debate-rubric';

const base = {
  id: 'x',
  title: 't',
  summary: 's',
  keyPoints: ['k'],
  positions: [
    { stance: 'pro' as const, label: 'A', holders: [{ handle: 'alice', name: 'Alice' }], points: ['p'] },
    { stance: 'con' as const, label: 'B', holders: [{ handle: 'bob', name: 'Bob' }], points: ['p'] },
  ],
};
const tweet = (by: string, author: string, stance: 'pro' | 'con', extra = {}) => ({
  date: '2026-11-11', by, stance, quote: 'q', url: `https://x.com/${author}/status/1`, original: 'o', ...extra,
});

describe('debate-rubric', () => {
  it('should give full code score to a real two-sided exchange', () => {
    const { scores, problems } = codeScores({
      ...base,
      timeline: [tweet('alice', 'alice', 'pro'), tweet('bob', 'bob', 'con', { replyTo: 'alice', relation: 'reply' })],
    });
    expect(Object.values(scores).reduce((a, b) => a + b, 0)).toBe(40);
    expect(problems).toEqual([]);
  });

  it('should flag misattributed quotes and one-sided timelines', () => {
    const { scores, problems } = codeScores({ ...base, timeline: [tweet('alice', 'carol', 'pro')] });
    expect(scores.attribution).toBe(0);
    expect(scores.bothSides).toBe(0);
    expect(scores.exchange).toBe(0);
    expect(problems.join()).toContain('URL 작성자=carol');
  });

  it('should match names as well as handles and handle empty timeline', () => {
    expect(codeScores({ ...base, timeline: [tweet('Alice', 'alice', 'pro')] }).scores.stanceLink).toBe(10);
    expect(codeScores({ ...base, timeline: [] }).scores.attribution).toBe(0);
    expect(urlHandle('https://x.com/Nero_ETH/status/12')).toBe('nero_eth');
    expect(grade(85)).toBe('좋음');
    expect(grade(69)).toBe('다시 정리');
  });
});
