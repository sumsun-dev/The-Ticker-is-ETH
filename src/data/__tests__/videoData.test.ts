import { describe, it, expect } from 'vitest';
import {
    VIDEOS,
    VIDEO_LANGS,
    videosByDay,
    thumbUrl,
    watchUrl,
    embedUrl,
    filterVideos,
    loadVideoDetails,
    localizeVideo,
    playerUrl,
    toVideoLang,
    VIDEO_ID_RE,
} from '../videoData';
import { GENESIS_SESSIONS } from '../ek1GenesisData';

describe('videoData', () => {
    it('should list 30 EK1 Genesis videos (Day 1 14, Day 2 16)', () => {
        expect(VIDEOS).toHaveLength(30);
        expect(videosByDay(1)).toHaveLength(14);
        expect(videosByDay(2)).toHaveLength(16);
    });

    it('should only hold valid YouTube ids', () => {
        expect(VIDEOS.every((v) => VIDEO_ID_RE.test(v.id))).toBe(true);
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

    it('should strip the series suffix from titles in both languages', () => {
        for (const v of VIDEOS) for (const lang of VIDEO_LANGS) expect(v.text[lang].title, `${v.id} ${lang}`).not.toContain('|');
    });

    it('should carry upload date, length and the spoken language for every video', () => {
        for (const v of VIDEOS) {
            expect(v.uploadDate).toMatch(/^2026-\d{2}-\d{2}T/);
            expect(v.seconds).toBeGreaterThan(0);
            expect(['ko', 'en']).toContain(v.spokenLang);
        }
    });

    it('should hold a Korean and an English version of every title, summary and speaker list', () => {
        for (const v of VIDEOS) {
            const { ko, en } = v.text;
            expect(ko.title, v.id).toMatch(/[가-힣]/);
            expect(en.title, v.id).not.toMatch(/[가-힣]/);
            expect(ko.summary, v.id).toMatch(/[가-힣]/);
            expect(en.summary, v.id).not.toMatch(/[가-힣]/);
            expect(ko.speakers.length, v.id).toBeGreaterThan(0);
            expect(en.speakers, v.id).toHaveLength(ko.speakers.length);
        }
    });

    it('should have session details in both languages for every video', async () => {
        const details = await loadVideoDetails();
        for (const v of VIDEOS) {
            for (const lang of VIDEO_LANGS) {
                const d = details[v.id]?.[lang];
                expect(d, `${v.id} ${lang}`).toBeDefined();
                expect(d.about.length).toBeGreaterThan(0);
                expect(d.takeaways.length).toBeGreaterThan(0);
                expect(d.chapters[0].start).toBe(0);
                expect(d.chapters.at(-1)!.start).toBeLessThan(v.seconds);
            }
            expect(details[v.id].en.about, v.id).not.toMatch(/[가-힣]/);
            expect(details[v.id].ko.about, v.id).toMatch(/[가-힣]/);
        }
    });

    it('should flatten a video into one language', () => {
        const v = VIDEOS.find((x) => x.id === 'wr6JU4-7M7A')!;
        const en = localizeVideo(v, 'en');
        expect(en.title).toBe(v.text.en.title);
        expect(en.summary).toBe(v.text.en.summary);
        expect(en.lang).toBe('en');
        expect(en.spokenLang).toBe('ko');
        expect(localizeVideo(v, 'ko').title).toBe('글램스터담 업그레이드에 담긴 것');
    });

    it('should map i18n languages to a video language', () => {
        expect(toVideoLang('en')).toBe('en');
        expect(toVideoLang('en-US')).toBe('en');
        expect(toVideoLang('ko')).toBe('ko');
        expect(toVideoLang(undefined)).toBe('ko');
        expect(toVideoLang('ja')).toBe('ko');
    });

    it('should build YouTube urls', () => {
        expect(thumbUrl('abc')).toBe('https://i.ytimg.com/vi/abc/hqdefault.jpg');
        expect(watchUrl('abc')).toBe('https://www.youtube.com/watch?v=abc');
        expect(embedUrl('abc')).toBe('https://www.youtube-nocookie.com/embed/abc');
        expect(playerUrl('abc', 76)).toBe('https://www.youtube-nocookie.com/embed/abc?start=76&autoplay=1');
        expect(playerUrl('abc')).toBe('https://www.youtube-nocookie.com/embed/abc');
    });

    it('should filter by title in either language, case-insensitively', () => {
        expect(filterVideos(VIDEOS, '')).toHaveLength(30);
        expect(filterVideos(VIDEOS, 'arbitrum').map((v) => v.id)).toEqual(['J8lYAW9kggA']);
        expect(filterVideos(VIDEOS, '글램스터담').map((v) => v.id)).toEqual(['wr6JU4-7M7A']);
        expect(filterVideos(VIDEOS, 'glamsterdam upgrade').map((v) => v.id)).toEqual(['wr6JU4-7M7A']);
        expect(filterVideos(VIDEOS, '없는 제목')).toHaveLength(0);
    });
});
