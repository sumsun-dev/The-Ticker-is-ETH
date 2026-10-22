import { describe, it, expect } from 'vitest';
import { isoDuration, videoObjectLd, ek1GenesisEventLd } from '../structuredData';

const video = {
    id: 'abc123',
    title: '글램스터담 업그레이드에 담긴 것',
    day: 2 as const,
    date: '2026-09-29',
    uploadDate: '2026-10-20T02:33:38-07:00',
    seconds: 1694,
    summary: '한 줄 요약',
    speakers: ['Hudson Jang, SRE & Tech Researcher, Four Pillars'],
    spokenLang: 'ko' as const,
    alternateName: "What's in the Glamsterdam Upgrade",
};

const detail = {
    about: '세션 소개',
    takeaways: ['요약 1'],
    chapters: [
        { start: 0, label: '오프닝' },
        { start: 76, label: '본론' },
    ],
};

describe('isoDuration', () => {
    it('should format seconds as ISO 8601 duration', () => {
        expect(isoDuration(1694)).toBe('PT28M14S');
        expect(isoDuration(3783)).toBe('PT1H3M3S');
        expect(isoDuration(420)).toBe('PT7M0S');
    });
});

describe('videoObjectLd', () => {
    it('should describe the YouTube video', () => {
        const ld = videoObjectLd(video, detail);
        expect(ld['@type']).toBe('VideoObject');
        expect(ld.name).toBe(video.title);
        expect(ld.description).toBe('한 줄 요약');
        expect(ld.uploadDate).toBe(video.uploadDate);
        expect(ld.duration).toBe('PT28M14S');
        expect(ld.embedUrl).toBe('https://www.youtube-nocookie.com/embed/abc123');
        expect(ld['@id']).toBe('https://ethcollective.xyz/contents/videos/abc123#video');
        expect(ld.url).toBe('https://ethcollective.xyz/contents/videos/abc123');
        expect(ld.isPartOf).toEqual({ '@type': 'Event', '@id': 'https://ethcollective.xyz/events/ek1-genesis#event' });
        expect(ld.thumbnailUrl).toContain('https://i.ytimg.com/vi/abc123/hqdefault.jpg');
        expect(ld.inLanguage).toBe('ko-KR');
        expect(ld.alternateName).toBe("What's in the Glamsterdam Upgrade");
        expect(ld.actor).toEqual([{ '@type': 'Person', name: 'Hudson Jang', jobTitle: 'SRE & Tech Researcher, Four Pillars' }]);
        expect(ld.mainEntityOfPage).toEqual({ '@type': 'WebPage', '@id': 'https://ethcollective.xyz/contents/videos/abc123' });
    });

    it('should mark English-spoken videos as English and skip a missing alternate name', () => {
        const ld = videoObjectLd({ ...video, spokenLang: 'en', alternateName: undefined });
        expect(ld.inLanguage).toBe('en');
        expect(ld).not.toHaveProperty('alternateName');
    });

    it('should expose chapters as Clips ending at the next chapter or video end', () => {
        const ld = videoObjectLd(video, detail);
        expect(ld.hasPart).toEqual([
            { '@type': 'Clip', name: '오프닝', startOffset: 0, endOffset: 76, url: 'https://ethcollective.xyz/contents/videos/abc123?t=0' },
            { '@type': 'Clip', name: '본론', startOffset: 76, endOffset: 1694, url: 'https://ethcollective.xyz/contents/videos/abc123?t=76' },
        ]);
    });

    it('should sort chapters and drop ones past the end or duplicated', () => {
        const ld = videoObjectLd(video, {
            about: '',
            chapters: [
                { start: 76, label: 'B' },
                { start: 0, label: 'A' },
                { start: 76, label: 'B2' },
                { start: 2000, label: 'past end' },
            ],
        });
        expect(ld.hasPart?.map((c) => [c.name, c.startOffset, c.endOffset])).toEqual([
            ['A', 0, 76],
            ['B', 76, 1694],
        ]);
    });

    it('should omit Clips without detail', () => {
        expect(videoObjectLd(video).hasPart).toBeUndefined();
    });
});

describe('ek1GenesisEventLd', () => {
    it('should describe the two-day event with recorded videos', () => {
        const ld = ek1GenesisEventLd([video]);
        expect(ld['@type']).toBe('Event');
        expect(ld['@id']).toBe('https://ethcollective.xyz/events/ek1-genesis#event');
        expect(ld.startDate).toBe('2026-09-28T16:00:00+09:00');
        expect(ld.subEvent.map((e) => e.location.name)).toEqual(['Conrad Seoul', 'Informal Square, Seongsu']);
        expect(ld.recordedIn).toEqual([
            {
                '@type': 'VideoObject',
                '@id': 'https://ethcollective.xyz/contents/videos/abc123#video',
                name: video.title,
                url: 'https://ethcollective.xyz/contents/videos/abc123',
            },
        ]);
    });
});
