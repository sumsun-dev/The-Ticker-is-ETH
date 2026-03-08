import type { Chain } from 'thirdweb/chains'

export type ChainKey = 'base' | 'ethereum'

export interface ChainConfig {
  key: ChainKey
  chain: Chain
  name: string
  contractAddress: string
}

export interface BadgeType {
  tokenId: bigint
  name: string
  description: string
  icon: string
}

export interface OwnedBadge {
  tokenId: bigint
  balance: bigint
}

export const BADGE_TYPES: BadgeType[] = [
  {
    tokenId: 0n,
    name: 'Core Contributor',
    description: 'Awarded to core team members for outstanding contributions',
    icon: '/assets/badges/core.svg',
  },
  {
    tokenId: 1n,
    name: 'Translator',
    description: 'Awarded for translating Ethereum content to Korean',
    icon: '/assets/badges/translator.svg',
  },
  {
    tokenId: 2n,
    name: 'Event Attendee',
    description: 'Awarded for attending community events',
    icon: '/assets/badges/event.svg',
  },
  {
    tokenId: 3n,
    name: 'Research Author',
    description: 'Awarded for publishing research articles',
    icon: '/assets/badges/research.svg',
  },
]
