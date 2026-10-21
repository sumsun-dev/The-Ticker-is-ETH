import { describe, it, expect } from 'vitest';
import { VIDEOS, videosByDay, thumbUrl, watchUrl, embedUrl, filterVideos } from '../videoData';
import { GENESIS_SESSIONS } from '../ek1GenesisData';

describe('videoData', () => {
    it('should list 30 EK1 Genesis videos (Day 1 14, Day 2 16)', () => {
        expect(VIDEOS).toHaveLength(30);
        expect(videosByDay(1)).toHaveLength(14);
        expect(videosByDay(2)).toHaveLength(16);
    });

    it('should not repeat a video id', () => {
        expect(new Set(VIDEOS.map((v) => v.id)).size).toBe(VIDEOS.length);
    });

    it('should link every Day 2 video to a 2F/3F session and cover all of them', () => {
        const stageIds = GENESIS_SESSIONS.filter((s) => s.track !== '4f').map((s) => s.id);
        const linked = videosByDay(2).map((v) => v.sessionId);
        expect([...linked].sort()).toEqual([...stageIds].sort());
    });

    it('should keep Day 2 videos in program order', () => {
        const stageIds = GENESIS_SESSIONS.filter((s) => s.track !== '4f').map((s) => s.id);
        expect(videosByDay(2).map((v) => v.sessionId)).toEqual(stageIds);
    });

    it('should strip the series suffix from titles', () => {
        expect(VIDEOS.every((v) => !v.title.includes('|'))).toBe(true);
    });

    it('should build YouTube urls', () => {
        expect(thumbUrl('abc')).toBe('https://i.ytimg.com/vi/abc/hqdefault.jpg');
        expect(watchUrl('abc')).toBe('https://www.youtube.com/watch?v=abc');
        expect(embedUrl('abc')).toBe('https://www.youtube-nocookie.com/embed/abc?autoplay=1&rel=0');
    });

    it('should filter by title case-insensitively', () => {
        expect(filterVideos(VIDEOS, '')).toHaveLength(30);
        expect(filterVideos(VIDEOS, 'arbitrum').map((v) => v.id)).toEqual(['J8lYAW9kggA']);
        expect(filterVideos(VIDEOS, '없는 제목')).toHaveLength(0);
    });
});
