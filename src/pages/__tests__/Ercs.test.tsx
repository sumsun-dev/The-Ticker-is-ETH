import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import Ercs from '../Ercs';
import ErcDetail from '../ErcDetail';
import { renderWithProviders } from '../../test/helpers/render';

const { rec } = vi.hoisted(() => ({
    rec: (number: number, titleKo: string, requires: number[] = []) => ({
        number,
        titleKo,
        topic: '토큰',
        summary: `${titleKo} 요약`,
        why: '이유',
        before: ['전'],
        after: ['후'],
        impact: [{ who: '사용자', text: '영향' }],
        iface: [{ sig: 'function permit(address owner) external', ko: '승인합니다' }],
        flow: { title: '서명 흐름', steps: [{ label: '사용자', title: '서명', body: '서명합니다' }, { label: '앱', title: '호출', body: '호출합니다' }] },
        deep: [{ title: '서명 구조', body: '심층', ref: '원문: Specification' }],
        safety: [{ title: '0 주소 확인', body: '확인해야 합니다' }],
        glossary: [],
        meta: { title: `Title ${number}`, description: '', status: 'Final', type: 'Standards Track', category: 'ERC', created: '2020-04-13', authors: ['Martin Lundfall'], requires },
        sourceHash: 'h',
        model: 'fable',
        generatedAt: '2026-11-02T00:00:00Z',
    }),
}));

vi.mock('../../data/ercsData', async (orig) => ({
    ...(await orig<typeof import('../../data/ercsData')>()),
    loadErcList: vi.fn().mockImplementation(async () => ({ updatedAt: '', ercs: [rec(20, '토큰 표준'), rec(2612, '서명으로 토큰 승인', [20, 712])] })),
    loadErcs: vi.fn().mockImplementation(async () => ({ updatedAt: '', ercs: [rec(20, '토큰 표준'), rec(2612, '서명으로 토큰 승인', [20, 712])] })),
    loadErcIndex: vi.fn().mockResolvedValue({
        updatedAt: '',
        ercs: [
            { number: 20, title: 'Token Standard', status: 'Final', created: '', requires: [] },
            { number: 2612, title: 'Permit', status: 'Final', created: '', requires: [20, 712] },
            { number: 4626, title: 'Tokenized Vaults', status: 'Final', created: '', requires: [20, 2612] },
            { number: 9000, title: 'Draft one', status: 'Draft', created: '', requires: [] },
        ],
    }),
}));
vi.mock('../../data/eipsData', async (orig) => ({ ...(await orig<typeof import('../../data/eipsData')>()), loadEipList: vi.fn().mockResolvedValue({ eips: [] }) }));
vi.mock('../../data/ethNewsData', () => ({ loadEthDigests: vi.fn().mockResolvedValue([{ date: '2026-10-05', title: '', intro: '', sections: [{ heading: '', items: [{ title: 'ERC-2612 permit 피싱 주의', summary: '', url: '', source: '', date: '' }] }] }]) }));
vi.mock('../../data/ethDebatesData', () => ({ loadEthDebateList: vi.fn().mockResolvedValue([]) }));

const at = (path: string) =>
    renderWithProviders(
        <Routes>
            <Route path="/ercs" element={<Ercs />} />
            <Route path="/ercs/:number" element={<ErcDetail />} />
        </Routes>,
        { route: path },
    );

describe('Ercs', () => {
    it('EIP·ERC 탭, 상태별 수, 기반 표준, Final·많이 기대는 순 목록', async () => {
        at('/ercs');
        const cards = await screen.findAllByRole('link', { name: /요약/ });
        expect(cards.map((a) => a.getAttribute('href'))).toEqual(['/ercs/20', '/ercs/2612']);
        expect(screen.getByRole('tab', { name: 'ERC · 앱 표준' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'EIP · 프로토콜 변경' })).toHaveAttribute('href', '/eips');
        expect(screen.getByText('확정된 표준. 더는 바뀌지 않습니다')).toBeInTheDocument();
        expect(screen.getByText('이 표준에 기대는 ERC 2개')).toBeInTheDocument();
    });
});

describe('ErcDetail', () => {
    it('구현할 함수, 흐름, 주의할 점, 족보, ECK 뉴스', async () => {
        at('/ercs/2612');
        expect(await screen.findByRole('heading', { level: 1, name: /서명으로 토큰 승인/ })).toBeInTheDocument();
        expect(screen.getByText('function permit(address owner) external')).toBeInTheDocument();
        expect(screen.getByText('0 주소 확인')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /ERC-20/ })).toHaveAttribute('href', '/ercs/20');
        expect(screen.getByRole('link', { name: /EIP-712/ })).toHaveAttribute('href', 'https://eips.ethereum.org/EIPS/eip-712');
        expect(screen.getByText('이 표준에 기대는 ERC 1개')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /permit 피싱 주의/ })).toHaveAttribute('href', '/news?date=2026-10-05');
    });
});
