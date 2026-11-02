/**
 * EIP 해설 (scripts/extract-eips.ts가 EIP 원문과 콜 기록으로 쓰고 im-not-ai 룰북으로 윤문해 eips.json에 쌓는다).
 * 콜 여정·포크 포함 상태·관련 논쟁은 저장하지 않고 화면에서 eth-calls.json·eth-debates.json으로 계산한다 (src/utils/eips.ts).
 */

export const EIP_TOPICS = ['계정 추상화', '수수료·가스', '확장성·데이터', '합의·스테이킹', '보안·프라이버시', 'EVM·실행', '네트워크·노드', '기타'] as const;
export type EipTopic = (typeof EIP_TOPICS)[number];

export interface EipMeta {
    /** 원문 영어 제목 */
    title: string;
    description: string;
    /** 원문 상태: Draft, Review, Last Call, Final, Stagnant, Withdrawn */
    status: string;
    type: string;
    category?: string;
    created: string;
    authors: string[];
    requires: number[];
    discussionsTo?: string;
}

export interface EipRecord {
    number: number;
    titleKo: string;
    topic: EipTopic;
    /** 한두 문장 쉬운 설명 (목록 카드·상세 첫머리) */
    summary: string;
    why: string;
    before: string[];
    after: string[];
    impact: Array<{ who: string; text: string }>;
    /** 동작 순서 예시. 없으면 null */
    example: { title: string; steps: Array<{ label: string; title: string; body: string }> } | null;
    /** 심층 설명 (개발자·리서처용) */
    deep: Array<{ title: string; body: string; ref: string }>;
    glossary: Array<{ term: string; def: string }>;
    related: Array<{ number: number; note: string }>;
    meta: EipMeta;
    /** 해설을 쓸 때의 원문 해시. 원문이 바뀌면 다시 쓴다 */
    sourceHash: string;
    model: string;
    generatedAt: string;
}

export interface EipsFile {
    updatedAt: string;
    eips: EipRecord[];
}

let pending: Promise<EipsFile> | null = null;

export async function loadEips(): Promise<EipsFile> {
    if (!pending) {
        pending = import('./eips.json')
            .then(({ default: data }) => data as unknown as EipsFile)
            .catch((error) => {
                pending = null;
                throw error;
            });
    }
    return pending;
}

export const eipUrl = (n: number) => `https://eips.ethereum.org/EIPS/eip-${n}`;
