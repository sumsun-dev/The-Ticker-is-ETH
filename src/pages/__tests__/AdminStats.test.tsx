import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import AdminStats from '../AdminStats';
import { renderWithProviders } from '../../test/helpers/render';
import type { StatsHistory } from '../../types/adminStats';

vi.mock('../../data/researchData', () => ({
    loadResearchIndex: vi.fn().mockResolvedValue([{ id: 'tg-3', thumbnailUrl: 'https://r2.dev/telegram/tg-3.jpg', author: 'sose', authorAvatar: '' }]),
}));

const site = {
    visitors: 240, newVisitors: 226, pageLoads: 325, mobilePct: 10, daily: [], peakHour: 3,
    sections: [['콘텐츠', 153]] as Array<[string, number]>, topPages: [['/events/ek1-genesis', 12]] as Array<[string, number]>,
    sources: [['직접', 303], ['검색', 19]] as Array<[string, number]>, refHosts: [], bots: { search: 724, ai: [['Google AI', 227]] as Array<[string, number]> }, notFound: [],
};

// 오늘(시스템 시각)이 언제든 "지난주"가 데이터 안에 들어오도록 기준 주를 오늘에서 계산한다
const monday = (() => {
    const t = Date.now() + 9 * 3600e3;
    const d = new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * 864e5 - 7 * 864e5);
    return d.toISOString().slice(0, 10);
})();
const at = (days: number) => new Date(Date.parse(monday) + days * 864e5 + 3600e3).toISOString();

const data = (withAi: boolean): StatsHistory => ({
    updatedAt: new Date(Date.parse(monday) + 30 * 864e5).toISOString(),
    channel: 'thetickeriseth',
    weeks: [{ week: monday, site: { ...site, titles: { '/events/ek1-genesis': 'Ethereum Korea One · Genesis' } }, tg: { subscribers: 1510 } }],
    siteDaily: Array.from({ length: 7 }, (_, i) => ({ date: at(i).slice(0, 10), visitors: 30 + i, pageLoads: 40 })),
    tgPosts: [
        { id: 1, date: at(-6), views: 300, text: 'ACDT #100 · 콜' },
        { id: 3, date: at(1), views: 1600, text: '[이더리움 코리아 기관 컨퍼런스 보고서] 9월 28일' },
        { id: 4, date: at(2), views: 200, text: '폴리마켓, V2 공개' },
        { id: 5, date: at(3), views: 250, text: '디라이브, V3 출시' },
    ],
    liPosts: [{ title: '이더리움 코리아 기관 컨퍼런스 보고서 정리', urn: 'urn:li:activity:1', date: at(2).slice(0, 10), impressions: 230, reactions: 6, comments: 0 }],
    ...(withAi
        ? {
              aiInsights: [
                  {
                      key: monday, mode: 'week' as const, generatedAt: '2026-10-24T04:00:00Z', model: 'fable',
                      headline: '기관 컨퍼런스 보고서가 평균을 끌어올렸다',
                      summary: '요약 문단',
                      highlights: [{ channel: 'telegram' as const, title: '평균 조회 +37%', detail: '보고서 한 글이 만든 상승', tone: 'up' as const }],
                      actions: ['행사 후속물을 화요일 낮에 올린다'],
                      caveats: ['홈페이지 기록은 2주치'],
                  },
              ],
          }
        : {}),
});

const mockFetch = (body: StatsHistory) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }));

describe('AdminStats', () => {
    beforeEach(() => sessionStorage.setItem('publishKey', 'pw'));
    afterEach(() => {
        sessionStorage.clear();
        vi.unstubAllGlobals();
    });

    it('AI 분석이 있으면 헤드라인·하이라이트·다음 할 일을 보여 준다', async () => {
        mockFetch(data(true));
        renderWithProviders(<AdminStats />);
        expect(await screen.findByRole('heading', { name: '기관 컨퍼런스 보고서가 평균을 끌어올렸다' })).toBeInTheDocument();
        expect(screen.getByText(/AI 분석 ·/)).toBeInTheDocument();
        expect(screen.getByText('행사 후속물을 화요일 낮에 올린다')).toBeInTheDocument();
        expect(screen.getByText('평균 조회 +37%')).toBeInTheDocument();
    });

    it('AI 분석이 없으면 요약 상자 없이 탭마다 수치 인사이트를 보여 준다', async () => {
        mockFetch(data(false));
        renderWithProviders(<AdminStats />);
        expect(await screen.findByText('구독자 도달률')).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: '인사이트' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: '홈페이지' }));
        expect(screen.getByText('AI 크롤러', { selector: 'dt' })).toBeInTheDocument();
        expect(screen.getByText('Google AI 최다', { exact: false })).toBeInTheDocument();
    });

    it('KPI와 썸네일 붙은 인기 글을 보여 준다', async () => {
        mockFetch(data(false));
        renderWithProviders(<AdminStats />);
        const tg = await screen.findByRole('region', { name: '텔레그램 주요 성과' });
        expect(within(tg).getAllByText(/^(구독자|평균 조회수|올린 글)$/).map((e) => e.textContent)).toEqual(['구독자', '평균 조회수', '올린 글']);
        expect(within(screen.getByRole('region', { name: '홈페이지 주요 성과' })).getAllByText(/^(방문자|AI 크롤러|검색 유입)$/).map((e) => e.textContent)).toEqual(['방문자', 'AI 크롤러', '검색 유입']);
        expect(within(screen.getByRole('region', { name: '링크드인 주요 성과' })).getAllByText(/^(팔로워|노출|글당 노출)$/).map((e) => e.textContent)).toEqual(['팔로워', '노출', '글당 노출']);
        expect(screen.getByRole('region', { name: '링크드인 주요 성과' })).toBeInTheDocument();
        const top = await within(screen.getByRole('tabpanel')).findByRole('link', { name: /기관 컨퍼런스 보고서\] 9월 28일/ });
        expect(top).toHaveAttribute('href', 'https://t.me/thetickeriseth/3');
        await waitFor(() => expect(top.querySelector('img')).toHaveAttribute('src', 'https://r2.dev/telegram/tg-3.jpg'));
        fireEvent.click(screen.getByRole('tab', { name: '홈페이지' }));
        expect(screen.getByText('Ethereum Korea One · Genesis').closest('a')?.querySelector('img')).toHaveAttribute('src', '/assets/events/ek1-genesis/main-banner.jpg');
    });

    it('월별로 바꾸면 기간 선택이 월 단위가 된다', async () => {
        mockFetch(data(false));
        renderWithProviders(<AdminStats />);
        fireEvent.click(await screen.findByRole('tab', { name: '월별' }));
        expect(screen.getByRole('tab', { name: '월별' })).toHaveAttribute('aria-selected', 'true');
        expect((screen.getByRole('combobox', { name: '기간 선택' }) as HTMLSelectElement).value).toMatch(/^\d{4}-\d{2}$/);
    });

    it('성과와 채널 상세 사이에 기여자 기여를 보여 준다', async () => {
        mockFetch(data(false));
        renderWithProviders(<AdminStats />);
        const section = await screen.findByRole('region', { name: '기여자' });
        expect(screen.queryByRole('tab', { name: '기여자' })).not.toBeInTheDocument();
        const table = await within(section).findByRole('table');
        expect(within(table).getByText('sose')).toBeInTheDocument();
        expect(screen.getByText('가장 많이 쓴 기여자')).toBeInTheDocument();
    });
});
