/**
 * EthereumKorea 채널 영상 설명란 파서.
 * 설명은 "도입 문단 → ■ 세션 소개 → ■ 핵심 요약 → ■ 타임스탬프 → ■ 연사 → 행사 표기" 순서로 쓰여 있다(한국어·영어 공통).
 */

export interface VideoChapter {
    /** 시작 시각(초) */
    start: number;
    label: string;
}

export interface ParsedDescription {
    lang: 'ko' | 'en';
    lead: string;
    about: string;
    takeaways: string[];
    chapters: VideoChapter[];
    speakers: string[];
}

export interface Speaker {
    name: string;
    title: string;
    moderator: boolean;
}

type SectionKey = 'about' | 'takeaways' | 'chapters' | 'speakers';

const SECTION_HEADERS: Record<string, SectionKey> = {
    'About this session': 'about',
    '세션 소개': 'about',
    'Key takeaways': 'takeaways',
    '핵심 요약': 'takeaways',
    Timestamps: 'chapters',
    타임스탬프: 'chapters',
    Speakers: 'speakers',
    연사: 'speakers',
};

const HEADER_RE = /^■\s*(.+?)\s*$/;
const CHAPTER_RE = /^((?:\d+:)?\d{1,2}:\d{2})\s+(.+)$/;
const MODERATOR_RE = /^(?:Moderator|모더레이터|좌장)\s*:\s*/i;

/** "1:03:03" → 3783 */
export const toSeconds = (stamp: string): number => stamp.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);

/** "Moderator: Youbin Kang, CEO, Nonce Classic" → { name, title, moderator } */
export function parseSpeaker(line: string): Speaker {
    const moderator = MODERATOR_RE.test(line);
    const rest = line.replace(MODERATOR_RE, '').trim();
    const comma = rest.indexOf(',');
    if (comma < 0) return { name: rest, title: '', moderator };
    return { name: rest.slice(0, comma).trim(), title: rest.slice(comma + 1).trim(), moderator };
}

function splitSections(text: string) {
    const sections: Partial<Record<SectionKey, string[]>> = {};
    const lead: string[] = [];
    let current: SectionKey | null = null;
    let lang: ParsedDescription['lang'] = 'en';

    for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
        const header = HEADER_RE.exec(raw.trim());
        const key = header ? SECTION_HEADERS[header[1]] : undefined;
        if (header && key) {
            current = key;
            sections[key] = [];
            if (/[가-힣]/.test(header[1])) lang = 'ko';
            continue;
        }
        if (current) sections[current]!.push(raw);
        else lead.push(raw);
    }
    return { sections, lead, lang };
}

/** 빈 줄로 나뉜 첫 문단만 (연사 뒤의 행사 표기를 떼어 낸다) */
const firstBlock = (lines: string[] = []) => {
    const trimmed = lines.map((l) => l.trim());
    const start = trimmed.findIndex((l) => l !== '');
    if (start < 0) return [];
    const end = trimmed.indexOf('', start);
    return trimmed.slice(start, end < 0 ? undefined : end);
};

export function parseYoutubeDescription(text: string): ParsedDescription {
    const { sections, lead, lang } = splitSections(text);
    const nonEmpty = (lines: string[] = []) => lines.map((l) => l.trim()).filter(Boolean);

    return {
        lang,
        lead: nonEmpty(lead).join('\n'),
        about: firstBlock(sections.about).join('\n'),
        takeaways: nonEmpty(sections.takeaways).map((l) => l.replace(/^•\s*/, '')),
        chapters: nonEmpty(sections.chapters).flatMap((l) => {
            const m = CHAPTER_RE.exec(l);
            return m ? [{ start: toSeconds(m[1]), label: m[2].trim() }] : [];
        }),
        speakers: firstBlock(sections.speakers),
    };
}
