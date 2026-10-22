import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import Contents from '../Contents';
import { renderWithProviders } from '../../test/helpers/render';

vi.mock('../../data/researchData', () => ({
    loadContentsIndex: vi.fn().mockResolvedValue([
        {
            id: 'tg-1',
            title: '리서치 글 하나',
            summary: '요약',
            author: 'Sose',
            authorId: 'sose',
            authorAvatar: '/a.png',
            date: '2026-10-01',
            readTime: '3분',
            category: 'Research',
            thumbnailUrl: '',
        },
    ]),
}));

describe('Contents', () => {
    beforeEach(() => {
        sessionStorage.clear();
        localStorage.clear();
    });

    it('should show articles and no videos by default', async () => {
        renderWithProviders(<Contents />);
        await waitFor(() => expect(screen.getByText('리서치 글 하나')).toBeInTheDocument());
        expect(screen.queryByRole('heading', { name: /Day 1/ })).not.toBeInTheDocument();
    });

    it('should show Day 1 and Day 2 videos on the video tab', async () => {
        renderWithProviders(<Contents />);
        await waitFor(() => expect(screen.getByText('리서치 글 하나')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: '영상' }));

        expect(screen.queryByText('리서치 글 하나')).not.toBeInTheDocument();
        const day1 = screen.getByRole('region', { name: /Day 1/ });
        const day2 = screen.getByRole('region', { name: /Day 2/ });
        expect(within(day1).getAllByRole('link', { name: /세션 요약/ })).toHaveLength(14);
        expect(within(day2).getAllByRole('link', { name: /세션 요약/ })).toHaveLength(16);
    });

    it('should send video cards to YouTube', async () => {
        renderWithProviders(<Contents />);
        await waitFor(() => expect(screen.getByText('리서치 글 하나')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: '영상' }));

        const card = screen.getByRole('link', { name: /글램스터담 업그레이드에 담긴 것\s*\(YouTube/ });
        expect(card).toHaveAttribute('href', 'https://www.youtube.com/watch?v=wr6JU4-7M7A');
        expect(card).toHaveAttribute('target', '_blank');
    });

    it('should open the video tab from ?category=Video', async () => {
        renderWithProviders(<Contents />, { route: '/contents?category=Video' });
        await waitFor(() => expect(screen.getByRole('region', { name: /Day 2/ })).toBeInTheDocument());
        expect(screen.getByRole('button', { name: '영상' })).toHaveAttribute('aria-pressed', 'true');
    });
});

describe('Contents video search', () => {
    it('should show the empty state when no video matches', async () => {
        renderWithProviders(<Contents />, { route: '/contents?category=Video' });
        fireEvent.change(screen.getByRole('textbox'), { target: { value: '없는 영상 제목' } });
        await waitFor(() => expect(screen.queryByRole('region', { name: /Day 1/ })).not.toBeInTheDocument(), { timeout: 2000 });
        expect(screen.getByText(/검색 결과가 없습니다/)).toBeInTheDocument();
    });
});
