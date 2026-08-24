/**
 * 이더리움 뉴스 인박스 (scripts/fetch-eth-news.ts가 매일 수집 → eth-news-inbox.json).
 * 타입 이름은 news-feed용 NewsItem과의 충돌을 피해 EthNewsItem을 사용한다.
 */

export interface EthNewsItem {
    id: string;
    source: string;
    sourceType: 'rss' | 'twitter' | 'telegram';
    title: string;
    url: string;
    publishedAt: string;
    summary: string;
    author: string;
}

export interface EthNewsInbox {
    fetchedAt: string;
    items: EthNewsItem[];
}

export type EthNewsGroup = 'research' | 'twitter' | 'community' | 'korea';

const RESEARCH_SOURCES = new Set(['ef-blog', 'ethresearch', 'eth-magicians', 'vitalik']);

const SOURCE_LABELS: Record<string, string> = {
    'ef-blog': 'EF Blog',
    ethresearch: 'ethresear.ch',
    'eth-magicians': 'Eth Magicians',
    vitalik: 'Vitalik',
    'reddit-ethereum': 'r/ethereum',
    'tg:coinnesskr': '코인니스',
};

/** 필터 그룹 분류: 공식·리서치 / 트위터 / 커뮤니티 / 국내 속보 */
export function groupOf(item: Pick<EthNewsItem, 'source' | 'sourceType'>): EthNewsGroup {
    if (item.sourceType === 'twitter') return 'twitter';
    if (item.sourceType === 'telegram') return 'korea';
    if (RESEARCH_SOURCES.has(item.source)) return 'research';
    return 'community';
}

/** 소스 배지 라벨: 알려진 소스는 고정 라벨, 트위터는 @handle */
export function sourceLabelOf(item: Pick<EthNewsItem, 'source' | 'sourceType'>): string {
    if (item.sourceType === 'twitter') return `@${item.source.replace(/^x:/, '')}`;
    return SOURCE_LABELS[item.source] ?? item.source;
}

let cache: EthNewsInbox | null = null;
let loadingPromise: Promise<EthNewsInbox> | null = null;

export async function loadEthNews(): Promise<EthNewsInbox> {
    if (cache) return cache;
    if (loadingPromise) return loadingPromise;

    loadingPromise = import('./eth-news-inbox.json').then(({ default: data }) => {
        cache = data as EthNewsInbox;
        loadingPromise = null;
        return cache;
    });

    return loadingPromise;
}
