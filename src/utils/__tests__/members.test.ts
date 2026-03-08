import { describe, it, expect } from 'vitest'
import { getAvatarFallbackUrl, getTotalContributions, sortMembers } from '../members'
import { createMockContribution, createMockMember } from '../../test/helpers/mocks'

describe('getAvatarFallbackUrl', () => {
  it('encodes name and returns ui-avatars URL with default size', () => {
    const url = getAvatarFallbackUrl('John Doe')
    expect(url).toBe(
      'https://ui-avatars.com/api/?name=John%20Doe&background=3C4CA8&color=fff&size=64',
    )
  })

  it('uses custom size when provided', () => {
    const url = getAvatarFallbackUrl('Alice', 128)
    expect(url).toContain('size=128')
  })

  it('handles special characters in name', () => {
    const url = getAvatarFallbackUrl('김철수')
    expect(url).toContain('name=%EA%B9%80%EC%B2%A0%EC%88%98')
  })
})

describe('getTotalContributions', () => {
  it('returns 0 for empty array', () => {
    expect(getTotalContributions([])).toBe(0)
  })

  it('sums all contribution counts', () => {
    const contributions = [
      createMockContribution({ count: 3 }),
      createMockContribution({ count: 5 }),
      createMockContribution({ count: 2 }),
    ]
    expect(getTotalContributions(contributions)).toBe(10)
  })

  it('handles single contribution', () => {
    expect(getTotalContributions([createMockContribution({ count: 7 })])).toBe(7)
  })
})

describe('sortMembers', () => {
  const memberA = createMockMember({
    id: 'a',
    contributions: [
      createMockContribution({ count: 10 }),
    ],
    period: '2023.01 - Present',
  })

  const memberB = createMockMember({
    id: 'b',
    contributions: [
      createMockContribution({ count: 5 }),
    ],
    period: '2024.06 - Present',
  })

  const memberC = createMockMember({
    id: 'c',
    contributions: [
      createMockContribution({ count: 20 }),
    ],
    period: '2022.03 - Present',
  })

  it('sorts by contributions descending', () => {
    const sorted = sortMembers([memberA, memberB, memberC], 'contributions')
    expect(sorted.map((m) => m.id)).toEqual(['c', 'a', 'b'])
  })

  it('sorts by seniority (oldest first)', () => {
    const sorted = sortMembers([memberA, memberB, memberC], 'seniority')
    expect(sorted.map((m) => m.id)).toEqual(['c', 'a', 'b'])
  })

  it('does not mutate the original array', () => {
    const original = [memberA, memberB]
    sortMembers(original, 'contributions')
    expect(original[0].id).toBe('a')
  })
})
