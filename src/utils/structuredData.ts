/**
 * schema.org JSON-LD 빌더.
 * 클라이언트(JsonLd 컴포넌트)와 빌드 스크립트(scripts/generate-seo.ts) 양쪽에서 재사용한다.
 */
import { parseSpeaker } from './youtubeDescription';

export const SITE_URL = 'https://ethcollective.xyz';
export const ORG_NAME = 'Ethereum Collective Korea';
export const ORG_LOGO = `${SITE_URL}/assets/eck-logo.png`;
const ORG_DESCRIPTION =
    'ECK(Ethereum Collective Korea)는 한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다.';

function toAbsolute(url?: string): string {
    if (!url) return ORG_LOGO;
    if (/^https?:\/\//.test(url)) return url;
    return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function toIsoDate(date?: string): string | undefined {
    if (!date) return undefined;
    if (date.includes('T') || date.includes('-')) return date;
    return date.replace(/\./g, '-');
}

export interface MinimalArticle {
    id: string;
    title: string;
    author: string;
    date: string;
    summary: string;
    thumbnailUrl?: string;
    category?: string;
    wordCount?: number;
    dateModified?: string;
}

export interface MinimalMember {
    id: string;
    name: string;
    role: string;
    bio?: string;
    avatarUrl?: string;
    memberType: 'core' | 'contributor';
    social?: {
        twitter?: string;
        github?: string;
        linkedin?: string;
        telegram?: string;
        website?: string;
    };
}

export function organizationLd() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: ORG_NAME,
        alternateName: 'ECK',
        url: SITE_URL,
        logo: ORG_LOGO,
        description: ORG_DESCRIPTION,
        sameAs: ['https://x.com/ethcollectivekr'],
    };
}

export function websiteLd() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: ORG_NAME,
        alternateName: 'ECK',
        url: SITE_URL,
        inLanguage: 'ko-KR',
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${SITE_URL}/contents?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    };
}

export function articleLd(item: MinimalArticle) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: item.title,
        description: item.summary,
        datePublished: toIsoDate(item.date),
        dateModified: toIsoDate(item.dateModified || item.date),
        articleSection: item.category,
        ...(item.wordCount ? { wordCount: item.wordCount } : {}),
        author: { '@type': 'Person', name: item.author },
        publisher: {
            '@type': 'Organization',
            name: ORG_NAME,
            logo: { '@type': 'ImageObject', url: ORG_LOGO },
        },
        image: toAbsolute(item.thumbnailUrl),
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `${SITE_URL}/contents/${item.id}`,
        },
        inLanguage: 'ko-KR',
    };
}

export function personLd(member: MinimalMember) {
    const url = `${SITE_URL}/${member.memberType === 'core' ? 'team' : 'contributors'}/${member.id}`;
    const sameAs = [
        member.social?.twitter,
        member.social?.github,
        member.social?.linkedin,
        member.social?.website,
    ].filter(Boolean) as string[];
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: member.name,
        jobTitle: member.role,
        description: member.bio,
        url,
        image: member.avatarUrl ? toAbsolute(member.avatarUrl) : undefined,
        ...(sameAs.length ? { sameAs } : {}),
        memberOf: { '@type': 'Organization', name: ORG_NAME, url: SITE_URL },
    };
}

export function breadcrumbLd(trail: Array<{ name: string; url: string }>) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: trail.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: toAbsolute(item.url),
        })),
    };
}

export function faqLd(qas: Array<{ q: string; a: string }>) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: qas.map((x) => ({
            '@type': 'Question',
            name: x.q,
            acceptedAnswer: { '@type': 'Answer', text: x.a },
        })),
    };
}

export function collectionPageLd(opts: {
    name: string;
    url: string;
    description: string;
    items: Array<{ name: string; url: string }>;
}) {
    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: opts.name,
        url: toAbsolute(opts.url),
        description: opts.description,
        inLanguage: 'ko-KR',
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: opts.items.length,
            itemListElement: opts.items.map((it, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: it.name,
                url: toAbsolute(it.url),
            })),
        },
    };
}

// ── 영상 (YouTube) ─────────────────────────────────────────

export interface MinimalVideo {
    id: string;
    title: string;
    uploadDate: string;
    seconds: number;
    summary: string;
    speakers: string[];
    /** 영상 음성(진행) 언어 */
    spokenLang: 'ko' | 'en';
    /** 다른 언어 제목 (페이지는 한국어, 영어 제목을 별칭으로) */
    alternateName?: string;
}

export interface MinimalVideoDetail {
    about: string;
    chapters: Array<{ start: number; label: string }>;
}

