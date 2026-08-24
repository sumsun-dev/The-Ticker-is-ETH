import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import News from '../News';
import { renderWithProviders } from '../../test/helpers/render';

vi.mock('../../data/ethNewsData', async () => {
  const actual = await vi.importActual<typeof import('../../data/ethNewsData')>('../../data/ethNewsData');
  return {
    ...actual,
    loadEthDigests: vi.fn().mockResolvedValue([
      {
        date: '2026-08-24',
        title: '싱크 커미티 제거 제안 등장',
        intro: '이번 주 요약입니다.',
        sections: [
          {
            heading: '프로토콜 · 리서치',
            items: [
              {
                title: 'EIP-8390 다이제스트 항목',
                summary: '한국어 요약 두 문장.',
                url: 'https://ethereum-magicians.org/t/eip-8390',
                source: 'Eth Magicians',
                date: '2026-08-23',
              },
            ],
          },
        ],
      },
    ]),
    loadEthNews: vi.fn().mockResolvedValue({
      fetchedAt: new Date().toISOString(),
      items: [
        {
          id: 'ethresearch:1',
          source: 'ethresearch',
          sourceType: 'rss',
          title: 'Timing the Head in Ethereum PoS',
          url: 'https://ethresear.ch/t/timing/1',
          publishedAt: new Date().toISOString(),
          summary: 'An analysis of timing games.',
          author: 'someone',
        },
        {
          id: 'tg:coinnesskr:9',
          source: 'tg:coinnesskr',
          sourceType: 'telegram',
          title: '코인니스 원문 속보 — 노출되면 안 됨',
          url: 'https://t.me/coinnesskr/9',
          publishedAt: new Date().toISOString(),
          summary: '코인니스 본문',
          author: 'coinnesskr',
        },
      ],
    }),
  };
});

describe('News', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the latest digest as content', async () => {
    renderWithProviders(<News />);

    await waitFor(() => {
      expect(screen.getByText('싱크 커미티 제거 제안 등장')).toBeInTheDocument();
    });
    expect(screen.getByText('이번 주 요약입니다.')).toBeInTheDocument();
    expect(screen.getByText('프로토콜 · 리서치')).toBeInTheDocument();
    expect(screen.getByText('EIP-8390 다이제스트 항목')).toBeInTheDocument();

    const originalLink = screen.getByRole('link', { name: /원문 보기|View original/ });
    expect(originalLink).toHaveAttribute('href', 'https://ethereum-magicians.org/t/eip-8390');
    expect(originalLink).toHaveAttribute('target', '_blank');
  });

  it('should keep the raw feed collapsed by default and exclude telegram items when opened', async () => {
    renderWithProviders(<News />);
    await waitFor(() => {
      expect(screen.getByText('싱크 커미티 제거 제안 등장')).toBeInTheDocument();
    });

    expect(screen.queryByText('Timing the Head in Ethereum PoS')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /실시간 수집 피드|raw source feed/ }));

    expect(screen.getByText('Timing the Head in Ethereum PoS')).toBeInTheDocument();
    expect(screen.queryByText(/코인니스 원문 속보/)).not.toBeInTheDocument();
  });
});
