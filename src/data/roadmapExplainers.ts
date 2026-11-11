/**
 * 로드맵 개념 해설과 포크별 "나에게 달라지는 것" (scripts/extract-roadmap.ts가 쓰고 im-not-ai로 윤문해 roadmap-explainers.json에 쌓는다).
 */
import { IS_EN } from '../utils/lang';

export interface RoadmapTopic {
    title: string;
    /** 한두 문장 쉬운 설명 */
    summary: string;
    why: string;
    steps: Array<{ title: string; body: string }>;
    /** eip: 연결된 EIP 원문·해설을 근거로 씀, strawmap: EIP 없이 Strawmap 위치와 공개 연구로 씀 */
    basis: 'eip' | 'strawmap';
    model: string;
    generatedAt: string;
}

export interface ForkImpact {
    impact: Array<{ who: string; text: string }>;
    model: string;
    generatedAt: string;
}

export interface RoadmapExplainersFile {
    updatedAt: string;
    topics: Record<string, RoadmapTopic>;
    forks: Record<string, ForkImpact>;
}

let pending: Promise<RoadmapExplainersFile> | null = null;

export async function loadRoadmapExplainers(): Promise<RoadmapExplainersFile> {
    if (!pending) {
        pending = (IS_EN ? import('./roadmap-explainers.json?full&en') : import('./roadmap-explainers.json'))
            .then(({ default: data }) => data as unknown as RoadmapExplainersFile)
            .catch((error) => {
                pending = null;
                throw error;
            });
    }
    return pending;
}
