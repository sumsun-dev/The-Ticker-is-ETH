import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import News from '../News';
import { renderWithProviders } from '../../test/helpers/render';

vi.mock('../../data/ethNewsData', async () => {
  const actual = await vi.importActual<typeof import('../../data/ethNewsData')>('../../data/ethNewsData');
  return {
    ...actual,
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
          id: 'x:VitalikButerin:2',
          source: 'x:VitalikButerin',
          sourceType: 'twitter',
          title: 'gm ethereum',
          url: 'https://x.com/VitalikButerin/status/2',
          publishedAt: new Date().toISOString(),
          summary: 'gm ethereum',
          author: 'VitalikButerin',
        },
      ],
    }),
  };
});

describe('News', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render collected items with source badges and original links', async () => {
    renderWithProviders(<News />);

    await waitFor(() => {
      expect(screen.getByText('Timing the Head in Ethereum PoS')).toBeInTheDocument();
    });
    expect(screen.getByText('ethresear.ch')).toBeInTheDocument();
    expect(screen.getByText('@VitalikButerin')).toBeInTheDocument();

    const link = screen.getByText('Timing the Head in Ethereum PoS').closest('a');
    expect(link).toHaveAttribute('href', 'https://ethresear.ch/t/timing/1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('should filter items by group', async () => {
    renderWithProviders(<News />);
    await waitFor(() => {
      expect(screen.getByText('gm ethereum')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /공식|Official/ }));

    expect(screen.getByText('Timing the Head in Ethereum PoS')).toBeInTheDocument();
    expect(screen.queryByText('gm ethereum')).not.toBeInTheDocument();
  });
});
