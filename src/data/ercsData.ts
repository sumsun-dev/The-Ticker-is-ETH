/**
 * ERC 해설 (scripts/extract-ercs.ts가 ERC 원문으로 쓰고 im-not-ai 룰북으로 윤문해 ercs.json에 쌓는다).
 * erc-index.json은 ERC 저장소 전체의 원문 메타(제목·상태·requires)로, 모델 없이 매 실행 갱신한다. 목록 통계와 족보(기대는 표준·기대는 ERC)를 여기서 계산한다.
 */
import type { EipMeta } from './eipsData';

export const ERC_TOPICS = ['토큰', 'NFT·멀티토큰', '계정·지갑', '서명·인증', '금고·DeFi', '이름·메타데이터', '기타'] as const;
export type ErcTopic = (typeof ERC_TOPICS)[number];

export interface ErcRecord {
    number: number;
    titleKo: string;
    topic: ErcTopic;
    summary: string;
    why: string;
    before: string[];
    after: string[];
    impact: Array<{ who: string; text: string }>;
    /** 구현해야 하는 함수·이벤트. sig는 원문에서 글자 그대로 (원문에 없는 줄은 저장 전에 버린다) */
    iface: Array<{ sig: string; ko: string }>;
    /** 한 번의 흐름. 없으면 null */
    flow: { title: string; steps: Array<{ label: string; title: string; body: string }> } | null;
    deep: Array<{ title: string; body: string; ref: string }>;
    /** 원문 보안 고려사항에서 뽑은 주의할 점 */
    safety: Array<{ title: string; body: string }>;
    glossary: Array<{ term: string; def: string }>;
    meta: EipMeta;
    sourceHash: string;
    model: string;
    generatedAt: string;
}

export interface ErcsFile {
    updatedAt: string;
    ercs: ErcRecord[];
}

export interface ErcIndexEntry {
    number: number;
    title: string;
    status: string;
    created: string;
    requires: number[];
}

export interface ErcIndexFile {
    updatedAt: string;
    ercs: ErcIndexEntry[];
}

let pendingRecords: Promise<ErcsFile> | null = null;
let pendingIndex: Promise<ErcIndexFile> | null = null;

let list: Promise<ErcsFile> | null = null;

/** 목록·검색용: 해설 본문이 빠진 판 (vite-json-slice.ts). 상세 화면은 loadErcs */
export function loadErcList(): Promise<ErcsFile> {
    list ??= import('./ercs.json?list').then(({ default: data }) => data as ErcsFile);
    return list;
}

export async function loadErcs(): Promise<ErcsFile> {
    if (!pendingRecords) {
        pendingRecords = import('./ercs.json')
            .then(({ default: data }) => data as unknown as ErcsFile)
            .catch((error) => {
                pendingRecords = null;
                throw error;
            });
    }
    return pendingRecords;
}

export async function loadErcIndex(): Promise<ErcIndexFile> {
    if (!pendingIndex) {
        pendingIndex = import('./erc-index.json')
            .then(({ default: data }) => data as unknown as ErcIndexFile)
            .catch((error) => {
                pendingIndex = null;
                throw error;
            });
    }
    return pendingIndex;
}

export const ercUrl = (n: number) => `https://ercs.ethereum.org/ERCS/erc-${n}`;
