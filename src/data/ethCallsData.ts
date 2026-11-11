/**
 * 코어 개발자 콜 기록 (scripts/extract-eth-calls.ts가 새 콜마다 갱신 → eth-calls.json).
 * 타입은 scripts/lib/eth-calls.ts의 CallRecord와 같은 모양이다. src 밖을 import하지 않으려고 여기 다시 적는다.
 */
import { IS_EN } from '../utils/lang';

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
    /** AMA 브리프용 핵심 한 줄들 */
    highlights?: string[];
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
    /** 텔레그램 채널 브리프 커버 메시지 id (올린 콜만) */
    telegramMessageId?: number;
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

let lite: Promise<CallsFile> | null = null;
let full: Promise<CallsFile> | null = null;

/** 목록·홈·EIP·포크용: 발언(topics[].positions·quote)과 채팅이 빠진 판 (vite-json-slice.ts). 콜 상세는 loadEthCallsFull */
export function loadEthCalls(): Promise<CallsFile> {
    lite ??= (IS_EN ? import('./eth-calls.json?lite&en') : import('./eth-calls.json?lite')).then(({ default: data }) => data as CallsFile);
    return lite;
}

export function loadEthCallsFull(): Promise<CallsFile> {
    full ??= (IS_EN ? import('./eth-calls.json?full&en') : import('./eth-calls.json')).then(({ default: data }) => data as CallsFile);
    return full;
}
