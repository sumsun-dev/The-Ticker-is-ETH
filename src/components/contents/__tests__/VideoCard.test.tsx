import { describe, it, expect, afterEach } from 'vitest';
import i18n from '../../../i18n';
import { screen } from '@testing-library/react';
import VideoCard from '../VideoCard';
import { renderWithProviders } from '../../../test/helpers/render';
import type { VideoItem } from '../../../data/videoData';

const video: VideoItem = {
    id: 'abc123',
    event: 'ek1-genesis',
    day: 2,
    date: '2026-09-29',
    duration: '10:00',
    uploadDate: '2026-10-20T02:33:38-07:00',
    seconds: 600,
    spokenLang: 'en',
    text: {
        ko: {
            title: '테스트 영상',
            summary: '요약',
            speakers: ['장재훈, 포필러스 SRE', '모더레이터: 장재혁, 써니사이드랩스 사업 총괄'],
        },
        en: {
            title: 'Test video',
            summary: 'Summary',
            speakers: ['Hudson Jang, SRE, Four Pillars', 'Moderator: Jay Jang, Head of Business, Sunnyside Labs'],
        },
    },
};

describe('VideoCard', () => {
    afterEach(async () => {
        await i18n.changeLanguage('ko');
    });

    it('should open the video on YouTube in a new tab', () => {
        renderWithProviders(<VideoCard video={video} />);
        const link = screen.getByRole('link', { name: /테스트 영상\s*\(YouTube/ });
        expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc123');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should link to the session summary page', () => {
        renderWithProviders(<VideoCard video={video} />);
        expect(screen.getByRole('link', { name: '테스트 영상 세션 요약' })).toHaveAttribute('href', '/contents/videos/abc123');
    });

    it('should list speaker names in the site language', () => {
        renderWithProviders(<VideoCard video={video} />);
        expect(screen.getByText('장재훈 · 장재혁')).toBeInTheDocument();
    });

    it('should show the spoken language', () => {
        renderWithProviders(<VideoCard video={video} />);
        expect(screen.getByText('영어 진행')).toBeInTheDocument();
    });

    it('should switch to the English title and speakers on the English site', async () => {
        await i18n.changeLanguage('en');
        renderWithProviders(<VideoCard video={video} />);
        expect(screen.getByRole('link', { name: /Test video\s*\(opens YouTube/ })).toBeInTheDocument();
        expect(screen.getByText('Hudson Jang · Jay Jang')).toBeInTheDocument();
        expect(screen.getByText('In English')).toBeInTheDocument();
        expect(screen.queryByText('테스트 영상')).not.toBeInTheDocument();
    });
});
