/**
 * schema.org JSON-LD 빌더.
 * 클라이언트(JsonLd 컴포넌트)와 빌드 스크립트(scripts/generate-seo.ts) 양쪽에서 재사용한다.
 */

export const SITE_URL = 'https://ethcollective.xyz';
export const ORG_NAME = 'Ethereum Collective Korea';
export const ORG_LOGO = `${SITE_URL}/assets/ethereum-korea-logo-dark.png`;
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
