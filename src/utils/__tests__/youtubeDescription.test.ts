import { describe, it, expect } from 'vitest';
import { parseSpeaker, parseYoutubeDescription, toSeconds, stripSeriesSuffix, isSeriesTitle } from '../youtubeDescription';

const KO = `글램스테르담이 적용돼도 당장 바뀌는 것은 거의 없습니다. 그런데 왜 중요할까요?

■ 세션 소개
Hudson Jang이 글램스테르담 업그레이드에 담긴 내용을 소개하는 발표입니다.

■ 핵심 요약
• 첫 번째 요약입니다.
• 두 번째 요약입니다.

■ 타임스탬프
00:00 오프닝과 연사 소개
01:16 푸사카에서 글램스테르담으로
1:03:03 마무리

■ 연사
Hudson Jang, SRE & Tech Researcher, Four Pillars

Ethereum Korea One: Genesis Day 2 | 2026.09.29 | Informal Square, Seongsu`;

const EN = `An opening conversation that kicks off Ethereum Korea One: Genesis.

■ About this session
A look back at the past 12 months.
Second line of the intro.

■ Key takeaways
• Takeaway one.

■ Timestamps
00:00 Opening
06:41 Wrap-up

■ Speakers
Adrian Li, Founder of Arcas Bridge
Moderator: Youbin Kang, CEO, Nonce Classic

Ethereum Korea One: Genesis | 2026.09.28 | Conrad Seoul`;

describe('toSeconds', () => {
    it('should convert mm:ss and h:mm:ss', () => {
        expect(toSeconds('00:00')).toBe(0);
        expect(toSeconds('01:16')).toBe(76);
        expect(toSeconds('1:03:03')).toBe(3783);
    });
});

describe('parseSpeaker', () => {
    it('should split name and title', () => {
        expect(parseSpeaker('Hudson Jang, SRE & Tech Researcher, Four Pillars')).toEqual({
            name: 'Hudson Jang',
            title: 'SRE & Tech Researcher, Four Pillars',
            moderator: false,
        });
    });

    it('should detect moderators in English and Korean', () => {
        expect(parseSpeaker('Moderator: Youbin Kang, CEO, Nonce Classic')).toEqual({ name: 'Youbin Kang', title: 'CEO, Nonce Classic', moderator: true });
        expect(parseSpeaker('모더레이터: Bosul Mun, Geth Core Engineer')).toEqual({ name: 'Bosul Mun', title: 'Geth Core Engineer', moderator: true });
    });

    it('should handle a name without title', () => {
        expect(parseSpeaker('Sose')).toEqual({ name: 'Sose', title: '', moderator: false });
    });
});

describe('parseYoutubeDescription', () => {
    it('should parse a Korean description into sections', () => {
        const d = parseYoutubeDescription(KO);
        expect(d.lang).toBe('ko');
        expect(d.lead).toBe('글램스테르담이 적용돼도 당장 바뀌는 것은 거의 없습니다. 그런데 왜 중요할까요?');
        expect(d.about).toBe('Hudson Jang이 글램스테르담 업그레이드에 담긴 내용을 소개하는 발표입니다.');
        expect(d.takeaways).toEqual(['첫 번째 요약입니다.', '두 번째 요약입니다.']);
        expect(d.chapters).toEqual([
            { start: 0, label: '오프닝과 연사 소개' },
            { start: 76, label: '푸사카에서 글램스테르담으로' },
            { start: 3783, label: '마무리' },
        ]);
        expect(d.speakers).toEqual(['Hudson Jang, SRE & Tech Researcher, Four Pillars']);
    });

    it('should parse an English description and stop speakers before the event footer', () => {
        const d = parseYoutubeDescription(EN);
        expect(d.lang).toBe('en');
        expect(d.about).toBe('A look back at the past 12 months.\nSecond line of the intro.');
        expect(d.takeaways).toEqual(['Takeaway one.']);
        expect(d.chapters).toHaveLength(2);
        expect(d.speakers).toEqual(['Adrian Li, Founder of Arcas Bridge', 'Moderator: Youbin Kang, CEO, Nonce Classic']);
    });

    it('should return empty sections when the description has no headers', () => {
        const d = parseYoutubeDescription('그냥 설명 한 줄');
        expect(d.lead).toBe('그냥 설명 한 줄');
        expect(d.about).toBe('');
        expect(d.takeaways).toEqual([]);
        expect(d.chapters).toEqual([]);
        expect(d.speakers).toEqual([]);
    });
});

describe('stripSeriesSuffix', () => {
    it('should drop the Korean and English series suffix', () => {
        expect(stripSeriesSuffix('개회사 | 이더리움 코리아 원 : 제네시스')).toBe('개회사');
        expect(stripSeriesSuffix('Opening Remarks | Ethereum Korea One: Genesis')).toBe('Opening Remarks');
        expect(stripSeriesSuffix('No suffix')).toBe('No suffix');
    });

    it('should tell series titles apart', () => {
        expect(isSeriesTitle("What's in the Glamsterdam Upgrade | Ethereum Korea One: Genesis")).toBe(true);
        expect(isSeriesTitle('Other channel video')).toBe(false);
    });
});
