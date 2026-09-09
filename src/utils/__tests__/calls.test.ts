import { describe, expect, it } from 'vitest';
import { callLabel, forksOf, groupByMonth, laterTargetUpdates, latestFullCalls, mentionsEip, nextCallEstimate, remarksOf, seriesInfo, speakerOf, splitDuration, videoAt } from '../calls';

describe('calls utils', () => {
    it('should label series and fall back to the slug for breakouts', () => {
        expect(callLabel({ series: 'acde', number: 244 })).toBe('ACDE #244');
        expect(seriesInfo('aa')).toMatchObject({ label: 'AA', name: 'Breakout' });
    });

    it('should group calls by month, newest first', () => {
        const groups = groupByMonth([{ date: '2026-08-13' }, { date: '2026-09-03' }, { date: '2026-08-27' }]);
        expect(groups.map((g) => g.month)).toEqual(['2026-09', '2026-08']);
        expect(groups[1].calls.map((c) => c.date)).toEqual(['2026-08-27', '2026-08-13']);
    });

    it('should build video links at a timestamp and split durations', () => {
        expect(videoAt('https://youtube.com/watch?v=x', '01:37:56')).toBe('https://youtube.com/watch?v=x&t=5876s');
        expect(videoAt('https://youtu.be/x', undefined)).toBe('https://youtu.be/x');
        expect(videoAt(undefined, '00:01:00')).toBeUndefined();
        expect(splitDuration(88)).toEqual({ h: 1, m: 28 });
    });

    it('should find speakers and their remarks across topics', () => {
        const call = {
            speakers: [{ label: 'Ben Adams', name: 'Ben Adams', org: 'Nethermind', share: 0.1 }],
            topics: [
                { title: 'A', intro: '', positions: [{ speaker: 'Ben Adams', text: 'a1' }, { speaker: 'nixo', text: 'n1' }] },
                { title: 'B', intro: '', positions: [{ speaker: 'Ben Adams', text: 'b1' }] },
            ],
        };
        expect(speakerOf(call, 'Ben Adams').org).toBe('Nethermind');
        expect(speakerOf(call, 'Chris - Base')).toEqual({ label: 'Chris - Base', name: 'Chris', share: 0 });
        expect(remarksOf(call, 'Ben Adams').map((r) => `${r.topic.title}:${r.position.text}`)).toEqual(['A:a1', 'B:b1']);
    });

    it('should list forks and match EIP queries', () => {
        const calls = [{ decisions: [{ fork: 'Hegota' }, { fork: undefined }], eips: [8141, 8037] }, { decisions: [{ fork: 'Glamsterdam' }, { fork: 'Hegota' }], eips: [] }] as never;
        expect(forksOf(calls)).toEqual(['Hegota', 'Glamsterdam']);
        expect(mentionsEip({ eips: [8141] }, 'EIP-8141')).toBe(true);
        expect(mentionsEip({ eips: [8141] }, '8037')).toBe(false);
        expect(mentionsEip({ eips: [8141] }, '')).toBe(false);
    });

    it('should link later target updates and estimate the next call', () => {
        const a = { id: 'acde-244', series: 'acde', number: 244, date: '2026-08-27', targets: [{ key: 'sepolia-fork', text: '9월 28일 제안' }] };
        const b = { id: 'acdc-186', series: 'acdc', number: 186, date: '2026-09-03', targets: [{ key: 'sepolia-fork', text: '10월 6일 확정' }] };
        expect(laterTargetUpdates(a, [a, b])['sepolia-fork']).toEqual({ callId: 'acdc-186', label: 'ACDC #186', text: '10월 6일 확정' });
        expect(nextCallEstimate([a, b], '2026-09-08')).toEqual({ label: 'ACDE #245', date: '2026-09-10' });
    });
});

describe('latestFullCalls', () => {
    it('should pick full main-series calls only, newest first', () => {
        const calls = [
            { series: 'acdt', kind: 'full', date: '2026-09-07' },
            { series: 'aa', kind: 'full', date: '2026-09-08' },
            { series: 'acde', kind: 'record', date: '2026-09-10' },
            { series: 'acdc', kind: 'full', date: '2026-09-03' },
        ] as const;
        expect(latestFullCalls(calls, 1).map((c) => c.date)).toEqual(['2026-09-07']);
        expect(latestFullCalls(calls).map((c) => c.series)).toEqual(['acdt', 'acdc']);
        expect(latestFullCalls([])).toEqual([]);
    });
});
