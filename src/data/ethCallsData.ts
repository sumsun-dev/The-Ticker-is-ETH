/**
 * 코어 개발자 콜 기록 (scripts/extract-eth-calls.ts가 새 콜마다 갱신 → eth-calls.json).
 * 타입은 scripts/lib/eth-calls.ts의 CallRecord와 같은 모양이다. src 밖을 import하지 않으려고 여기 다시 적는다.
 */

export type CallStatus = 'SFI' | 'CFI' | 'PFI' | 'DFI' | '보류' | '확정' | '일정' | '기타';

export interface CallDecision {
    label: string;
    text: string;
    original: string;
    eips: number[];
    status: CallStatus;
    fork?: string;
    timestamp?: string;
}
export interface CallTarget {
    key: string;
    text: string;
    timestamp?: string;
}
export interface CallAction {
    owner: string;
    text: string;
    timestamp?: string;
}
export interface CallAgendaItem {
    timestamp: string;
    heading: string;
    discussion?: boolean;
    decision?: boolean;
}
export interface CallSpeaker {
    /** 자막·채팅의 표기 (레코드 안에서 발언자를 잇는 키) */
    label: string;
    name: string;
    org?: string;
    role?: string;
    handle?: string;
    avatar?: string;
    /** 자막 발언량 비중 0~1 */
    share: number;
}
export interface CallPosition {
    speaker: string;
    text: string;
    timestamp?: string;
    viaChat?: boolean;
    original?: string;
    translation?: string;
}
export interface CallQuote {
    text: string;
    original: string;
    speaker: string;
    timestamp: string;
}
export interface CallTopic {
    title: string;
    intro: string;
    decision?: string;
    positions: CallPosition[];
    quote?: CallQuote;
}
export interface CallChatLine {
    speaker: string;
    text: string;
    timestamp: string;
}
export interface CallGlossaryItem {
    term: string;
    def: string;
}
export interface CallRecord {
    id: string;
    series: string;
    number: number;
    date: string;
    title: string;
    forkcastUrl: string;
    videoUrl?: string;
    issueUrl?: string;
    /** full: 결정·토론까지 정리 / record: 제목·링크만 */
    kind: 'full' | 'record';
    durationMin?: number;
    headline?: string;
    lead?: string;
    intro?: string;
    summary?: string;
    whyItMatters?: string;
    decisions: CallDecision[];
    targets: CallTarget[];
    actions: CallAction[];
    agenda: CallAgendaItem[];
    topics: CallTopic[];
    speakers: CallSpeaker[];
    chat: CallChatLine[];
    glossary: CallGlossaryItem[];
    eips: number[];
    relatedDebates: string[];
}
export interface CallsStatus {
    currentFork?: { name: string; stage: string; line: string };
    nextFork?: { name: string; stage: string; line: string };
    basis?: string;
}
export interface CallsFile {
    updatedAt: string;
    status?: CallsStatus;
    calls: CallRecord[];
}

let cache: CallsFile | null = null;
let pending: Promise<CallsFile> | null = null;

export async function loadEthCalls(): Promise<CallsFile> {
    if (cache) return cache;
    if (pending) return pending;
    pending = import('./eth-calls.json').then(({ default: data }) => {
        cache = data as CallsFile;
        pending = null;
        return cache;
    });
    return pending;
}
