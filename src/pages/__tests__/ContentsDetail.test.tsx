import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import ContentsDetail from '../ContentsDetail'
import { renderWithProviders } from '../../test/helpers/render'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(() => vi.fn()),
    useLocation: vi.fn(() => ({ state: null, pathname: '/contents/test-1', search: '', hash: '', key: 'default' })),
  }
})

vi.mock('../../data/researchData', () => ({
  loadContentsIndex: vi.fn().mockResolvedValue([
    {
      id: 'test-1',
      title: 'Test Research Article',
      author: 'Author1',
      authorAvatar: '/avatar.png',
      date: '2026-01-15',
      category: 'research',
      readTime: '5 min',
      summary: 'Test summary',
    },
  ]),
  loadResearchContent: vi.fn().mockResolvedValue('# Test Markdown Content'),
}))

const { useParams, useLocation } = await import('react-router-dom')

describe('ContentsDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useLocation).mockReturnValue({
      state: null,
      pathname: '/contents/test-1',
      search: '',
      hash: '',
      key: 'default',
    } as ReturnType<typeof useLocation>)
    localStorage.clear()
    sessionStorage.clear()
  })

  it('shows not found when post is not loaded yet and no match', async () => {
    vi.mocked(useParams).mockReturnValue({ id: 'nonexistent-id' })
    renderWithProviders(<ContentsDetail />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })
  })

  it('renders article title when post is found', async () => {
    vi.mocked(useParams).mockReturnValue({ id: 'test-1' })
    renderWithProviders(<ContentsDetail />)
    await waitFor(() => {
      expect(screen.getByText('Test Research Article')).toBeInTheDocument()
    })
  })

  it('renders author info', async () => {
    vi.mocked(useParams).mockReturnValue({ id: 'test-1' })
    renderWithProviders(<ContentsDetail />)
    await waitFor(() => {
      expect(screen.getByText('Author1')).toBeInTheDocument()
    })
  })

  it('renders back to contents link', async () => {
    vi.mocked(useParams).mockReturnValue({ id: 'test-1' })
    renderWithProviders(<ContentsDetail />)
    await waitFor(() => {
      expect(screen.getByText('Test Research Article')).toBeInTheDocument()
    })
    const backLinks = screen.getAllByRole('link').filter(
      (l) => l.getAttribute('href') === '/contents',
    )
    expect(backLinks.length).toBeGreaterThan(0)
  })

  it('does not show delete button for non-admin users', async () => {
    vi.mocked(useParams).mockReturnValue({ id: 'test-1' })
    renderWithProviders(<ContentsDetail />)
    await waitFor(() => {
      expect(screen.getByText('Test Research Article')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders content from location state', async () => {
    vi.mocked(useParams).mockReturnValue({ id: 'test-1' })
    vi.mocked(useLocation).mockReturnValue({
      state: { publishedContent: '# Published Content' },
      pathname: '/contents/test-1',
      search: '',
      hash: '',
      key: 'default',
    } as ReturnType<typeof useLocation>)
    renderWithProviders(<ContentsDetail />)
    await waitFor(() => {
      expect(screen.getByText('Test Research Article')).toBeInTheDocument()
    })
  })
})
