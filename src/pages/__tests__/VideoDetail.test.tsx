import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import VideoDetail from '../VideoDetail';
import { renderWithProviders } from '../../test/helpers/render';

const renderAt = (route: string) =>
    renderWithProviders(
        <Routes>
            <Route path="/contents/videos/:videoId" element={<VideoDetail />} />
        </Routes>,
        { route },
    );

describe('VideoDetail', () => {
    it('should show the session summary with chapters and YouTube links', async () => {
        renderAt('/contents/videos/wr6JU4-7M7A');

        expect(screen.getByRole('heading', { level: 1, name: '글램스터담 업그레이드에 담긴 것' })).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: /YouTube/ })[0]).toHaveAttribute('href', 'https://www.youtube.com/watch?v=wr6JU4-7M7A');
        expect(screen.getByRole('heading', { name: '연사' })).toBeInTheDocument();
        expect(screen.getByText('Hudson Jang', { selector: 'b' })).toBeInTheDocument();

        await waitFor(() => expect(screen.getByRole('heading', { name: '핵심 요약' })).toBeInTheDocument());
        const chapter = screen.getByRole('link', { name: /푸사카에서 글램스테르담으로/ });
        expect(chapter).toHaveAttribute('href', '/contents/videos/wr6JU4-7M7A?t=76');
    });

    it('should embed the player and start at ?t=', () => {
        renderAt('/contents/videos/wr6JU4-7M7A?t=76');
        expect(screen.getByTitle('글램스터담 업그레이드에 담긴 것')).toHaveAttribute(
            'src',
            'https://www.youtube-nocookie.com/embed/wr6JU4-7M7A?start=76&autoplay=1',
        );
    });

    it('should embed the player from the start without autoplay', () => {
        renderAt('/contents/videos/wr6JU4-7M7A');
        expect(screen.getByTitle('글램스터담 업그레이드에 담긴 것')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/wr6JU4-7M7A');
    });

    it('should link Day 2 videos to the event page', async () => {
        renderAt('/contents/videos/wr6JU4-7M7A');
        expect(screen.getByRole('link', { name: /EK1 Genesis/ })).toHaveAttribute('href', '/events/ek1-genesis');
    });

    it('should show not found for an unknown video', () => {
        renderAt('/contents/videos/nope');
        expect(screen.getByText('영상을 찾을 수 없습니다')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /영상 목록/ })).toHaveAttribute('href', '/contents?category=Video');
    });
});
