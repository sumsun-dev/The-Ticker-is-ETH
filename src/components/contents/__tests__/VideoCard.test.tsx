import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import VideoCard from '../VideoCard';
import { renderWithProviders } from '../../../test/helpers/render';
import type { VideoItem } from '../../../data/videoData';

const video: VideoItem = {
    id: 'abc123',
    title: '테스트 영상',
    event: 'ek1-genesis',
    day: 2,
    date: '2026-09-29',
    duration: '10:00',
    uploadDate: '2026-10-20T02:33:38-07:00',
    seconds: 600,
    summary: '요약',
    speakers: ['Hudson Jang, SRE, Four Pillars', 'Moderator: Jay Jang, Head of Business, Sunnyside Labs'],
    lang: 'ko',
};

describe('VideoCard', () => {
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

    it('should list speaker names', () => {
        renderWithProviders(<VideoCard video={video} />);
        expect(screen.getByText('Hudson Jang · Jay Jang')).toBeInTheDocument();
    });
});
