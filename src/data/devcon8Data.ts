/**
 * Devcon 8 (뭄바이, 2026.11.03~11.06) 현장 리포트.
 * 발표 요약은 Ethereum TV 녹화 페이지, 일정·다음 행사는 devcon.org, 업그레이드 소식은 EF 블로그에서 확인한 것만 싣는다.
 * ponytail: 한국어 본문만 있다. 영어판은 english-content-todo 와 함께 처리
 * 발표 흐름(flow)·길이와 추가 발표 8개는 devcon8-talks.json (Ethereum TV 대본을 읽고 정리, 전문 번역 아님)
 */
import extra from './devcon8-talks.json';

export type Devcon8Topic = 'ai' | 'privacy' | 'pq' | 'scale' | 'roadmap' | 'ecosystem';

export const TOPIC_LABEL: Record<Devcon8Topic, string> = {
    ai: 'AI·보안',
    privacy: '프라이버시',
    pq: '포스트퀀텀',
    scale: '속도·확장',
    roadmap: '로드맵',
    ecosystem: '생태계',
};

export interface Devcon8Talk {
    id: string;
    date: string;
    topic: Devcon8Topic;
    speakers: string;
    title: string;
    titleEn: string;
    summary: string;
    points: string[];
    videos: { label: string; url: string }[];
    /** 썸네일용 YouTube 영상 ID (Ethereum TV 녹화 원본) */
    youtubeId: string;
    /** 영상 길이 (mm:ss) */
    duration?: string;
    /** 발표 흐름: 대본을 읽고 ECK가 구간별로 요약한 것 (전문 번역 아님) */
    flow?: { heading: string; body: string }[];
}

const TV = 'https://ethereumtv.co/talks/';

