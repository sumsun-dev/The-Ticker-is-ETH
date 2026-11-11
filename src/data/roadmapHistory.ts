/**
 * /roadmap의 "로드맵이 걸어온 길"과 "비탈릭의 여섯 갈래로 다시 보기".
 * 출처는 항목마다 url로 단다 (2026-11-05 원문 대조: vitalik.eth.limo, blog.ethereum.org, strawmap.org, 각 X 게시물).
 * 갈래 분류(ITEM_PILLAR)는 Strawmap 원본에 없는 것으로, ECK가 Vitalik의 2024 "Possible futures" 연재를 기준으로 붙였다.
 */
import en from './en/roadmapHistory.json';
import { L } from '../utils/lang';

export type HistoryKind = 'vitalik' | 'drake' | 'ef' | 'fork';

export interface HistoryEntry {
    date: string;
    kind: HistoryKind;
    title: string;
    url: string;
    /** 이 판에서 새로 생기거나 바뀐 점 */
    changes: string[];
    /** 하드포크 적용이면 /forks/:slug */
    fork?: string;
}

export const HISTORY_KIND: Record<HistoryKind, string> = L({ vitalik: '비탈릭 부테린', drake: '저스틴 드레이크', ef: '이더리움 재단', fork: '메인넷 적용' }, en);

/** 흐름을 네 시기로 요약 (연대표 위에 둔다) */
export const HISTORY_ERAS = L([
    { years: '2021~2023', name: '갈래 그림', body: '비탈릭이 해마다 그린 한 장짜리 그림. 무엇을 할지를 다섯, 나중엔 여섯 갈래로 묶었습니다.' },
    { years: '2024', name: '연구 정리', body: '여섯 갈래를 한 편씩 풀어 목표와 남은 문제를 적은 연재. 갈래 안의 해법이 몇 차례 바뀝니다.' },
    { years: '2024~2025', name: '다시 짓기', body: '드레이크가 합의층부터 새로 짓자고 제안했고, 실행·데이터층까지 넓혀 Lean Ethereum이 됩니다.' },
    { years: '2026~', name: '포크별 일정', body: 'Strawmap이 Lean Ethereum과 당장의 작업을 하나로 엮어, 2029년까지 포크마다 무엇이 들어갈지 그립니다.' },
] as const, en);

