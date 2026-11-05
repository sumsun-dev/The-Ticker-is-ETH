import { describe, expect, it } from 'vitest';
import { forkEipStatuses } from '../forks';
import { FORKS, forkBySlug } from '../../data/forks';
import { ROADMAP_ITEMS, roadmapGrid, STRAWMAP_FORKS } from '../../data/roadmap';

const d = (fork: string, status: string, eips: number[]) => ({ label: '', text: '', original: '', fork, status, eips });
const call = (id: string, date: string, decisions: ReturnType<typeof d>[]) => ({ id, date, kind: 'full' as const, decisions }) as never;

describe('forkEipStatuses', () => {
    it('포크별 최신 결정, 확정=SFI, 메타 EIP 제외, 확정 목록 채움, SFI 먼저', () => {
        const calls = [
            call('a', '2026-08-01', [d('Hegota', 'PFI', [1, 2, 3, 8081]), d('Glamsterdam', 'SFI', [9])]),
            call('b', '2026-09-01', [d('Hegota', 'CFI', [1]), d('Hegota', '확정', [2]), d('Hegota', 'DFI', [3])]),
        ];
        const out = forkEipStatuses(calls, { callFork: 'Hegota', meta: 8081, eips: [{ number: 4, note: '' }] });
        expect(out.map((x) => `${x.number}:${x.status}`)).toEqual(['2:SFI', '4:SFI', '1:CFI', '3:DFI']);
        expect(out[0].callId).toBe('b');
    });
});

describe('forks·roadmap 데이터', () => {
    it('슬러그가 겹치지 않고, 지난 포크는 날짜 내림차순', () => {
        expect(new Set(FORKS.map((f) => f.slug)).size).toBe(FORKS.length);
        const past = FORKS.filter((f) => f.date).map((f) => f.date as string);
        expect(past).toEqual([...past].sort().reverse());
        expect(forkBySlug('glamsterdam')?.eips).toHaveLength(18);
    });

    it('로드맵 항목은 모두 지도 칸에 들어간다', () => {
        const grid = roadmapGrid();
        const placed = [...grid.cl, ...grid.dl, ...grid.el].flat().length;
        expect(placed).toBe(ROADMAP_ITEMS.length);
        expect(ROADMAP_ITEMS.every((x) => x.fork >= 0 && x.fork < STRAWMAP_FORKS.length)).toBe(true);
    });
});
