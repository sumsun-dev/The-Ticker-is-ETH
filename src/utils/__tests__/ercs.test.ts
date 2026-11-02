import { describe, expect, it } from 'vitest';
import { baseStandards, dependentsOf, digestMentions, matchErc, sortErcs, standardHref, statusCounts } from '../ercs';
import type { ErcIndexEntry, ErcRecord } from '../../data/ercsData';
import type { EthDigest } from '../../data/ethNewsData';

const e = (number: number, status: string, requires: number[] = []): ErcIndexEntry => ({ number, title: `T${number}`, status, created: '', requires });
const index = [e(20, 'Final'), e(165, 'Final'), e(721, 'Final', [165]), e(2612, 'Final', [20, 712]), e(4626, 'Final', [20, 2612]), e(7579, 'Draft', [165])];
const rec = (number: number, status: string, extra: Partial<ErcRecord> = {}) =>
    ({ number, titleKo: `제목${number}`, topic: '토큰', summary: '', meta: { title: `Title ${number}`, status }, ...extra }) as unknown as ErcRecord;

describe('ercs utils', () => {
    it('statusCounts·dependentsOf·baseStandards', () => {
        expect(statusCounts(index)).toEqual({ Final: 5, Draft: 1 });
        expect(dependentsOf(index, 20).map((x) => x.number)).toEqual([2612, 4626]);
        expect(baseStandards(index, 3)).toEqual([
            { number: 20, count: 2 },
            { number: 165, count: 2 },
            { number: 712, count: 1 },
        ]);
    });

    it('sortErcs: Final 먼저, 많이 기대는 것 먼저', () => {
        expect(sortErcs([rec(7579, 'Draft'), rec(2612, 'Final'), rec(20, 'Final')], index).map((r) => r.number)).toEqual([20, 2612, 7579]);
    });

    it('matchErc: 번호(ERC- 접두 포함)·이름·분야', () => {
        const r = rec(2612, 'Final', { titleKo: '서명으로 토큰 승인' });
        expect([matchErc(r, { query: 'ERC-26', topic: null }), matchErc(r, { query: '승인', topic: null }), matchErc(r, { query: '', topic: '토큰' })]).toEqual([true, true, true]);
        expect([matchErc(r, { query: '721', topic: null }), matchErc(r, { query: '', topic: '계정·지갑' })]).toEqual([false, false]);
    });

    it('digestMentions: 번호가 정확히 맞는 다이제스트 항목, 최신 순', () => {
        const d = (date: string, title: string) => ({ date, title: '', intro: '', sections: [{ heading: '', items: [{ title, summary: '', url: '', source: '', date }] }] }) as EthDigest;
        const out = digestMentions([d('2026-10-01', 'ERC-20 소식'), d('2026-10-05', 'EIP-20 재조명'), d('2026-10-06', 'ERC-2000 다른 번호')], 20);
        expect(out).toEqual([
            { date: '2026-10-05', title: 'EIP-20 재조명' },
            { date: '2026-10-01', title: 'ERC-20 소식' },
        ]);
    });

    it('standardHref: 해설이 있으면 사이트 안, 없으면 ERC·EIP 원문', () => {
        const has = { eips: new Set([8141]), ercs: new Set([20]), ercIndex: new Set([20, 721]) };
        expect(standardHref(20, has)).toEqual({ href: '/ercs/20', internal: true, label: 'ERC-20' });
        expect(standardHref(8141, has)).toEqual({ href: '/eips/8141', internal: true, label: 'EIP-8141' });
        expect(standardHref(721, has)).toEqual({ href: 'https://ercs.ethereum.org/ERCS/erc-721', internal: false, label: 'ERC-721' });
        expect(standardHref(712, has)).toEqual({ href: 'https://eips.ethereum.org/EIPS/eip-712', internal: false, label: 'EIP-712' });
    });
});