export const ROADMAP_HISTORY: HistoryEntry[] = L([
    {
        date: '2021-12-02',
        kind: 'vitalik',
        title: '다섯 갈래 로드맵 그림',
        url: 'https://x.com/VitalikButerin/status/1466411377107558402',
        changes: [
            '비콘 체인 1주년에 Merge, Surge, Verge, Purge, Splurge 다섯 갈래를 한 장에 그렸습니다.',
            'Surge는 샤드 수를 늘려 롤업을 키우는 길, Verge는 Verkle 트리로 노드가 상태를 들고 있지 않게 하는 길이었습니다.',
            '블록 생산 분리(PBS)와 MEV 대책은 이때만 해도 "그 밖의 개선"인 Splurge 칸에 있었습니다.',
        ],
    },
    {
        date: '2022-07-21',
        kind: 'vitalik',
        title: 'EthCC 파리 발표',
        url: 'https://www.youtube.com/watch?v=kGjFTzRTH3Q',
        changes: ['더 머지를 두 달 앞두고 다섯 갈래를 직접 설명했습니다. 머지는 끝이 아니라 시작이라는 메시지가 널리 퍼졌습니다.'],
    },
    { date: '2022-09-15', kind: 'fork', title: '더 머지', url: '/forks/the-merge', fork: 'the-merge', changes: ['Merge 갈래의 첫 목표였던 지분 증명 전환이 끝났습니다.'] },
    {
        date: '2022-11-04',
        kind: 'vitalik',
        title: '여섯 번째 갈래 Scourge 추가',
        url: 'https://x.com/VitalikButerin/status/1588669782471368704',
        changes: [
            'MEV가 블록 생산을 중앙화하는 문제를 따로 떼어 Scourge를 만들고, PBS와 MEV 대책을 Splurge에서 옮겼습니다.',
            '갈래마다 목표를 적었습니다. Surge는 롤업 위 초당 10만 거래, Verge는 "SNARK 하나만 검증하면 끝"이 목표가 됐습니다.',
            '양자 내성 칸이 처음 등장했습니다.',
        ],
    },
    {
        date: '2023-12-30',
        kind: 'vitalik',
        title: '2023년판 로드맵 그림',
        url: 'https://x.com/VitalikButerin/status/1741190491578810445',
        changes: [
            'Scourge가 MEV를 넘어 리퀴드 스테이킹과 스테이킹 경제까지 다루게 넓어졌습니다.',
            'ePBS, 실행 티켓, 포함 목록(inclusion list)이 후보로 올랐고, 검증자 최대 잔고 상향이 들어갔습니다.',
            'Surge에 PeerDAS가 들어갔습니다.',
        ],
    },
    { date: '2024-03-13', kind: 'fork', title: 'Dencun', url: '/forks/dencun', fork: 'dencun', changes: ['Surge의 첫 조각인 블롭(EIP-4844)이 들어가 L2 수수료가 크게 내려갔습니다.'] },
    {
        date: '2024-10-14',
        kind: 'vitalik',
        title: '"Possible futures of the Ethereum protocol" 6부작',
        url: 'https://vitalik.eth.limo/general/2024/10/14/futures1.html',
        changes: [
            '10월 14일부터 29일까지 갈래 하나에 한 편씩, 목표와 남은 연구 문제를 정리했습니다. 새 그림 대신 2023년판을 기준으로 삼았습니다.',
            'Scourge 편은 ePBS를 "앞서 제안된 해법"으로 두고 FOCIL과 증인·제안자 분리(APS)를 함께 다룹니다.',
            'Verge 편은 Verkle 트리가 양자 컴퓨터에 약하다는 점을 들어, 이진 해시 트리와 STARK로 바로 가는 길도 열어 둡니다.',
        ],
    },
    {
        date: '2024-11-12',
        kind: 'drake',
        title: 'Beam Chain 제안 (Devcon 방콕)',
        url: 'https://www.youtube.com/watch?v=lRqnFrqpq4k',
        changes: [
            '비콘 체인을 고치는 대신 합의층을 새로 짓자는 제안입니다. 짧은 슬롯, 빠른 완결, 낮은 스테이킹 문턱, 체인 전체의 SNARK화, 양자 내성을 한 번에 노립니다.',
            '비탈릭은 블롭 확장 같은 단기 작업과 나란히 가는 장기 갈래로 설명했습니다.',
        ],
    },
    {
        date: '2025-05-03',
        kind: 'vitalik',
        title: '"Simplifying the L1"',
        url: 'https://vitalik.eth.limo/general/2025/05/03/simplel1.html',
        changes: ['합의층은 3슬롯 완결과 새 합의층 작업으로, 실행층은 EVM을 RISC-V 같은 단순한 명령어 집합으로 바꾸자는 방향으로 단순화를 제안했습니다.'],
    },
    {
        date: '2025-05-07',
        kind: 'fork',
        title: 'Pectra',
        url: '/forks/pectra',
        fork: 'pectra',
        changes: ['2023년판에 있던 검증자 최대 잔고 상향(EIP-7251)과, Splurge의 계정 추상화로 이어지는 EIP-7702가 들어갔습니다.'],
    },
    {
        date: '2025-06-02',
        kind: 'ef',
        title: 'EF Protocol 출범',
        url: 'https://blog.ethereum.org/2025/06/02/announcing-protocol',
        changes: ['이더리움 재단이 프로토콜 조직을 다시 짜고 세 목표를 내걸었습니다. L1 확장(Scale L1), 블롭 확장(Scale blobs), 사용자 경험 개선(Improve UX).'],
    },
    {
        date: '2025-07-31',
        kind: 'drake',
        title: 'Lean Ethereum',
        url: 'https://blog.ethereum.org/2025/07/31/lean-ethereum',
        changes: [
            'Beam Chain(상표 문제로 이름을 바꿈)을 세 층으로 넓혔습니다. 합의는 비콘 체인 2.0, 데이터는 양자 내성 블롭, 실행은 SNARK에 맞춘 최소 명령어 집합입니다.',
            '수치 목표를 처음 못 박았습니다. L1 초당 1기가가스(1만 TPS), L2 초당 1테라가스(1천만 TPS).',
            '국가나 양자 컴퓨터가 덤벼도 살아남아야 한다며 보안과 단순함을 성능만큼 앞세웠습니다.',
        ],
    },
    { date: '2025-12-03', kind: 'fork', title: 'Fusaka', url: '/forks/fusaka', fork: 'fusaka', changes: ['2023년판 Surge에 있던 PeerDAS가 들어갔습니다.'] },
    {
        date: '2026-02-18',
        kind: 'ef',
        title: 'EF 2026 우선순위',
        url: 'https://blog.ethereum.org/2026/02/18/protocol-priorities-update-2026',
        changes: ['L1과 블롭 확장을 Scale 하나로 합치고, L1 보안을 다지는 Harden the L1을 새 갈래로 세웠습니다.'],
    },
    {
        date: '2026-02-25',
        kind: 'ef',
        title: 'Strawmap 공개',
        url: 'https://x.com/drakefjustin/status/2026755969540108659',
        changes: [
            '2026년 1월 EF 워크숍의 토론 출발점에서 시작했습니다. Lean Ethereum을 당장의 포크 작업과 하나로 엮으려는 것이 목적입니다.',
            '2029년까지 약 6개월 간격의 포크 7개에 무엇이 들어갈지 그리고, 다섯 가지 목표(빠른 L1, 기가가스 L1, 테라가스 L2, 양자 내성, 프라이버시)를 내걸었습니다.',
            '스스로 "예측이 아니라 속도를 내기 위한 조율 도구"라고 밝힙니다. 큰 lean 합의층 교체는 L* 포크 자리에 둡니다.',
        ],
    },
    {
        date: '2026-09-27',
        kind: 'vitalik',
        title: '"The cryptographic world computer"',
        url: 'https://vitalik.eth.limo/general/2026/09/27/the_cryptographic_world_computer.html',
        changes: ['비탈릭이 앞으로의 이더리움을 "Strawmap을 따라 짓고 있는 lean Ethereum"이라고 부릅니다. 갈래 그림에서 시작한 로드맵이 Strawmap으로 모였다는 뜻입니다.'],
    },
], en);

