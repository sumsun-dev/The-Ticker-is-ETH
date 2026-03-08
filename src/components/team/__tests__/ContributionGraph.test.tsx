import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContributionGraph from '../ContributionGraph'
import type { Contribution } from '../../../types/team'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}))

function generateContributions(days: number): Contribution[] {
  const contributions: Contribution[] = []
  const now = new Date('2025-06-15')
  for (let i = 0; i < days; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    contributions.push({
      date: date.toISOString().split('T')[0],
      count: i % 5,
    })
  }
  return contributions
}

describe('ContributionGraph', () => {
  it('renders without crashing', () => {
    const data = generateContributions(30)
    const { container } = render(<ContributionGraph data={data} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders day labels', () => {
    const data = generateContributions(30)
    render(<ContributionGraph data={data} />)
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Wed')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
  })

  it('renders Less and More legend labels', () => {
    const data = generateContributions(14)
    render(<ContributionGraph data={data} />)
    expect(screen.getByText('Less')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  it('renders correct number of cells for data', () => {
    const data = generateContributions(14)
    const { container } = render(<ContributionGraph data={data} />)
    // Each cell is a div with rounded-[2px] and cursor-pointer class
    const cells = container.querySelectorAll('[class*="cursor-pointer"]')
    expect(cells.length).toBe(14)
  })

  it('handles empty data', () => {
    const { container } = render(<ContributionGraph data={[]} />)
    expect(container.firstChild).toBeTruthy()
  })
})