const BASE_TALKS: Devcon8Talk[] = [
    {
        id: 'opening-keynote',
        youtubeId: 'nUFLz-o1YVY',
        date: '11.03',
        topic: 'ai',
        speakers: '비탈릭 부테린',
        title: '개막 키노트: 열려 있고 안전하며 검증할 수 있는 미래',
        titleEn: 'The Open Secure and Verifiable Half to a Brighter Future',
        summary:
            'AI가 소프트웨어 보안과 기기 프라이버시, 개인정보에 대한 기존 전제를 흔들고 있다고 진단했습니다. 소수가 기술을 독점하는 흐름이 기본 경로가 되어 가고 있으니, 개방적이고 검증 가능한 기술로 방어하는 방어적 탈중앙 가속(d/acc)이 필요하다는 주장입니다.',
        points: [
            '앞으로의 경로를 감속, 단일 집단의 지배, 파멸 셋으로 나누고 지배가 기본 경로라고 진단',
            '검증된 운영체제, 오픈 하드웨어, 헬스 기기, 사적 통신, 신뢰할 수 있는 AI를 구체적 방향으로 제시',
            '원격 AI에 보내는 민감한 정보는 로컬 모델로 보호하고, 데이터는 기본적으로 위험 물질처럼 다루자고 제안',
        ],
        videos: [{ label: '영상 보기', url: `${TV}the-open-secure-and-verifiable-half-to-a-brighter-future` }],
    },
    {
        id: 'agents-trust',
        youtubeId: 'ksgFwdyjqlg',
        date: '11.03',
        topic: 'ai',
        speakers: '비탈릭 부테린 · 오드리 탕',
        title: 'AI 에이전트는 열린 환경에서 안전할 수 있을까',
        titleEn: 'Can Agents Be Safe in the Open? Two Levels of Trust',
        summary:
            '대만 초대 디지털부 장관을 지낸 오드리 탕과의 대담입니다. 이더리움의 첫째 과제는 살아남는 것이고, 그 핵심은 보안과 프라이버시, 오픈소스라는 이야기로 시작했습니다.',
        points: [
            '힘 있는 쪽에는 투명성을, 약한 쪽에는 프라이버시를 더 주자는 원칙',
            '수집한 데이터는 이미 유출됐다고 가정하고, 증명만 공개하는 방식이 책임성을 높인다는 시각',
            'AI 에이전트가 공동 자금을 운용할 때의 정렬 문제는 아직 미해결, 멀티시그처럼 단일 AI 통제를 피하는 구조를 대안으로 언급',
        ],
        videos: [{ label: '영상 보기', url: `${TV}can-agents-be-safe-open-two-levels-trust-buterin-tang` }],
    },
    {
        id: 'kohaku',
        youtubeId: 'roYQfAuJ2Jc',
        date: '11.03',
        topic: 'privacy',
        speakers: '비탈릭 부테린 · 니콜라 콩시니(Nicolas Consigny)',
        title: 'Kohaku: 모두를 위한 기본값 프라이버시',
        titleEn: 'Kohaku: privacy for everyone, by default',
        summary:
            '지갑이 별도 설정 없이도 프라이버시를 제공하도록 돕는 Kohaku SDK와 CLI를 소개하고 라이브 데모를 진행했습니다.',
        points: [
            'Railgun, Privacy Pools 같은 프라이버시 프로토콜을 지갑에 바로 붙이는 구조',
            '라이트 클라이언트 연동으로 RPC 제공자에게 의존하지 않는 조회',
            'TEE와 PIR을 이용해 무엇을 조회하는지 드러나지 않게 하는 사적 조회',
        ],
        videos: [{ label: '영상 보기', url: `${TV}kohaku-privacy-for-everyone-by-default` }],
    },
    {
        id: 'post-quantum',
        youtubeId: 'rqJ5ir-8hAQ',
        date: '11.03',
        topic: 'pq',
        speakers: '저스틴 드레이크 · 케브(Kev)',
        title: '포스트퀀텀 전환과 Mission 2028',
        titleEn: 'Post-Quantum Transition',
        summary:
            '양자컴퓨터가 암호를 깰 수 있는 시점이 앞당겨졌고 AI가 새로운 해독법을 찾을 가능성도 있다며, 이더리움 전체를 2028년 12월까지 양자내성 방식으로 옮기자는 Mission 2028을 제시했습니다. 이더리움 재단의 공식 목표는 2029년 12월이어서, 공식 일정 변경이라기보다 앞당기자는 제안에 가깝습니다.',
        points: [
            '실행·합의·데이터 세 계층 모두에 양자내성 트랜잭션, 어테스테이션, 데이터 샘플링을 도입',
            '서명 교체 계획: ECDSA는 leanSPHINCS, BLS는 leanXMSS, KZG는 leanDA로',
            '이어진 Q&A에서 양자 위협 최초 가능 시점 추정을 2032년에서 2029년으로 앞당김',
            '전환의 병목은 기술이 아니라 약 10개월에 한 번인 하드포크 조율이라고 지적',
        ],
        videos: [
            { label: '발표 영상', url: `${TV}post-quantum-transition` },
            { label: 'Q&A 영상', url: `${TV}pq-ethereum-q-drake` },
        ],
    },
    {
        id: 'fast-ethereum',
        youtubeId: 'zfaghEoRxFs',
        date: '11.04',
        topic: 'scale',
        speakers: '바르나베 모노(Barnabé Monnot)',
        title: '빠른 이더리움',
        titleEn: 'Fast Ethereum',
        summary: '블록 시간과 파이널리티를 어떤 순서로 줄여 갈지 일정과 함께 설명했습니다.',
        points: [
            '슬롯 시간을 2027년 12초에서 10초로, 이후 8초 안팎까지 단축',
            '파이널리티는 2028년까지 약 15분에서 1~2분으로, 장기적으로 10~20초가 목표',
            '13~24초 만에 확정 여부를 판단하는 빠른 확인 규칙(fast confirmation rule)은 이미 사용 중',
        ],
        videos: [{ label: '영상 보기', url: `${TV}fast-ethereum-monnot` }],
    },
    {
        id: 'roadmap-simplified',
        youtubeId: 'hT_3nh7m7J8',
        date: '11.04',
        topic: 'roadmap',
        speakers: 'Cheeky Gorilla (Protocol Guild)',
        title: '쉽게 보는 이더리움 로드맵',
        titleEn: "Ethereum's Roadmap, Simplified",
        summary: '다음 두 하드포크인 글램스테르담과 헤고타에 무엇이 들어가는지 한 번에 정리한 발표입니다.',
        points: [
            '글램스테르담: ePBS와 블록 단위 접근 목록(BAL), 가스 한도 상향이 핵심',
            '헤고타: FOCIL과 프레임 트랜잭션(네이티브 계정 추상화), 양자내성 키 등록',
            '헤고타 2027년 8월 목표는 스스로도 매우 야심 찬 일정이라고 언급',
        ],
        videos: [{ label: '영상 보기', url: `${TV}ethereums-roadmap-simplified-what-changes-next-why-gorilla` }],
    },
    {
        id: 'kernel-funding',
        youtubeId: 'UVRtCZlpL_w',
        date: '11.03',
        topic: 'ecosystem',
        speakers: '마틴 한센(Martin Hansen) · 이더리움 재단',
        title: '이더리움 핵심 인프라에 누가, 얼마나 돈을 댈까',
        titleEn: 'Funding the Ethereum Kernel',
        summary:
            '클라이언트처럼 이더리움이 돌아가는 데 꼭 필요한 핵심 인프라를 어디까지로 볼지, 여기에 중립적인 자금이 최소 얼마나 필요한지 추정했습니다.',
        points: [
            '우선순위가 높은 항목부터 차례로 채우는 폭포(waterfall)식 배분 모델을 제안',
            '관련 내용을 이더리움 재단 블로그에 따로 정리할 예정',
        ],
        videos: [{ label: '영상 보기', url: `${TV}funding-the-ethereum-kernel-what-qualifies-what-it-costs-what-goes-first` }],
    },
    {
        id: 'robotics',
        youtubeId: 'Mr1NbeYPFWg',
        date: '11.04',
        topic: 'ecosystem',
        speakers: '토마스 스탄치크',
        title: '이더리움과 로보틱스',
        titleEn: 'Ethereum X Robotics',
        summary:
            '이더리움 재단 공동 대표에서 물러난 뒤 로봇 회사를 이끌고 있는 스탄치크가, 이더리움을 물리 세계에서 움직이는 AI의 조율 계층으로 쓰는 구상을 밝혔습니다.',
        points: [],
        videos: [{ label: '영상 보기', url: `${TV}ethereum-x-robotics-bansal-stanczak` }],
    },
];

