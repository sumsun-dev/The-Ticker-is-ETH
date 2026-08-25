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
        date: '2026-08-25',
        title: '설전 감지 첫날의 다이제스트',
        intro: '오늘의 에디터 노트입니다.',
        coverImage: '/assets/digests/2026-08-25.png',
        sections: [
          {
            heading: '프로토콜 · 리서치',
            items: [
              {
                title: 'EIP-8390 다이제스트 항목',
                summary: '한국어 요약 세 문장.',
                why: '라이트 클라이언트 로드맵의 방향 전환 신호입니다.',
                url: 'https://ethereum-magicians.org/t/eip-8390',
                source: 'Eth Magicians',
                date: '2026-08-24',
              },
            ],
          },
          {
            heading: '오늘의 논쟁 · 담론',
            items: [
              {
                title: 'ePBS를 둘러싼 공방',
                summary: '참여자별 입장 정리.',
                why: '글램스터담 포크의 핵심 쟁점입니다.',
                url: 'https://x.com/ryanberckmans/status/1',
                source: '@ryanberckmans',
                date: '2026-08-24',
              },
            ],
          },
        ],
      },
      {
        date: '2026-08-24',
        title: '싱크 커미티 제거 제안 등장',
        intro: '지난 호 인트로.',
        coverImage: '/assets/digests/2026-08-24.png',
        sections: [
          {
            heading: '프로토콜 · 리서치',
            items: [
              {
                title: '지난 호 항목',
                summary: '요약.',
                url: 'https://example.com/a',
                source: 'ethresear.ch',
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

  it('should render the latest digest with debate section highlighted', async () => {
    renderWithProviders(<News />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: '설전 감지 첫날의 다이제스트' })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: '오늘의 논쟁 · 담론' })).toBeInTheDocument();
    expect(screen.getByText('ePBS를 둘러싼 공방')).toBeInTheDocument();
    expect(screen.getByText('라이트 클라이언트 로드맵의 방향 전환 신호입니다.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '설전 감지 첫날의 다이제스트' })).toHaveAttribute(
      'src',
      '/assets/digests/2026-08-25.png',
    );
  });

  it('should switch digest via the archive grid', async () => {
    renderWithProviders(<News />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: '설전 감지 첫날의 다이제스트' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /싱크 커미티 제거 제안 등장/ })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: '싱크 커미티 제거 제안 등장' })).toBeInTheDocument();
    });
    expect(screen.getByText('지난 호 인트로.')).toBeInTheDocument();
  });

  it('should load a specific digest from the date query param', async () => {
    renderWithProviders(<News />, { route: '/news?date=2026-08-24' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: '싱크 커미티 제거 제안 등장' })).toBeInTheDocument();
    });
  });
});
