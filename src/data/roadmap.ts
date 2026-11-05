/**
 * 이더리움 로드맵 (/roadmap). EF 프로토콜 팀의 Strawmap(https://strawmap.org) 다이어그램을 손으로 옮겼다.
 * 원본에 기계가 읽을 데이터가 없어 분기마다 원본 갱신일을 보고 다시 옮긴다.
 * eips: 원본 칸의 EIP 링크 중 번호를 확인한 것만 적는다.
 */

export const STRAWMAP_UPDATED = '2026-11-02';
export const STRAWMAP_URL = 'https://strawmap.org';

export type Layer = 'cl' | 'dl' | 'el' | 'cross';
export type ItemKind = 'headliner' | 'onchain' | 'offchain';

export interface RoadmapItem {
    name: string;
    /** 원본 영어 이름 */
    en: string;
    layer: Layer;
    /** STRAWMAP_FORKS 인덱스 */
    fork: number;
    kind: ItemKind;
    /** 원본의 "실현 여부 불확실" 표시 */
    uncertain?: boolean;
    eips?: number[];
}

export const LAYERS: Array<{ key: Layer; name: string }> = [
    { key: 'cl', name: '합의' },
    { key: 'dl', name: '데이터' },
    { key: 'el', name: '실행' },
];

export const STRAWMAP_FORKS = [
    { name: 'Glamsterdam', when: '2027년 초', slug: 'glamsterdam' },
    { name: 'Hegotá', when: '2027', slug: 'hegota' },
    { name: 'I*', when: '2028' },
    { name: 'J*', when: '2028~29' },
    { name: 'K*', when: '2029' },
    { name: 'L*', when: '2029~30' },
    { name: '그 이후', when: '장기' },
] as const;

export const NORTH_STARS = [
    { layer: '합의', name: '빠른 L1', metric: '몇 초 안에 확정', body: '거래가 블록에 들어가고 되돌릴 수 없게 확정되기까지 걸리는 시간을 지금의 십몇 분에서 몇 초로 줄입니다.' },
    { layer: '실행', name: '기가가스 L1', metric: '초당 1기가가스', body: 'zkEVM과 실시간 증명으로 L1 처리량을 약 1만 TPS 수준까지 올립니다.' },
    { layer: '데이터', name: '테라가스 L2', metric: '초당 1GB', body: '데이터 가용성 샘플링으로 L2 전체 처리량을 약 1천만 TPS 수준까지 올립니다.' },
    { layer: '여러 층', name: '양자 내성 L1', metric: '수백 년 보안', body: '해시 기반 서명과 증명으로 양자컴퓨터가 나와도 버티게 합니다.' },
    { layer: '실행', name: '프라이버시 L1', metric: '차폐 전송', body: '금액과 상대를 가린 송금을 L1의 기본 기능으로 넣습니다.' },
] as const;

/** 여러 포크에 걸쳐 이어지는 흐름 (원본의 가로 막대) */
export const THROUGHLINES = [
    { layer: 'cl' as Layer, name: '슬롯 시간 단축', from: 1, to: 5 },
    { layer: 'dl' as Layer, name: '데이터 가용성 확대', from: 1, to: 5 },
    { layer: 'el' as Layer, name: '가스 한도 상향', from: 1, to: 5, eips: [7938] },
];

const i = (name: string, en: string, layer: Layer, fork: number, kind: ItemKind, extra: Partial<RoadmapItem> = {}): RoadmapItem => ({ name, en, layer, fork, kind, ...extra });

