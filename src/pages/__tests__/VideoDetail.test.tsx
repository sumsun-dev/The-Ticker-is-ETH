import { describe, it, expect, afterEach } from 'vitest';
import i18n from '../../i18n';
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
    afterEach(async () => {
        await i18n.changeLanguage('ko');
    });

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

    it('should show the English version on the English site', async () => {
        await i18n.changeLanguage('en');
        renderAt('/contents/videos/wr6JU4-7M7A');

        expect(screen.getByRole('heading', { level: 1, name: "What's in the Glamsterdam Upgrade" })).toBeInTheDocument();
        expect(screen.getByText('In Korean')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Key takeaways' })).toBeInTheDocument());
        expect(screen.queryByText(/글램스테르담/)).not.toBeInTheDocument();
    });

    it('should show the Korean version of an English-spoken session on the Korean site', async () => {
        renderAt('/contents/videos/i6jbGYiQVEo');
        expect(screen.getByRole('heading', { level: 1, name: '개회사' })).toBeInTheDocument();
        expect(screen.getByText('영어 진행')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('heading', { name: '핵심 요약' })).toBeInTheDocument());
        expect(screen.queryByText(/An opening conversation/)).not.toBeInTheDocument();
    });

    it('should show not found for an unknown video', () => {
        renderAt('/contents/videos/nope');
        expect(screen.getByText('영상을 찾을 수 없습니다')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /영상 목록/ })).toHaveAttribute('href', '/contents?category=Video');
    });
});
