import { describe, expect, it } from 'vitest';
import { debatesFor, inclusionLabel, inclusionOf, journeyOf, matchEip, sortByRecent } from '../eips';
import type { CallRecord } from '../../data/ethCallsData';
import type { Debate } from '../../data/ethDebatesData';
import type { EipRecord } from '../../data/eipsData';

const dec = (eips: number[], status: string, text: string, original = '', fork?: string) => ({ label: '', text, original, eips, status, fork }) as CallRecord['decisions'][number];
const call = (id: string, date: string, eips: number[], decisions: CallRecord['decisions'], kind = 'full') =>
    ({ id, series: id.split('-')[0], number: Number(id.split('-')[1]), date, kind, eips, decisions }) as unknown as CallRecord;

const calls = [
    call('acde-245', '2026-09-10', [8141], [dec([8141], '확정', '헤드라이너로 공식화', 'EIP-8141 confirmed as Hegota headliner', 'Hegota')]),
    call('acde-243', '2026-08-13', [8141, 8130], []),
    call('acde-244', '2026-08-27', [8141], [dec([8141], 'SFI', 'SFI로 올림', 'Frames SFI', 'Hegota'), dec([7609], 'DFI', '제외', '', 'Hegota')]),
    call('ama-15', '2026-09-16', [8141], [], 'record'),
];

describe('eips utils', () => {
    it('inclusionOf: 가장 최근 포함 결정과 헤드라이너 여부', () => {
        expect(inclusionOf(calls, 8141)).toEqual({ status: 'SFI', fork: 'Hegota', date: '2026-08-27', callId: 'acde-244', headliner: true });
        expect(inclusionOf(calls, 7609)).toMatchObject({ status: 'DFI', headliner: false });
        expect(inclusionOf(calls, 8130)).toBeUndefined();
    });

    it('journeyOf: 정리된 콜만 날짜순, 결정이 없으면 논의만', () => {
        expect(journeyOf(calls, 8141).map((j) => [j.date, j.call, j.status ?? '-', j.text ?? '-'])).toEqual([
            ['2026-08-13', 'ACDE #243', '-', '-'],
            ['2026-08-27', 'ACDE #244', 'SFI', 'SFI로 올림'],
            ['2026-09-10', 'ACDE #245', '확정', '헤드라이너로 공식화'],
        ]);
    });

    it('debatesFor: 노출되는 논쟁 중 번호가 정확히 맞는 것', () => {
        const d = (id: string, title: string, publish?: boolean) => ({ id, title, summary: '', lastActivity: '2026-10-01', holders: [], publish }) as unknown as Debate;
        const out = debatesFor([d('a', 'EIP-8141 논쟁', true), d('b', 'EIP-81410 다른 번호', true), d('c', 'EIP-8141 숨김', false)], 8141);
        expect(out.map((x) => x.id)).toEqual(['a']);
    });

    it('matchEip: 번호·제목·주제·포크', () => {
        const r = { number: 8141, titleKo: '프레임 트랜잭션', topic: '계정 추상화', summary: '', meta: { title: 'Frame Transaction' } } as unknown as EipRecord;
        const inc = inclusionOf(calls, 8141);
        const f = (query: string, topic: string | null = null, fork: string | null = null) => matchEip(r, inc, { query, topic, fork });
        expect([f('8141'), f('EIP-81'), f('프레임'), f('frame'), f('', '계정 추상화'), f('', null, 'Hegota')]).toEqual([true, true, true, true, true, true]);
        expect([f('7702'), f('', '수수료·가스'), f('', null, 'Glamsterdam')]).toEqual([false, false, false]);
    });

    it('sortByRecent·inclusionLabel', () => {
        const rec = (number: number) => ({ number }) as EipRecord;
        const rows = sortByRecent([{ record: rec(1) }, { record: rec(2), last: { date: '2026-09-01', callId: '', call: '' } }, { record: rec(3) }]);
        expect(rows.map((x) => x.record.number)).toEqual([2, 3, 1]);
        expect(inclusionLabel(inclusionOf(calls, 8141), 'Draft')).toBe('Hegota 포함 확정 (SFI)');
        expect(inclusionLabel(undefined, 'Final')).toBe('최종 확정');
        expect(inclusionLabel(undefined, 'Draft')).toBe('콜 결정 없음');
    });
});
