import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import Eips from '../Eips';
import EipDetail from '../EipDetail';
import { renderWithProviders } from '../../test/helpers/render';
import type { EipRecord } from '../../data/eipsData';

const { record } = vi.hoisted(() => ({ record: (number: number, titleKo: string, topic: EipRecord['topic'], extra: Partial<EipRecord> = {}): EipRecord => ({
    number,
    titleKo,
    topic,
    summary: `${titleKo} 요약`,
    why: '지금은 서명 방식이 하나뿐입니다.',
    before: ['서명은 한 가지'],
    after: ['계정 코드가 검증'],
    impact: [{ who: '사용자', text: '수수료 대납을 쓸 수 있습니다.' }],
    example: { title: '수수료 대납 예', steps: [{ label: 'VERIFY', title: '본인 확인', body: '계정이 승인합니다.' }, { label: 'SENDER', title: '실행', body: '작업을 실행합니다.' }] },
    deep: [{ title: 'APPROVE 명령어', body: 'APPROVE(0xaa)가 승인 범위를 정합니다.', ref: '원문: APPROVE Instruction' }],
    glossary: [{ term: 'SFI', def: '포함 확정' }],
    related: [{ number: 7702, note: '먼저 적용된 위임' }],
    meta: { title: 'Frame Transaction', description: '', status: 'Draft', type: 'Standards Track', category: 'Core', created: '2026-01-29', authors: ['A', 'B', 'C', 'D', 'E', 'F'], requires: [1559] },
    sourceHash: 'h',
    model: 'fable',
    generatedAt: '2026-11-02T00:00:00Z',
    ...extra,
}) }));

const EIPS = () => ({ updatedAt: '', eips: [record(8141, '프레임 트랜잭션', '계정 추상화'), record(7702, '지갑 코드 위임', '계정 추상화'), record(8037, '상태 가스', '수수료·가스')] });
vi.mock('../../data/eipsData', async (orig) => ({
    ...(await orig<typeof import('../../data/eipsData')>()),
    loadEipList: vi.fn().mockImplementation(async () => EIPS()),
    loadEips: vi.fn().mockImplementation(async () => EIPS()),
}));

vi.mock('../../data/ethCallsData', () => ({
    loadEthCalls: vi.fn().mockResolvedValue({
        calls: [
            { id: 'acde-243', series: 'acde', number: 243, date: '2026-08-13', kind: 'full', eips: [8141], decisions: [] },
            { id: 'acde-244', series: 'acde', number: 244, date: '2026-08-27', kind: 'full', eips: [8141, 8037], decisions: [{ label: '', text: '헤고타 포함 확정', original: 'Frames SFI headliner', eips: [8141], status: 'SFI', fork: 'Hegota' }] },
        ],
    }),
}));

vi.mock('../../data/ethDebatesData', () => ({
    loadEthDebates: vi.fn().mockResolvedValue([{ id: 'aa', title: 'EIP-8141과 8130 논쟁', summary: '', lastActivity: '2026-09-01', publish: true, positions: [], timeline: [] }]),
}));

const at = (path: string) =>
    renderWithProviders(
        <Routes>
            <Route path="/eips" element={<Eips />} />
            <Route path="/eips/:number" element={<EipDetail />} />
        </Routes>,
        { route: path },
    );

describe('Eips', () => {
    it('안내·용어·목록을 보여 주고, 최근 콜에서 다룬 EIP가 먼저 온다', async () => {
        at('/eips');
        const links = await screen.findAllByRole('link', { name: /EIP-\d+/ });
        expect(screen.getByRole('heading', { name: 'EIP 하나가 메인넷에 들어가기까지' })).toBeInTheDocument();
        expect(links.map((a) => a.getAttribute('href'))).toEqual(['/eips/8141', '/eips/8037', '/eips/7702']);
        expect(within(links[0]).getByText(/Hegota 포함 확정 \(SFI\)/)).toBeInTheDocument();
    });

    it('주제·검색으로 거른다', async () => {
        at('/eips');
        await screen.findAllByRole('link', { name: /EIP-\d+/ });
        fireEvent.click(screen.getByRole('button', { name: '수수료·가스' }));
        expect(screen.getAllByRole('link', { name: /EIP-\d+/ }).map((a) => a.getAttribute('href'))).toEqual(['/eips/8037']);
        fireEvent.click(screen.getByRole('button', { name: '전체' }));
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: '7702' } });
        expect(screen.getAllByRole('link', { name: /EIP-\d+/ }).map((a) => a.getAttribute('href'))).toEqual(['/eips/7702']);
    });
});

describe('EipDetail', () => {
    it('쉬운 설명, 심층 설명, 콜 여정, 관련 논쟁, 기본 정보', async () => {
        at('/eips/8141');
        expect(await screen.findByRole('heading', { level: 1, name: /프레임 트랜잭션/ })).toBeInTheDocument();
        expect(screen.getByText('Hegota 헤드라이너')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '심층 설명' })).toBeInTheDocument();
        expect(screen.getByText('APPROVE 명령어')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'ACDE #244' })).toHaveAttribute('href', '/calls/acde-244');
        expect(screen.getByText('이 콜에서 논의됐습니다.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /EIP-8141과 8130 논쟁/ })).toHaveAttribute('href', '/debates/aa');
        expect(screen.getByText('A, B, C, D 외 2명')).toBeInTheDocument();
        // 관련 EIP: 해설이 있으면 사이트 안으로
        expect(screen.getByRole('link', { name: 'EIP-7702' })).toHaveAttribute('href', '/eips/7702');
        expect(screen.getByText(/AI가 쓰고 자동으로 게시했습니다/)).toBeInTheDocument();
    });

    it('해설이 없는 번호는 원문 링크를 준다', async () => {
        at('/eips/9999');
        expect(await screen.findByText('그런 EIP 해설을 찾을 수 없습니다.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /EIP 원문 보기/ })).toHaveAttribute('href', 'https://eips.ethereum.org/EIPS/eip-9999');
    });
});
