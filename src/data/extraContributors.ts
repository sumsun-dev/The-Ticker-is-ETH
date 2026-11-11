import type { TeamMember } from '../types/team';
import en from './en/extraContributors.json';
import { L } from '../utils/lang';

// 텔레그램 기록 밖에서 손으로 넣은 기여자. mockData(팀 화면)와 teamAvatars(홈)가 같이 쓴다
export const extraContributors: (TeamMember & { category: string })[] = L([
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
        bio: 'ECK(Ethereum Collective Korea) 커뮤니티 기여자입니다.',
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
                link: '/contents/tg-1189',
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
                link: '/contents/tg-1185',
            },
            {
                id: 'tg-1186',
                date: '2026-03-01',
                type: 'telegram' as const,
                content: '이번에 새로운 필진으로 합류하게 된 문보설이라고 합니다.',
                link: '/contents/tg-1186',
            },
        ],
        bio: 'Ethereum Foundation의 geth 팀에서 개발자로 일하고 있습니다. 관심 분야는 L1 스케일링 및 p2p network입니다.',
        memberType: 'contributor' as const,
        category: 'Content',
        social: { twitter: 'https://x.com/1004yukichan' },
    },
], en);
