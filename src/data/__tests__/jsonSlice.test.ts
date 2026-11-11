import { describe, it, expect } from 'vitest';
import full from '../eth-calls.json';
import { sliceCalls, sliceList, sliceDebates, sliceDigests } from '../../../vite-json-slice';
import type { Debate } from '../ethDebatesData';
import { isPublishable } from '../../utils/debates';
import { debatesFor } from '../../utils/eips';

type Calls = { calls: Array<{ id: string; topics: Array<{ title: string; positions: unknown[] }>; chat: unknown[]; decisions: unknown[] }> };

describe('vite-json-slice sliceCalls', () => {
    it('should keep every call, decision and topic title but drop remarks and chat', () => {
        const f = full as unknown as Calls;
        const l = sliceCalls(f as never) as unknown as Calls;
        expect(l.calls.map((c) => c.id)).toEqual(f.calls.map((c) => c.id));
        l.calls.forEach((c, i) => {
            expect(c.decisions).toEqual(f.calls[i].decisions);
            expect(c.topics.map((t) => t.title)).toEqual(f.calls[i].topics.map((t) => t.title));
            expect(c.topics.every((t) => t.positions.length === 0)).toBe(true);
            expect(c.chat).toEqual([]);
        });
        expect(JSON.stringify(l).length).toBeLessThan(JSON.stringify(f).length / 2);
    });
});

describe('vite-json-slice sliceList', () => {
    it('should keep only list fields for every record', () => {
        const out = sliceList({ updatedAt: 'x', eips: [{ number: 1, titleKo: 'a', topic: 't', summary: 's', meta: { status: 'Final' }, deep: 'long' }] });
        expect(out).toEqual({ updatedAt: 'x', eips: [{ number: 1, titleKo: 'a', topic: 't', summary: 's', meta: { status: 'Final' } }] });
    });
});

describe('sliceDebates / sliceDigests', () => {
  it('should keep what the debate list and EIP/ERC pages read, and shrink the file', async () => {
    const full = (await import('../eth-debates.json')).default as unknown as { debates: Debate[] };
    const slim = sliceDebates(full as never) as unknown as { debates: Debate[] };
    const pick = (ds: Debate[]) => ds.filter(isPublishable).map((d) => [d.id, d.title, d.summary, d.status, d.positions.map((p) => p.holders.length), d.timeline.length]);
    expect(pick(slim.debates)).toEqual(pick(full.debates));
    expect(debatesFor(slim.debates, 8141).map((d) => d.id)).toEqual(debatesFor(full.debates, 8141).map((d) => d.id));
    expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(full).length / 4);
  });

  it('should keep sections only for the latest digest', async () => {
    const full = (await import('../eth-digests.json')).default as { digests: Array<{ date: string; sections: unknown[] }> };
    const slim = sliceDigests(full) as typeof full;
    expect(slim.digests.map((d) => d.date)).toEqual(full.digests.map((d) => d.date));
    expect(slim.digests[0].sections.length).toBeGreaterThan(0);
    expect(slim.digests.slice(1).every((d) => d.sections.length === 0)).toBe(true);
  });
});
