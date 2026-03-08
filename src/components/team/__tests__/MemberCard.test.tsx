import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import MemberCard from '../MemberCard'
import { renderWithProviders } from '../../../test/helpers/render'
import { createMockMember } from '../../../test/helpers/mocks'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('MemberCard', () => {
  const member = createMockMember({
    name: 'Alice',
    role: 'Researcher',
    period: '2024.01 - Present',
    bio: 'Ethereum researcher and developer',
  })

  it('renders member name and role', () => {
    renderWithProviders(<MemberCard member={member} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Researcher')).toBeInTheDocument()
  })

  it('renders member period', () => {
    renderWithProviders(<MemberCard member={member} />)
    expect(screen.getByText('2024.01 - Present')).toBeInTheDocument()
  })

  it('renders bio text', () => {
    renderWithProviders(<MemberCard member={member} />)
    expect(screen.getByText('Ethereum researcher and developer')).toBeInTheDocument()
  })

  it('renders social links', () => {
    renderWithProviders(<MemberCard member={member} />)
    const links = screen.getAllByRole('link')
    const externalLinks = links.filter((l) => l.getAttribute('target') === '_blank')
    expect(externalLinks.length).toBeGreaterThanOrEqual(2)
  })

  it('renders highlights when provided', () => {
    renderWithProviders(<MemberCard member={member} />)
    expect(screen.getByText('Test Highlight')).toBeInTheDocument()
  })

  it('renders view profile link for core members', () => {
    renderWithProviders(<MemberCard member={member} />)
    const profileLink = screen.getByRole('link', { name: /view profile|프로필/i })
    expect(profileLink).toHaveAttribute('href', '/team/test-member')
  })

  it('renders view profile link for contributors', () => {
    const contributor = createMockMember({ memberType: 'contributor' })
    renderWithProviders(<MemberCard member={contributor} />)
    const profileLink = screen.getByRole('link', { name: /view profile|프로필/i })
    expect(profileLink).toHaveAttribute('href', '/contributors/test-member')
  })

  it('shows contribution count', () => {
    renderWithProviders(<MemberCard member={member} />)
    // Total contributions: 3 + 1 + 0 = 4
    expect(screen.getByText('4 contributions')).toBeInTheDocument()
  })
})