export type PillarKey = 'merge' | 'surge' | 'scourge' | 'verge' | 'purge' | 'splurge';

export interface Pillar {
    key: PillarKey;
    name: string;
    goal: string;
    /** 판마다 뜻이 바뀐 과정 */
    shift: string;
    url: string;
}

export const PILLARS: Pillar[] = L([
    {
        key: 'merge',
        name: 'Merge',
        goal: '단순하고 견고하며 탈중앙화된 지분 증명. 한 슬롯 안의 완결, 누구나 할 수 있는 스테이킹, 51% 공격에서의 회복, 양자 내성.',
        shift: '2021년엔 "지분 증명으로 완전 전환"이었습니다. 2022년 머지가 끝난 뒤로는 그 지분 증명을 이상적인 모양으로 다듬는 갈래가 됐습니다.',
        url: 'https://vitalik.eth.limo/general/2024/10/14/futures1.html',
    },
    {
        key: 'surge',
        name: 'Surge',
        goal: 'L1과 L2를 합쳐 초당 10만 거래 이상. L1의 탈중앙성을 지키면서 데이터 가용성 샘플링, L2 간 상호운용, L1 실행 확장까지.',
        shift: '2021년엔 샤드 수를 늘리는 샤딩이었고, 2022년부터 블롭과 롤업 중심으로 바뀌었습니다. 2024년 연재부터는 L1 실행 확장도 이 갈래에 들어갑니다.',
        url: 'https://vitalik.eth.limo/general/2024/10/17/futures2.html',
    },
    {
        key: 'scourge',
        name: 'Scourge',
        goal: '블록 생산과 스테이킹 자본이 한곳에 쏠리는 위험을 줄이고, 사용자에게서 가치를 과하게 뽑아 가는 일을 막습니다.',
        shift: '2022년 11월 MEV 대책으로 새로 생겼고, 2023년판에서 리퀴드 스테이킹과 발행량까지 넓어졌습니다. ePBS는 이후 FOCIL, APS와 함께 다뤄집니다.',
        url: 'https://vitalik.eth.limo/general/2024/10/20/futures3.html',
    },
    {
        key: 'verge',
        name: 'Verge',
        goal: '스마트워치로도 체인 전체를 검증. 노드가 상태를 들고 있지 않아도 되고, 결국 증명 하나만 확인하면 끝나게 합니다.',
        shift: '2021년엔 Verkle 트리로 무상태를 이루는 길이었습니다. 2022년부터 SNARK 검증이 목표가 됐고, 2024년엔 Verkle 대신 이진 트리와 STARK로 가는 길이 열렸습니다.',
        url: 'https://vitalik.eth.limo/general/2024/10/23/futures4.html',
    },
    {
        key: 'purge',
        name: 'Purge',
        goal: '모든 노드가 옛 기록과 상태를 영원히 보관할 필요를 줄이고, 쓰지 않는 기능을 걷어 내 프로토콜을 단순하게 만듭니다.',
        shift: '처음부터 뜻이 거의 그대로인 갈래입니다. 2023년판에서 상태 만료가 먼 장기 과제로 밀렸습니다.',
        url: 'https://vitalik.eth.limo/general/2024/10/26/futures5.html',
    },
    {
        key: 'splurge',
        name: 'Splurge',
        goal: 'EVM을 끝 모양으로 다듬고, 계정 추상화를 프로토콜에 넣고, 수수료 구조를 고치는 등 나머지 개선을 모읍니다.',
        shift: '2021년엔 PBS와 MEV까지 담은 "그 밖의 것" 칸이었습니다. 2022년 MEV가 Scourge로 빠지고 계정 추상화가 중심이 됐습니다.',
        url: 'https://vitalik.eth.limo/general/2024/10/29/futures6.html',
    },
], en);