export const ROADMAP_ITEMS: RoadmapItem[] = [
    // 합의 층
    i('ePBS', 'ePBS', 'cl', 0, 'headliner', { eips: [7732] }),
    i('빠른 확인', 'fast confirmation', 'cl', 0, 'offchain'),
    i('FOCIL', 'FOCIL', 'cl', 1, 'headliner', { eips: [7805] }),
    i('퀵 슬롯', 'quick slots', 'cl', 1, 'onchain', { eips: [8198] }),
    i('양자 내성 키 등록', 'post quantum registrations', 'cl', 1, 'onchain'),
    i('암호 명세 Lean 4 작성', 'cryptography specs in Lean 4', 'cl', 1, 'offchain'),
    i('합의 분리', 'decoupled consensus', 'cl', 2, 'headliner'),
    i('발행량 점감 소각', 'tapered issuance burn', 'cl', 2, 'onchain', { uncertain: true, eips: [8363] }),
    i('leanXMSS 양자 내성 투표', 'leanXMSS PQ attestations', 'cl', 3, 'headliner'),
    i('leanCL 상태 전이 Lean 4', 'leanCL STF in Lean 4', 'cl', 3, 'offchain'),
    i('1라운드 완결', '1-round finality', 'cl', 5, 'headliner'),
    i('증인·제안자 분리', 'attester-proposer separation', 'cl', 5, 'onchain', { uncertain: true }),
    i('기술 부채 정리', 'tech debt reset', 'cl', 5, 'onchain'),
    i('실시간 CL 증명', 'real-time cl-asm proofs', 'cl', 5, 'onchain'),
    i('증인 100만 복귀', 'return to 1M attesters', 'cl', 6, 'onchain', { uncertain: true }),
    i('분산 블록 빌딩', 'distributed block building', 'cl', 6, 'offchain'),
    i('51% 공격 자동 복구', '51% attack auto-recovery', 'cl', 6, 'onchain'),
    i('비밀 제안자', 'secret proposers', 'cl', 6, 'onchain'),
    i('합의 층 차폐 풀', 'CL-enshrined shielded pool', 'cl', 6, 'onchain'),
    // 데이터 층
    i('스파스 블롭풀', 'sparse blobpool', 'dl', 0, 'offchain', { eips: [8070] }),
    i('셀 단위 델타', 'cell-level deltas', 'dl', 0, 'offchain', { eips: [8136] }),
    i('분산 블롭 재구성', 'distributed blob reconstruction', 'dl', 2, 'onchain', { eips: [8371] }),
    i('leanDA 양자 내성 샘플링', 'leanDA PQ sampling', 'dl', 3, 'headliner'),
    i('블롭 거래 제거', 'remove blob transactions', 'dl', 5, 'onchain'),
    i('블롭 스트리밍', 'blob streaming', 'dl', 6, 'onchain'),
    i('보관 증명', 'proofs of custody', 'dl', 6, 'onchain', { uncertain: true }),
    i('단기 블롭 선물', 'short-dated blob futures', 'dl', 6, 'onchain', { uncertain: true }),
    // 여러 층
    i('leanVM 양자 내성 증명', 'leanVM PQ proofs', 'cross', 2, 'onchain'),
    // 실행 층
    i('BAL', 'BALs', 'el', 0, 'headliner', { eips: [7928] }),
    i('Glamsterdam 가격 재조정', 'Glamsterdam repricing', 'el', 0, 'onchain', { eips: [2780, 8037, 8038] }),
    i('evm-asm 표준 게스트', 'evm-asm canonical guest', 'el', 0, 'offchain'),
    i('프레임 트랜잭션', 'frame transactions', 'el', 1, 'headliner', { eips: [8141] }),
    i('페이로드 빠른 전파', 'fast payload broadcast', 'el', 1, 'onchain', { eips: [8411] }),
    i('키드 논스·최근 루트', 'keyed nonces & recent roots', 'el', 1, 'onchain', { eips: [8250, 8272] }),
    i('데이터 가격 조정', 'data repricing', 'el', 1, 'onchain'),
    i('트랜잭션 단언', 'transaction assertions', 'el', 1, 'onchain', { eips: [7906] }),
    i('선택적 증명', 'optional proofs', 'el', 1, 'offchain', { eips: [8025] }),
    i('state-asm', 'state-asm', 'el', 1, 'offchain'),
    i('구역 분할 이진 트리', 'partitioned binary tree', 'el', 2, 'headliner', { eips: [8297] }),
    i('leanSPHINCS 양자 내성 거래', 'leanSPHINCS PQ transactions', 'el', 2, 'onchain'),
    i('다차원 가격', 'multidimensional pricing', 'el', 2, 'onchain'),
    i('pureth 정리', 'pureth purges', 'el', 2, 'onchain'),
    i('leanPCS 프레임', 'leanPCS frames', 'el', 3, 'headliner'),
    i('페이로드 샘플링', 'payload sampling', 'el', 3, 'onchain'),
    i('롱테일 프리컴파일 EVM화', 'EVMify long-tail precompiles', 'el', 3, 'onchain', { eips: [8200] }),
    i('검증 전용 부분 상태', 'validity-only partial state', 'el', 3, 'offchain'),
    i('필수 1-of-1 증명', 'mandatory 1-of-1 proofs', 'el', 4, 'headliner'),
    i('탈중앙 상태', 'decentralized state', 'el', 4, 'offchain'),
    i('네이티브 롤업', 'native rollups', 'el', 5, 'headliner'),
    i('ethp2p 통합', 'ethp2p unification', 'el', 5, 'offchain'),
    i('샤딩 멤풀', 'sharded mempool', 'el', 6, 'offchain'),
    i('암호화 멤풀', 'encrypted mempool', 'el', 6, 'onchain', { uncertain: true }),
    i('웜홀', 'wormholes', 'el', 6, 'onchain', { eips: [7503] }),
    i('최종 상태', 'endgame state', 'el', 6, 'onchain', { uncertain: true }),
];

/** 지도 칸: 층 × 포크. leanVM 같은 여러 층 항목은 데이터 층 칸에 함께 둔다 */
export function roadmapGrid(items: RoadmapItem[] = ROADMAP_ITEMS): Record<Exclude<Layer, 'cross'>, RoadmapItem[][]> {
    const empty = () => STRAWMAP_FORKS.map(() => [] as RoadmapItem[]);
    const grid = { cl: empty(), dl: empty(), el: empty() };
    for (const it of items) grid[it.layer === 'cross' ? 'dl' : it.layer][it.fork].push(it);
    return grid;
}

/** 개념 상세 주소 (/roadmap/:slug). 원본 영어 이름에서 만든다 */
export const itemSlug = (it: Pick<RoadmapItem, 'en'>): string =>
    it.en
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

export const itemBySlug = (slug: string): RoadmapItem | undefined => ROADMAP_ITEMS.find((it) => itemSlug(it) === slug);
