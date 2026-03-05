import type { TeamMember, Activity, Contribution } from '../types/team';
import { formatDate, isStillActive } from '../utils/telegram';
import rawEnrichment from './team-enrichment.json';
import rawCoreTeam from './team-core.json';

// --- Enrichment JSON 타입 ---

interface EnrichedContributor {
    name: string;
    messageCount: number;
    firstMessageDate: string;
    lastMessageDate: string;
    contributionMap: Record<string, number>;
    recentActivity: Activity[];
}

interface TeamEnrichment {
    channel: string;
    contributors: EnrichedContributor[];
}

const enrichmentData = rawEnrichment as unknown as TeamEnrichment;

// --- Sparse contributionMap → Contribution[] 변환 ---

function expandContributions(
    map: Record<string, number>,
    firstDate: Date,
): Contribution[] {
    const totalDays = Math.ceil(
        (Date.now() - firstDate.getTime()) / (24 * 60 * 60 * 1000),
    ) + 1;

    return Array.from({ length: totalDays }, (_, i) => {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        return { date: d.toISOString(), count: map[key] ?? 0 };
    });
}

// --- Enrichment 데이터 헬퍼 ---

function findEnrichedContributor(name: string): EnrichedContributor | undefined {
    const nameMap: Record<string, string> = {
        'Sose': 'sose',
    };
    const tgName = nameMap[name] ?? name;
    return enrichmentData.contributors.find(
        c => c.name.toLowerCase() === tgName.toLowerCase()
    );
}

// --- Core Team 멤버 (JSON에서 로드) ---

const rawMembers: TeamMember[] = (rawCoreTeam as Array<Omit<TeamMember, 'contributions' | 'recentActivity'>>).map(m => ({
    ...m,
    contributions: [],
    recentActivity: [],
}));

// Enrichment 데이터 매핑 (contributions/recentActivity만 반영, period/isCurrent는 원본 고정)
export const mockMembers: TeamMember[] = rawMembers.map(member => {
    const enriched = findEnrichedContributor(member.name);
    if (!enriched) return member;

    const contributions = expandContributions(enriched.contributionMap, new Date(enriched.firstMessageDate));

    return {
        ...member,
        contributions,
        recentActivity: enriched.recentActivity,
    };
});

const coreByName = new Map(rawMembers.map(m => [m.name.toLowerCase(), m]));

function telegramToContributors(): (TeamMember & { category: string })[] {
    return enrichmentData.contributors.map((contributor) => {
        const slug = contributor.name.toLowerCase().replace(/\s+/g, '-');
        const contributions = expandContributions(contributor.contributionMap, new Date(contributor.firstMessageDate));
        const active = isStillActive(contributor.lastMessageDate);
        const endDate = active ? 'Present' : formatDate(contributor.lastMessageDate);
        const period = `${formatDate(contributor.firstMessageDate)} - ${endDate}`;

        return {
            id: `tg-${slug}`,
            name: contributor.name,
            role: 'Content Creator',
            period,
            isCurrent: active,
            avatarUrl: `/assets/team/${contributor.name.toLowerCase()}.jpg`,
            contributions,
            recentActivity: contributor.recentActivity,
            bio: `${enrichmentData.channel} 채널에서 ${Math.round(contributor.messageCount)}개의 메시지를 작성한 기여자입니다.`,
            memberType: 'contributor' as const,
            category: 'Content',
            social: {
                telegram: `https://t.me/${enrichmentData.channel}`,
            },
        };
    });
}

// Core Team 멤버가 컨트리뷰터에도 포함될 때, bio/social/avatar만 동기화 (period/isCurrent는 텔레그램 활동 기준 유지)
const telegramContributors = telegramToContributors().map(tc => {
    const core = coreByName.get(tc.name.toLowerCase());
    if (!core) return tc;
    return {
        ...tc,
        bio: core.bio,
        social: core.social,
        avatarUrl: core.avatarUrl,
        highlights: core.highlights,
    };
});

export const mockContributors: (TeamMember & { category: string })[] = [
    {
        id: 'gen-1',
        name: 'Gen',
        role: 'Contributor',
        period: '2026.01.24 - Present',
        isCurrent: false,
        avatarUrl: '/assets/contributors/gen.jpg',
        contributions: Array.from({ length: 140 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            count: 0,
        })),
        recentActivity: [],
        bio: 'The Ticker is ETH 커뮤니티 기여자입니다.',
        memberType: 'contributor' as const,
        category: 'Content',
        social: { website: 'https://maily.so/asthedaysgoby' },
    },
    {
        id: 'wonjae-1',
        name: 'Wonjae',
        role: 'Contributor',
        period: '2026.02.24 - Present',
        isCurrent: true,
        avatarUrl: '/assets/contributors/wonjae.jpg',
        contributions: [{ date: '2026-03-01', count: 1 }],
        recentActivity: [
            {
                id: 'tg-1189',
                date: '2026-03-01',
                type: 'telegram' as const,
                content: '안녕하세요, 저는 The ticker is ETH 채널에 컨트리뷰터로 참여하게된 최원재라고 합니다.',
                link: '/research/tg-1189',
            },
        ],
        bio: '서울대학교 전기정보공학부에서 박사과정을 하고 있습니다. 주 연구분야는 zk, compiler, security & privacy입니다.',
        memberType: 'contributor' as const,
        category: 'Content',
        social: { twitter: 'https://x.com/0xwonj', github: 'https://github.com/0xwonj' },
    },
    {
        id: 'bosul-mun-1',
        name: 'Bosul Mun',
        role: 'Contributor',
        period: '2026.02.24 - Present',
        isCurrent: true,
        avatarUrl: '/assets/contributors/bosul-mun.jpg',
        contributions: [{ date: '2026-03-01', count: 2 }],
        recentActivity: [
            {
                id: 'tg-1185',
                date: '2026-03-01',
                type: 'telegram' as const,
                content: 'EL Headliner, 각 클라이언트의 입장을 알아보자',
                link: '/research/tg-1185',
            },
            {
                id: 'tg-1186',
                date: '2026-03-01',
                type: 'telegram' as const,
                content: '이번에 새로운 필진으로 합류하게 된 문보설이라고 합니다.',
                link: '/research/tg-1186',
            },
        ],
        bio: 'Ethereum Foundation의 geth 팀에서 개발자로 일하고 있습니다. 관심 분야는 L1 스케일링 및 p2p network입니다.',
        memberType: 'contributor' as const,
        category: 'Content',
        social: { twitter: 'https://x.com/1004yukichan' },
    },
    ...telegramContributors.filter(tc =>
        !['gen', 'wonjae', 'bosul mun'].includes(tc.name.toLowerCase()),
    ),
];
