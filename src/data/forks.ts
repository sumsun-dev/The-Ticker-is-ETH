/**
 * 하드포크 연대기 (/forks). 지난 포크는 손으로 정리하고, 다가오는 포크의 EIP 상태는 eth-calls.json 결정으로 화면에서 계산한다.
 * 출처: 각 포크 메타 EIP, ethereum.org/history, Strawmap(2026-11-02 갱신본).
 */
import en from './en/forks.json';
import { L } from '../utils/lang';

export interface ForkEip {
    number: number;
    /** 한 줄 설명. 해설(eips.json)이 있으면 화면은 해설 제목을 먼저 쓴다 */
    note: string;
}

export interface Fork {
    slug: string;
    name: string;
    /** 실행·합의 포크 이름 등 */
    alias?: string;
    /** 메인넷 적용일(UTC). 다가오는 포크는 null */
    date: string | null;
    /** Strawmap 기준 예상 시점 (다가오는 포크만) */
    target?: string;
    meta?: number;
    /** 연대기 기본 보기에 넣을 큰 포크 */
    major: boolean;
    summary: string;
    headliners?: ForkEip[];
    eips: ForkEip[];
    /** eth-calls.json decisions[].fork 값 (다가오는 포크만) */
    callFork?: string;
    stage?: '범위 논의' | '구현·테스트' | '메인넷 일정 확정';
}

const e = (number: number, note: string): ForkEip => ({ number, note });

