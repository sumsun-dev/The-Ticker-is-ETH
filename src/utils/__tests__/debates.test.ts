import { describe, it, expect } from 'vitest';
import { initialsOf, avatarColorOf, shortDate, countByStatus, countByCategory, relatedDigestDates, entriesOf, isPublishable, participantCount } from '../debates';

describe('debates utils', () => {
    it('should build initials from handle first, then name, with a single char for Korean names', () => {
        expect(initialsOf({ handle: 'ryanberckmans', name: '⟠' })).toBe('RY');
        expect(initialsOf({ name: '저스틴 본스' })).toBe('저');
        expect(initialsOf({ name: '' })).toBe('?');
    });

    it('should pick a stable color per key regardless of case', () => {
        expect(avatarColorOf('binji_x')).toBe(avatarColorOf('BINJI_X'));
        expect(avatarColorOf('a')).toMatch(/^bg-/);
    });

    it('should format short dates and count statuses/categories', () => {
        expect(shortDate('2026-09-05')).toBe('09.05');
        const debates = [
            { status: 'active', category: '규제' },
            { status: 'active', category: '프로토콜 설계' },
            { status: 'cooling', category: '규제' },
        ] as const;
        expect(countByStatus(debates)).toEqual({ active: 2, cooling: 1, resolved: 0, archived: 0 });
        expect(countByCategory(debates)).toEqual([
            { category: '규제', count: 2 },
            { category: '프로토콜 설계', count: 1 },
        ]);
    });

    it('should find a holder\'s entries by handle or name, case-insensitively', () => {
        const timeline = [
            { date: '2026-09-02', by: 'StaniKulechov', quote: 'a', url: 'https://x.com/s/status/1' },
            { date: '2026-09-03', by: '저스틴 본스', quote: 'b', url: 'https://x.com/j/status/2' },
            { date: '2026-09-04', by: 'stanikulechov', quote: 'c', url: 'https://x.com/s/status/3' },
        ];
        expect(entriesOf({ timeline }, { handle: 'StaniKulechov', name: 'Stani' }).map((e) => e.quote)).toEqual(['a', 'c']);
        expect(entriesOf({ timeline }, { name: '저스틴 본스' }).map((e) => e.quote)).toEqual(['b']);
    });

    it('should publish only debates with at least 10 participants', () => {
        const holders = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `p${i}` }));
        const small = { positions: [{ stance: 'pro', label: '', holders: holders(4), points: [] }, { stance: 'con', label: '', holders: holders(5), points: [] }] } as const;
        const big = { positions: [{ stance: 'pro', label: '', holders: holders(6), points: [] }, { stance: 'con', label: '', holders: holders(4), points: [] }] } as const;
        expect(participantCount(small)).toBe(9);
        expect(isPublishable(small)).toBe(false);
        expect(isPublishable(big)).toBe(true);
    });

    it('should list related digest dates newest first without duplicates', () => {
        const timeline = [
            { date: '2026-09-02', by: 'a', quote: '', url: 'https://x.com/a/status/1', digest: '2026-09-02' },
            { date: '2026-09-05', by: 'a', quote: '', url: 'https://x.com/a/status/2', digest: '2026-09-05' },
            { date: '2026-09-05', by: 'b', quote: '', url: 'https://x.com/b/status/3', digest: '2026-09-05' },
            { date: '2026-09-06', by: 'b', quote: '', url: 'https://x.com/b/status/4' },
        ];
        expect(relatedDigestDates({ timeline })).toEqual(['2026-09-05', '2026-09-02']);
    });
});