/** Strawmap 항목(itemSlug) → 비탈릭 갈래. 갈래에 딱 맞지 않는 항목(프라이버시, 명세·네트워크 작업 등)은 넣지 않는다 */
export const ITEM_PILLAR: Record<string, PillarKey> = {
    // 합의
    epbs: 'scourge',
    'fast-confirmation': 'merge',
    focil: 'scourge',
    'quick-slots': 'merge',
    'post-quantum-registrations': 'merge',
    'decoupled-consensus': 'merge',
    'tapered-issuance-burn': 'scourge',
    'leanxmss-pq-attestations': 'merge',
    '1-round-finality': 'merge',
    'attester-proposer-separation': 'scourge',
    'tech-debt-reset': 'purge',
    'real-time-cl-asm-proofs': 'verge',
    'return-to-1m-attesters': 'merge',
    'distributed-block-building': 'scourge',
    '51-attack-auto-recovery': 'merge',
    'secret-proposers': 'merge',
    // 데이터
    'sparse-blobpool': 'surge',
    'cell-level-deltas': 'surge',
    'distributed-blob-reconstruction': 'surge',
    'leanda-pq-sampling': 'surge',
    'remove-blob-transactions': 'surge',
    'blob-streaming': 'surge',
    'proofs-of-custody': 'surge',
    'short-dated-blob-futures': 'surge',
    'leanvm-pq-proofs': 'verge',
    // 실행
    bals: 'surge',
    'glamsterdam-repricing': 'surge',
    'evm-asm-canonical-guest': 'verge',
    'frame-transactions': 'splurge',
    'fast-payload-broadcast': 'surge',
    'data-repricing': 'surge',
    'transaction-assertions': 'splurge',
    'optional-proofs': 'verge',
    'state-asm': 'verge',
    'partitioned-binary-tree': 'verge',
    'multidimensional-pricing': 'splurge',
    'pureth-purges': 'purge',
    'payload-sampling': 'surge',
    'evmify-long-tail-precompiles': 'purge',
    'validity-only-partial-state': 'verge',
    'mandatory-1-of-1-proofs': 'verge',
    'decentralized-state': 'verge',
    'native-rollups': 'surge',
    'sharded-mempool': 'surge',
    'encrypted-mempool': 'scourge',
};

export const pillarOf = (slug: string): Pillar | undefined => PILLARS.find((p) => p.key === ITEM_PILLAR[slug]);
