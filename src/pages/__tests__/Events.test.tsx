import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import Events from '../Events';
import EventGenesis from '../EventGenesis';
import { renderWithProviders } from '../../test/helpers/render';
import i18n from '../../i18n';
import { GENESIS_PHOTOS, GENESIS_SESSIONS, sessionsOf } from '../../data/ek1GenesisData';

vi.mock('../../data/ek1GenesisData', async () => {
    const actual = await vi.importActual<typeof import('../../data/ek1GenesisData')>('../../data/ek1GenesisData');
    return {
        ...actual,
        loadTranscripts: vi.fn().mockResolvedValue({
            'd1-01': {
                toc: ['16:15 시작'],
                body: '<h4 id="d1-01-s1">16:15 시작</h4><p><b class="who">사회자</b>전문 본문입니다.<img src=x onerror="alert(1)"></p>',
                notes: [{ n: 1, kind: '교정', html: '각주 내용' }],
                chars: 10,
            },
        }),
    };
});

beforeAll(async () => {
    await i18n.changeLanguage('ko');
});

describe('Events', () => {
    it('should link the latest event to its record page', () => {
        renderWithProviders(<Events />);
        const links = screen.getAllByRole('link', { name: /행사 기록 보기/ });
        expect(links[0]).toHaveAttribute('href', '/events/ek1-genesis');
    });

    it('should not list the September event as upcoming', () => {
        renderWithProviders(<Events />);
        expect(screen.getByText('다음 행사를 준비하고 있습니다')).toBeInTheDocument();
        expect(screen.queryByText('Ethereum Korea Week')).not.toBeInTheDocument();
    });

    it('should group past events by year', () => {
        renderWithProviders(<Events />);
        for (const year of ['2026', '2024', '2023', '2020', '2019']) expect(screen.getByText(year)).toBeInTheDocument();
    });
});

describe('EventGenesis data', () => {
    it('should give every session a photo set and a known track', () => {
        for (const s of GENESIS_SESSIONS) {
            expect(['d1', '2f', '3f', '4f']).toContain(s.track);
            expect(GENESIS_PHOTOS[s.id]?.length ?? 0).toBeGreaterThan(0);
        }
    });

    it('should keep 14 Day 1 sessions and 16 Day 2 stage sessions', () => {
        expect(sessionsOf('d1')).toHaveLength(14);
        expect(sessionsOf('2f').length + sessionsOf('3f').length).toBe(16);
        expect(sessionsOf('4f')).toHaveLength(4);
    });
});

describe('EventGenesis', () => {
    it('should show Day 1 sessions first and switch to Day 2 floors', () => {
        renderWithProviders(<EventGenesis />);
        expect(screen.getByText(sessionsOf('d1')[0].title)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: /Day 2/ }));
        expect(screen.getByText(sessionsOf('2f')[0].title)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '3F 영어 세션' }));
        expect(screen.getByText(sessionsOf('3f')[0].title)).toBeInTheDocument();
    });

    it('should cap visible photos and open the lightbox with the full set', () => {
        renderWithProviders(<EventGenesis />);
        const big = sessionsOf('d1').find((s) => GENESIS_PHOTOS[s.id].length > 6)!;
        const total = GENESIS_PHOTOS[big.id].length;
        fireEvent.click(screen.getByRole('button', { name: `사진 ${total}장 모두 보기` }));
        const dialog = screen.getByRole('dialog', { name: big.title });
        expect(within(dialog).getByText(`6 / ${total}`)).toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(within(dialog).getByText(`7 / ${total}`)).toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should load the transcript on demand and strip unsafe markup', async () => {
        renderWithProviders(<EventGenesis />);
        fireEvent.click(screen.getAllByRole('button', { name: /전문 읽기/ })[0]);
        const dialog = await screen.findByRole('dialog', { name: /전문/ });
        await waitFor(() => expect(within(dialog).getByText('전문 본문입니다.')).toBeInTheDocument());
        expect(within(dialog).getByText('각주 내용')).toBeInTheDocument();
        expect(dialog.querySelector('img[onerror]')).toBeNull();
    });
});