const EK1_GENESIS_NAME = 'Ethereum Korea One: Genesis';
const EK1_EVENT_ID = `${SITE_URL}/events/ek1-genesis#event`;
const EK1_ORGANIZER = { '@type': 'Organization', name: 'Ethereum Korea', url: 'https://one.ethereumkorea.io/' };
const SEOUL = { '@type': 'PostalAddress', addressLocality: 'Seoul', addressCountry: 'KR' };

const videoPageUrl = (id: string) => `${SITE_URL}/contents/videos/${id}`;
const videoNodeId = (id: string) => `${videoPageUrl(id)}#video`;

/** 초 → ISO 8601 기간 (1694 → PT28M14S) */
export function isoDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `PT${h ? `${h}H` : ''}${m}M${s}S`;
}

/** 시작 시각 순으로 정렬하고, 중복·영상 길이 이후 챕터는 버린다 */
function validChapters(chapters: MinimalVideoDetail['chapters'], seconds: number) {
    const sorted = [...chapters].filter((c) => c.start >= 0 && c.start < seconds).sort((a, b) => a.start - b.start);
    return sorted.filter((c, i) => i === 0 || c.start > sorted[i - 1].start);
}

/**
 * 영상 요약 페이지(/contents/videos/:id)의 VideoObject.
 * 페이지에 플레이어가 임베드되어 있으므로 url·Clip은 이 페이지(?t=초)를 가리킨다.
 */
export function videoObjectLd(video: MinimalVideo, detail?: MinimalVideoDetail) {
    const chapters = validChapters(detail?.chapters ?? [], video.seconds);
    const pageUrl = videoPageUrl(video.id);
    return {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        '@id': videoNodeId(video.id),
        name: video.title,
        ...(video.alternateName && video.alternateName !== video.title ? { alternateName: video.alternateName } : {}),
        description: video.summary,
        ...(detail?.about ? { abstract: detail.about } : {}),
        thumbnailUrl: [`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`],
        uploadDate: video.uploadDate,
        duration: isoDuration(video.seconds),
        embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}`,
        url: pageUrl,
        sameAs: `https://www.youtube.com/watch?v=${video.id}`,
        inLanguage: video.spokenLang === 'ko' ? 'ko-KR' : 'en',
        actor: video.speakers.map(parseSpeaker).map((sp) => ({
            '@type': 'Person',
            name: sp.name,
            ...(sp.title ? { jobTitle: sp.title } : {}),
        })),
        creator: EK1_ORGANIZER,
        isPartOf: { '@type': 'Event', '@id': EK1_EVENT_ID },
        mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
        ...(chapters.length
            ? {
                  hasPart: chapters.map((c, i) => ({
                      '@type': 'Clip',
                      name: c.label,
                      startOffset: c.start,
                      endOffset: chapters[i + 1]?.start ?? video.seconds,
                      url: `${pageUrl}?t=${c.start}`,
                  })),
              }
            : {}),
    };
}

/** EK1 Genesis 행사(2026.09.28–29). Day별 장소는 subEvent로, 영상은 각 영상 페이지의 VideoObject를 @id로 참조한다 */
export function ek1GenesisEventLd(videos: MinimalVideo[]) {
    const common = {
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        organizer: EK1_ORGANIZER,
    };
    return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        '@id': EK1_EVENT_ID,
        name: EK1_GENESIS_NAME,
        description:
            '이더리움 코리아 컨소시엄이 연 이틀간의 행사. Day 1은 금융기관 초청 행사(콘래드 서울), Day 2는 빌더 데이 Build Beyond the Narrative(성수).',
        startDate: '2026-09-28T16:00:00+09:00',
        endDate: '2026-09-29T20:00:00+09:00',
        ...common,
        location: { '@type': 'Place', name: 'Seoul', address: SEOUL },
        url: `${SITE_URL}/events/ek1-genesis`,
        image: `${SITE_URL}/assets/events/ek1-genesis/main-banner.jpg`,
        subEvent: [
            {
                '@type': 'Event',
                name: `${EK1_GENESIS_NAME} Day 1 · Institutional Day`,
                startDate: '2026-09-28T16:00:00+09:00',
                endDate: '2026-09-28T19:40:00+09:00',
                ...common,
                location: { '@type': 'Place', name: 'Conrad Seoul', address: SEOUL },
            },
            {
                '@type': 'Event',
                name: `${EK1_GENESIS_NAME} Day 2 · Build Beyond the Narrative`,
                startDate: '2026-09-29T13:00:00+09:00',
                endDate: '2026-09-29T20:00:00+09:00',
                ...common,
                location: { '@type': 'Place', name: 'Informal Square, Seongsu', address: SEOUL },
            },
        ],
        recordedIn: videos.map((v) => ({ '@type': 'VideoObject', '@id': videoNodeId(v.id), name: v.title, url: videoPageUrl(v.id) })),
    };
}
