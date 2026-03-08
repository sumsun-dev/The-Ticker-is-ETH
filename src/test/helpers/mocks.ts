import type { TeamMember, Contribution } from '../../types/team'

export function createMockContribution(overrides: Partial<Contribution> = {}): Contribution {
  return {
    date: '2025-01-15',
    count: 3,
    ...overrides,
  }
}

export function createMockMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'test-member',
    name: 'Test User',
    role: 'Developer',
    period: '2024.01 - Present',
    isCurrent: true,
    avatarUrl: 'https://example.com/avatar.png',
    contributions: [
      createMockContribution({ date: '2025-01-15', count: 3 }),
      createMockContribution({ date: '2025-01-14', count: 1 }),
      createMockContribution({ date: '2025-01-13', count: 0 }),
    ],
    recentActivity: [],
    bio: 'A test member for unit tests',
    memberType: 'core',
    social: {
      twitter: 'https://twitter.com/test',
      github: 'https://github.com/test',
    },
    highlights: [
      { title: 'Test Highlight', url: 'https://example.com' },
    ],
    ...overrides,
  }
}
