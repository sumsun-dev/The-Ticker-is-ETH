/**
 * Ethereum Korea One · Genesis 빌더 데이(2026.09.29) 행사 기록.
 * 세션 요약·전문은 EK1 운영 대시보드 세션 기록(2026-10-01)에서, 사진은 행사 촬영본에서 옮겼다.
 * 사진: /assets/events/ek1-genesis/photos/<set>/<n>.webp (긴 변 1200px), 같은 이름의 thumbs/ (높이 240px).
 * 세트마다 앞의 featured장이 고른 대표 컷이다(리드 → 보조 순), 나머지는 촬영 순.
 */
import data from './ek1-genesis.json';

/** Day 2 층별 무대. Day 1(기관 초청 행사) 기록은 오너 결정으로 싣지 않는다 */
export type Track = '2f' | '3f' | '4f';

export interface GenesisSession {
    id: string;
    track: Track;
    time: string;
    format: string;
    title: string;
    titleEn: string | null;
    speakers: string;
    summary: string | null;
    quote: string | null;
    points: string[];
    eck: boolean;
    /** 전문 글자 수. 전문이 없으면 null */
    transcriptChars: number | null;
}

/** [파일 번호, 원본 너비, 원본 높이, 로딩 전 자리 표시 색] */
export type PhotoEntry = [string, number, number, string];

export interface GenesisTranscript {
    toc: string[];
    body: string;
    notes: { n: number; kind: string; html: string }[];
    chars: number;
}

const PHOTO_BASE = '/assets/events/ek1-genesis';

export const GENESIS_BANNER = `${PHOTO_BASE}/main-banner.jpg`;
export const GENESIS_SESSIONS = data.sessions as GenesisSession[];
export const GENESIS_PHOTOS = data.photos as unknown as Record<string, PhotoEntry[]>;
/** 세트별 대표 컷 수 */
export const GENESIS_FEATURED = data.featured as Record<string, number>;

/** 세션에 속하지 않는 현장 사진 묶음 */
export const NETWORKING_SETS = ['net-d2'] as const;

export const photoUrl = (set: string, n: string) => `${PHOTO_BASE}/photos/${set}/${n}.webp`;
export const thumbUrl = (set: string, n: string) => `${PHOTO_BASE}/thumbs/${set}/${n}.webp`;

export const sessionsOf = (track: Track) => GENESIS_SESSIONS.filter((s) => s.track === track);

let pending: Promise<Record<string, GenesisTranscript>> | null = null;

/** 전문은 약 450KB라 처음 열 때만 불러온다 */
export function loadTranscripts(): Promise<Record<string, GenesisTranscript>> {
    pending ??= import('./ek1-genesis-transcripts.json').then(({ default: t }) => t as Record<string, GenesisTranscript>);
    return pending;
}
