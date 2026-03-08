import { createThirdwebClient, type ThirdwebClient } from 'thirdweb'
import { base, ethereum } from 'thirdweb/chains'
import type { ChainConfig, ChainKey } from '../types/rewards'

const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID as string | undefined

function createSafeClient(): ThirdwebClient | null {
  if (!clientId) return null
  try {
    return createThirdwebClient({ clientId })
  } catch {
    return null
  }
}

export const thirdwebClient = createSafeClient()

export const SUPPORTED_CHAINS: Record<ChainKey, ChainConfig> = {
  base: {
    key: 'base',
    chain: base,
    name: 'Base',
    contractAddress: import.meta.env.VITE_BADGE_CONTRACT_ADDRESS_BASE as string,
  },
  ethereum: {
    key: 'ethereum',
    chain: ethereum,
    name: 'Ethereum',
    contractAddress: import.meta.env.VITE_BADGE_CONTRACT_ADDRESS_ETH as string,
  },
}

export const DEFAULT_CHAIN: ChainKey = 'base'

export function getChainConfig(chainKey: ChainKey): ChainConfig {
  return SUPPORTED_CHAINS[chainKey]
}
