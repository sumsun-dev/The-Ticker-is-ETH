import { describe, expect, it } from 'vitest';
import { holderWarnings } from '../lib/eth-debates';

const debate = (holders: { handle?: string; watchlist?: boolean }[], by: string[]) => ({
  id: 'd1',
  title: '논쟁',
  positions: [{ holders }],
  timeline: by.map((b) => ({ by: b })),
});

describe('holderWarnings', () => {
  it('should warn for a holder with handle missing from timeline authors', () => {
    expect(holderWarnings([debate([{ handle: 'Gary_Rong' }, { handle: 'a' }], ['a'])])).toEqual(['논쟁 (d1): @Gary_Rong']);
  });
  it('should match case-insensitively and ignore @', () => {
    expect(holderWarnings([debate([{ handle: 'Gary_Rong' }], ['@gary_rong'])])).toEqual([]);
  });
  it('should skip watchlist false and holders without handle', () => {
    expect(holderWarnings([debate([{ handle: 'x', watchlist: false }, {}], ['y'])])).toEqual([]);
  });
  it('should not repeat the same holder across positions', () => {
    const d = { ...debate([{ handle: 'z' }], []), positions: [{ holders: [{ handle: 'z' }] }, { holders: [{ handle: 'Z' }] }] };
    expect(holderWarnings([d])).toHaveLength(1);
  });
});
