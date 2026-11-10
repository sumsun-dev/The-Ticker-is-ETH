import { describe, it, expect } from 'vitest';
import full from '../eth-calls.json';
import { sliceCalls, sliceList } from '../../../vite-json-slice';

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
