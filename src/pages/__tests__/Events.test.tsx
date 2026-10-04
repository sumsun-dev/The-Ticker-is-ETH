import { describe, it, expect, beforeAll } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import Events from '../Events';
import EventGenesis from '../EventGenesis';
import { renderWithProviders } from '../../test/helpers/render';
import i18n from '../../i18n';
import { GENESIS_FEATURED, GENESIS_PHOTOS, GENESIS_SESSIONS, sessionsOf } from '../../data/ek1GenesisData';
import { layoutRows } from '../../utils/justify';

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
            expect(['2f', '3f', '4f']).toContain(s.track);
            expect(GENESIS_PHOTOS[s.id]?.length ?? 0).toBeGreaterThan(0);
        }
    });

    it('should pick featured shots for every photo set', () => {
        for (const [set, list] of Object.entries(GENESIS_PHOTOS)) {
            expect(GENESIS_FEATURED[set]).toBeGreaterThan(0);
            expect(GENESIS_FEATURED[set]).toBeLessThanOrEqual(list.length);
        }
    });

    it('should hold only Day 2: 16 stage sessions and 4 roundtables, no Day 1 photos', () => {
        expect(Object.keys(GENESIS_PHOTOS).some((k) => k.startsWith('d1-') || k.startsWith('net-d1'))).toBe(false);
        expect(sessionsOf('2f').length + sessionsOf('3f').length).toBe(16);
        expect(sessionsOf('4f')).toHaveLength(4);
    });
});

describe('EventGenesis', () => {
    it('should open on the 2F stage and switch floors', () => {
        renderWithProviders(<EventGenesis />);
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
        expect(screen.getByText(sessionsOf('2f')[0].title)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '3F 영어 세션' }));
        expect(screen.getByText(sessionsOf('3f')[0].title)).toBeInTheDocument();
    });

    it('should show a lead and two side shots, then open the full set in the lightbox', () => {
        renderWithProviders(<EventGenesis />);
        const big = sessionsOf('2f').find((s) => GENESIS_PHOTOS[s.id].length > 4)!;
        const total = GENESIS_PHOTOS[big.id].length;
        fireEvent.click(screen.getByRole('button', { name: `사진 ${total}장 모두 보기` }));
        const dialog = screen.getByRole('dialog', { name: big.title });
        expect(within(dialog).getByText(`3 / ${total}`)).toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(within(dialog).getByText(`4 / ${total}`)).toBeInTheDocument();
        const stage = dialog.querySelector('img')!.parentElement!;
        fireEvent.touchStart(stage, { touches: [{ clientX: 200 }] });
        fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 80 }] });
        expect(within(dialog).getByText(`5 / ${total}`)).toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should mark summaries and transcripts as coming later, not for roundtables', () => {
        renderWithProviders(<EventGenesis />);
        expect(screen.getAllByText('요약과 전문은 추후 제공 예정입니다')).toHaveLength(sessionsOf('2f').length);
        expect(screen.queryByRole('button', { name: /전문 읽기/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '4F 라운드테이블' }));
        expect(screen.queryByText('요약과 전문은 추후 제공 예정입니다')).not.toBeInTheDocument();
    });
});

describe('layoutRows', () => {
    it('should fill each full row to the container width', () => {
        const rows = layoutRows([1.5, 1.5, 1.5, 1.5, 1.5, 1.5], 600, 160, 3);
        const first = rows[0];
        expect(first.count * 1.5 * first.height + 6 * (first.count - 1)).toBeCloseTo(600, 5);
    });

    it('should not stretch a short last row and should stop at maxRows', () => {
        expect(layoutRows([1.5], 600, 160, 2)).toEqual([{ count: 1, height: 160 }]);
        expect(layoutRows(Array(40).fill(1.5), 600, 160, 2)).toHaveLength(2);
    });

    it('should return no rows for empty input', () => {
        expect(layoutRows([], 600, 160, 2)).toEqual([]);
    });
});
