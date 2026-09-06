/**
 * 이더리움 논쟁 아카이브 (scripts/extract-eth-debates.ts가 3일마다 갱신 → eth-debates.json).
 * 타입은 scripts/lib/eth-debates.ts의 Debate와 같은 모양이다. src 밖을 import하지 않으려고 여기 다시 적는다.
 */

export type DebateStance = 'pro' | 'con' | 'neutral' | 'other';
export type DebateStatus = 'active' | 'cooling' | 'archived' | 'resolved';

export interface DebateHolder {
    handle?: string;
    name: string;
    /** 소속·직책 한 구절 */
    role?: string;
    avatar?: string;
    /** false면 워치리스트 밖 인물 (인용으로만 등장) */
    watchlist?: boolean;
}

export interface DebatePosition {
    stance: DebateStance;
    label: string;
    holders: DebateHolder[];
    points: string[];
}

export interface DebateTimelineEntry {
    date: string;
    by: string;
    stance?: DebateStance;
    quote: string;
    url: string;
    digest?: string;
    /** 이 트윗이 답하거나 인용한 상대의 핸들 */
    replyTo?: string;
    relation?: 'reply' | 'quote' | 'none';
    /** 트윗 원문 전문과 전문 번역 (팝업용) */
    original?: string;
    translation?: string;
}

export interface Debate {
    id: string;
    title: string;
    category: string;
    status: DebateStatus;
    firstSeen: string;
    lastActivity: string;
    summary: string;
    keyPoints: string[];
    /** 기술·제도적 맥락 */
    background?: string;
    /** 이 논쟁의 결과가 무엇을 바꾸는지 */
    whyItMatters?: string;
    sources?: Array<{ title: string; url: string }>;
    positions: DebatePosition[];
    timeline: DebateTimelineEntry[];
    engagement?: { likes: number; retweets: number; quotes: number; replies: number; views: number };
    rootUrl?: string;
}

import { isPublishable } from '../utils/debates';

let cache: Debate[] | null = null;
let pending: Promise<Debate[]> | null = null;

export async function loadEthDebates(): Promise<Debate[]> {
    if (cache) return cache;
    if (pending) return pending;
    pending = import('./eth-debates.json').then(({ default: data }) => {
        cache = (data as { debates: Debate[] }).debates.filter(isPublishable);
        pending = null;
        return cache;
    });
    return pending;
}
