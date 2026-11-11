/**
 * 이더리움 뉴스 인박스 (scripts/fetch-eth-news.ts가 매일 수집 → eth-news-inbox.json).
 * 타입 이름은 news-feed용 NewsItem과의 충돌을 피해 EthNewsItem을 사용한다.
 */
import { IS_EN } from '../utils/lang';

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

const RESEARCH_SOURCES = new Set(['ef-blog', 'ethresearch', 'eth-magicians', 'vitalik', 'forkcast']);

const SOURCE_LABELS: Record<string, string> = {
    'ef-blog': 'EF Blog',
    ethresearch: 'ethresear.ch',
    'eth-magicians': 'Eth Magicians',
    vitalik: 'Vitalik',
    'reddit-ethereum': 'r/ethereum',
    'tg:coinnesskr': '코인니스',
    forkcast: 'Forkcast',
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

export interface EthDigestItem {
    title: string;
    summary: string;
    /** "왜 중요한가" 한 줄 — 초기 다이제스트에는 없을 수 있음 */
    why?: string;
    url: string;
    source: string;
    date: string;
}

export interface EthDigestSection {
    heading: string;
    items: EthDigestItem[];
}

export interface EthDigest {
    date: string;
    title: string;
    /** 커버 이미지용 한 줄 헤드라인 */
    shortTitle?: string;
    /** 커버용 한 줄 부제 */
    subTitle?: string;
    intro: string;
    sections: EthDigestSection[];
    /** 커버 이미지 public 경로 (예: /assets/digests/2026-08-24.png) */
    coverImage?: string;
    /** 화면에 쓰는 가벼운 WebP 판. 없으면 coverImage 를 쓴다 */
    coverWebp?: string;
}

let digestCache: EthDigest[] | null = null;
let digestPromise: Promise<EthDigest[]> | null = null;

let digestListPending: Promise<EthDigest[]> | undefined;

/** 뉴스 첫 화면용: 최신호만 본문, 지난 호는 sections 가 빈 판 (vite-json-slice). 지난 호를 열 땐 loadEthDigests */
export function loadEthDigestList(): Promise<EthDigest[]> {
    return (digestListPending ??= (IS_EN ? import('./eth-digests.json?digests&en') : import('./eth-digests.json?digests')).then(
        ({ default: data }) => (data as { digests: EthDigest[] }).digests,
    ));
}

/** 매일 생성되는 한국어 편집 다이제스트 (eth-digests.json) */
export async function loadEthDigests(): Promise<EthDigest[]> {
    if (digestCache) return digestCache;
    if (digestPromise) return digestPromise;

    digestPromise = (IS_EN ? import('./eth-digests.json?full&en') : import('./eth-digests.json')).then(({ default: data }) => {
        digestCache = (data as { digests: EthDigest[] }).digests;
        digestPromise = null;
        return digestCache;
    });

    return digestPromise;
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