type ExtraTalk = Partial<Devcon8Talk> & Pick<Devcon8Talk, 'id' | 'youtubeId'> & { slug: string };
const EXTRA = extra.talks as ExtraTalk[];
const extraById = new Map(EXTRA.map((t) => [t.id, t]));

const ADDED_TALKS: Devcon8Talk[] = EXTRA.filter((t) => t.title).map((t) => ({
    ...(t as Devcon8Talk),
    videos: [{ label: '영상 보기', url: `${TV}${t.slug}` }],
}));

// 날짜순 정렬 (같은 날은 적은 순서 유지)
export const DEVCON8_TALKS: Devcon8Talk[] = [
    ...BASE_TALKS.map((t) => ({ ...t, duration: extraById.get(t.id)?.duration, flow: extraById.get(t.id)?.flow })),
    ...ADDED_TALKS,
].sort((x, y) => x.date.localeCompare(y.date));

/** 행사 기간에 나온 공식 소식 (1차 출처 확인분만) */
export const DEVCON8_NEWS = [
    {
        title: '글램스테르담 일정 추가 연기',
        body: '가스 재가격 EIP-8037과 8038이 기존 컨트랙트가 기대는 불변식 8개를 깬다는 사실이 확인되어, 문제가 해결될 때까지 후디 테스트넷 포크를 진행하지 않기로 했습니다. 새 날짜는 아직 없고, 헤고타 작업은 영향을 받지 않습니다.',
        source: { label: 'EF 블로그', url: 'https://blog.ethereum.org/2026/11/06/glamsterdam-8037-8038' },
    },
    {
        title: '이더리움 재단 공공부문 사이트 공개',
        body: '정부와 공공기관을 위한 안내 사이트를 열고, 부탄 국가 디지털 ID와 인도주의 지원 시범 사례를 소개했습니다.',
        source: { label: 'EF 블로그', url: 'https://blog.ethereum.org/2026/11/03/digital-pub-infra' },
    },
];

/** 더 볼 만한 세션 */
export const DEVCON8_MORE = [
    { title: 'Paths to a Private L1', url: `${TV}paths-to-a-private-l1` },
    { title: 'Glamsterdam Hard Fork: Out of gas, still running', url: `${TV}glamsterdam-hard-fork-out-gas-still-running-sachinoglou` },
    { title: "Glamsterdam for App Developers", url: `${TV}glamsterdam-app-developers-what-ethereums-next-fork-kothari` },
    { title: 'Tragedy of the Ethereum Security Commons', url: `${TV}tragedy-ethereum-security-commons-feist-green` },
];

const IMG = '/assets/events/devcon8';

/** 이미지 출처: 키 비주얼·리스본 = devcon.org 공식 OG·로고, 비탈릭 사진 = ECK 텔레그램 tg-1727 게시 이미지 */
export const DEVCON8_IMAGES = {
    keyVisual: `${IMG}/key-visual.webp`,
    vitalik: `${IMG}/vitalik-cloak.webp`,
    lisbon: `${IMG}/lisbon.webp`,
};

export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const DEVCON8_LINKS = {
    allVideos: 'https://ethereumtv.co/events/devcon-8-india',
    official: 'https://devcon.org/en/',
    lisbon: 'https://devcon.org/lisbon/',
};
