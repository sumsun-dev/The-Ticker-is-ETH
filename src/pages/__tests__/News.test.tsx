import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
        coverImage: '/assets/digests/2026-08-24.png',
        sections: [
          {
            heading: '프로토콜 · 리서치',
            items: [
              {
                title: 'EIP-8390 다이제스트 항목',
                summary: '한국어 요약 두 문장.',
                why: '라이트 클라이언트 로드맵의 방향 전환 신호입니다.',
                url: 'https://ethereum-magicians.org/t/eip-8390',
                source: 'Eth Magicians',
                date: '2026-08-23',
              },
            ],
          },
        ],
      },
    ]),
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
    expect(screen.getByText('라이트 클라이언트 로드맵의 방향 전환 신호입니다.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '싱크 커미티 제거 제안 등장' })).toHaveAttribute(
      'src',
      '/assets/digests/2026-08-24.png',
    );

    const originalLink = screen.getByRole('link', { name: /원문 보기|View original/ });
    expect(originalLink).toHaveAttribute('href', 'https://ethereum-magicians.org/t/eip-8390');
    expect(originalLink).toHaveAttribute('target', '_blank');
  });

  it('should not render any raw feed affordance', async () => {
    renderWithProviders(<News />);
    await waitFor(() => {
      expect(screen.getByText('싱크 커미티 제거 제안 등장')).toBeInTheDocument();
    });

    expect(screen.queryByText(/실시간 수집 피드|raw source feed/)).not.toBeInTheDocument();
  });
});