/** 최신 포크가 앞 */
export const FORKS: Fork[] = L([
    {
        slug: 'hegota',
        name: 'Hegotá',
        date: null,
        target: '2027 (Strawmap 기준)',
        meta: 8081,
        major: true,
        summary: '검열을 막는 포함 목록(FOCIL)과 계정 추상화를 기본 거래 형식으로 넣는 프레임 트랜잭션이 헤드라이너입니다.',
        headliners: [e(7805, 'FOCIL: 여러 검증자가 꼭 넣어야 할 거래 목록을 내 빌더의 검열을 막습니다'), e(8141, '프레임 트랜잭션: 계정 추상화를 프로토콜 기본 거래로')],
        eips: [],
        callFork: 'Hegota',
        stage: '범위 논의',
    },
    {
        slug: 'glamsterdam',
        name: 'Glamsterdam',
        alias: 'Amsterdam(실행) + Gloas(합의)',
        date: null,
        target: '2027년 초 (Strawmap 기준)',
        meta: 7773,
        major: true,
        summary: '블록을 짓는 빌더와 고르는 검증자의 역할을 프로토콜 안에서 나누고(ePBS), 블록이 건드릴 상태를 미리 적어 병렬 실행의 길을 엽니다(BAL).',
        headliners: [e(7732, 'ePBS: 제안자와 빌더의 역할을 프로토콜 안에서 분리'), e(7928, 'BAL: 블록 수준 접근 목록으로 병렬 실행·검증')],
        // 메타 EIP-7773의 포함 확정(SFI) 목록
        eips: [
            e(7732, '제안자·빌더 분리'), e(7928, '블록 수준 접근 목록'), e(8282, '빌더 실행 요청'), e(2780, '자원 기반 거래 기본 가스'),
            e(7778, '환급 없는 블록 가스 회계'), e(7976, '콜데이터 최저 비용 인상'), e(7981, '접근 목록 비용 인상'), e(8037, '상태 생성 가스 인상'),
            e(8038, '상태 접근 가스 갱신'), e(7708, 'ETH 전송 로그'), e(7843, 'SLOTNUM 옵코드'), e(7954, '컨트랙트 최대 크기 상향'),
            e(8024, 'SWAPN·DUPN·EXCHANGE'), e(7997, '결정적 팩토리 컨트랙트'), e(8246, 'SELFDESTRUCT 소각 제거'), e(7688, '전방 호환 합의 데이터 구조'),
            e(8045, '슬래싱된 검증자 제안 제외'), e(8061, '탈퇴·통합 처리 한도 상향'),
        ],
        callFork: 'Glamsterdam',
        stage: '구현·테스트',
    },
    {
        slug: 'fusaka', name: 'Fusaka', alias: 'Osaka(실행) + Fulu(합의)', date: '2025-12-03', meta: 7607, major: true,
        summary: '노드가 블롭 데이터를 전부 받지 않고 일부만 표본으로 확인하는 PeerDAS로 L2가 쓸 데이터 공간을 크게 늘렸습니다. 이후 블롭 수만 올리는 BPO 포크로 공간을 단계적으로 넓힙니다.',
        eips: [e(7594, 'PeerDAS: 블롭 데이터 표본 확인'), e(7892, 'BPO: 블롭 수만 바꾸는 소규모 포크'), e(7825, '거래 가스 한도 상한'), e(7951, 'secp256r1 서명 검증 프리컴파일'), e(7939, 'CLZ 명령어')],
    },
    {
        slug: 'pectra', name: 'Pectra', alias: 'Prague(실행) + Electra(합의)', date: '2025-05-07', meta: 7600, major: true,
        summary: '일반 지갑(EOA)이 스마트 계정처럼 동작하게 하고, 검증자 한 명이 맡을 수 있는 스테이킹 한도를 32 ETH에서 2048 ETH로 올렸습니다.',
        eips: [e(7702, 'EOA에 코드 설정 (스마트 계정 기능)'), e(7251, '검증자 최대 유효 잔고 상향'), e(7691, '블롭 처리량 상향'), e(7002, '실행 계층에서 검증자 탈퇴 요청'), e(2537, 'BLS12-381 프리컴파일')],
    },
    {
        slug: 'dencun', name: 'Dencun', alias: 'Cancun(실행) + Deneb(합의)', date: '2024-03-13', meta: 7569, major: true,
        summary: '롤업이 데이터를 싸게 올리는 블롭을 도입해 L2 수수료를 크게 낮췄습니다.',
        eips: [e(4844, '블롭 거래 (프로토 댕크샤딩)'), e(1153, '임시 저장소 옵코드'), e(4788, '비콘 블록 루트를 EVM에서 조회'), e(6780, 'SELFDESTRUCT 동작 축소'), e(5656, 'MCOPY 옵코드')],
    },
    {
        slug: 'shapella', name: 'Shapella', alias: 'Shanghai(실행) + Capella(합의)', date: '2023-04-12', major: true,
        summary: '스테이킹한 ETH와 보상을 출금할 수 있게 됐습니다.',
        eips: [e(4895, '비콘 체인 출금'), e(3651, 'COINBASE 주소 접근 비용 인하'), e(3855, 'PUSH0 옵코드'), e(3860, 'initcode 크기 제한')],
    },
    {
        slug: 'the-merge', name: '더 머지', alias: 'Paris(실행) + Bellatrix(합의)', date: '2022-09-15', major: true,
        summary: '작업 증명 채굴을 끝내고 지분 증명으로 옮겼습니다. 이더리움의 에너지 사용이 99% 넘게 줄었습니다.',
        eips: [e(3675, '지분 증명 전환'), e(4399, 'DIFFICULTY 옵코드를 PREVRANDAO로')],
    },
    { slug: 'gray-glacier', name: 'Gray Glacier', date: '2022-06-30', major: false, summary: '난이도 폭탄을 늦췄습니다.', eips: [e(5133, '난이도 폭탄 연기')] },
    { slug: 'arrow-glacier', name: 'Arrow Glacier', date: '2021-12-09', major: false, summary: '난이도 폭탄을 늦췄습니다.', eips: [e(4345, '난이도 폭탄 연기')] },
    { slug: 'altair', name: 'Altair', alias: '비콘 체인', date: '2021-10-27', major: false, summary: '비콘 체인의 첫 업그레이드입니다. 싱크 위원회로 가벼운 클라이언트를 지원하고 비활동 페널티를 손봤습니다.', eips: [] },
    {
        slug: 'london', name: 'London', date: '2021-08-05', major: true,
        summary: '수수료를 기본 수수료와 팁으로 나누고 기본 수수료를 태우기 시작했습니다. 수수료 예측이 쉬워지고 ETH 발행량이 상쇄되기 시작했습니다.',
        eips: [e(1559, '수수료 시장 개편과 기본 수수료 소각'), e(3198, 'BASEFEE 옵코드'), e(3529, '가스 환급 축소'), e(3541, '0xEF로 시작하는 코드 배포 거부'), e(3554, '난이도 폭탄 연기')],
    },
    { slug: 'berlin', name: 'Berlin', date: '2021-04-15', meta: 2070, major: false, summary: '상태 접근 가스 비용을 조정하고, 여러 거래 형식을 담을 수 있는 틀(타입 거래)을 만들었습니다.', eips: [e(2929, '상태 접근 가스 인상'), e(2718, '타입 거래 봉투'), e(2930, '접근 목록 거래'), e(2565, 'MODEXP 비용 인하')] },
    { slug: 'beacon-chain', name: '비콘 체인 출범', date: '2020-12-01', major: true, summary: '지분 증명 합의 체인이 메인넷과 따로 돌기 시작했습니다. 2년 뒤 더 머지에서 합쳐집니다.', eips: [] },
    { slug: 'muir-glacier', name: 'Muir Glacier', date: '2020-01-02', meta: 2387, major: false, summary: '난이도 폭탄을 늦췄습니다.', eips: [e(2384, '난이도 폭탄 연기')] },
    { slug: 'istanbul', name: 'Istanbul', date: '2019-12-08', meta: 1679, major: false, summary: '가스 비용을 조정하고 체인 ID 옵코드와 프리컴파일 가격 인하를 넣었습니다.', eips: [e(1344, 'CHAINID 옵코드'), e(1884, '상태 읽기 옵코드 가격 조정'), e(2028, '콜데이터 비용 인하'), e(1108, 'alt_bn128 프리컴파일 인하')] },
    { slug: 'constantinople', name: 'Constantinople', alias: 'Petersburg 포함', date: '2019-02-28', meta: 1013, major: false, summary: '주소를 미리 정할 수 있는 CREATE2와 비트 시프트 옵코드를 넣고, 블록 보상을 2 ETH로 줄였습니다.', eips: [e(1014, 'CREATE2'), e(145, '비트 시프트 옵코드'), e(1052, 'EXTCODEHASH'), e(1234, '난이도 폭탄 연기와 보상 축소')] },
    { slug: 'byzantium', name: 'Byzantium', date: '2017-10-16', meta: 609, major: false, summary: '영지식 증명 검증 프리컴파일과 REVERT를 넣고 블록 보상을 3 ETH로 줄였습니다.', eips: [e(140, 'REVERT'), e(196, 'alt_bn128 덧셈·곱셈'), e(197, 'alt_bn128 페어링'), e(649, '난이도 폭탄 연기와 보상 축소')] },
    { slug: 'spurious-dragon', name: 'Spurious Dragon', date: '2016-11-22', meta: 607, major: false, summary: '서명에 체인 ID를 넣어 다른 체인에서의 재사용(리플레이)을 막고, 빈 계정을 정리했습니다.', eips: [e(155, '리플레이 공격 방지'), e(161, '빈 계정 정리'), e(170, '컨트랙트 코드 크기 제한')] },
    { slug: 'tangerine-whistle', name: 'Tangerine Whistle', date: '2016-10-18', meta: 608, major: false, summary: 'DoS 공격에 악용되던 옵코드의 가스 비용을 올렸습니다.', eips: [e(150, 'I/O 옵코드 가스 인상')] },
    { slug: 'dao-fork', name: 'DAO 포크', date: '2016-07-20', meta: 779, major: false, summary: 'The DAO 해킹으로 빠져나간 자금을 돌려주는 상태 변경입니다. 반대한 쪽은 이더리움 클래식으로 남았습니다.', eips: [] },
    { slug: 'homestead', name: 'Homestead', date: '2016-03-14', meta: 606, major: true, summary: '출범 뒤 첫 프로덕션 업그레이드입니다. 거래 서명 규칙과 가스 계산을 다듬었습니다.', eips: [e(2, 'Homestead 규칙 변경'), e(7, 'DELEGATECALL'), e(8, 'devp2p 전방 호환성')] },
    { slug: 'frontier', name: 'Frontier', date: '2015-07-30', major: true, summary: '이더리움 메인넷 출범입니다.', eips: [] },
], en);

export const forkBySlug = (slug: string) => FORKS.find((f) => f.slug === slug);
