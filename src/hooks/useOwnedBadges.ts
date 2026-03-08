import { useState, useEffect } from 'react'
import { getContract } from 'thirdweb'
import { balanceOf } from 'thirdweb/extensions/erc1155'
import { thirdwebClient, getChainConfig } from '../lib/thirdweb'
import { BADGE_TYPES, type OwnedBadge, type ChainKey } from '../types/rewards'

export function useOwnedBadges(walletAddress: string | undefined, chainKey: ChainKey) {
  const [badges, setBadges] = useState<OwnedBadge[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const { chain, contractAddress } = getChainConfig(chainKey)

    if (!walletAddress || !contractAddress || !thirdwebClient) {
      setBadges([])
      return
    }

    let cancelled = false
    setIsLoading(true)

    const fetchBadges = async () => {
      try {
        const contract = getContract({
          client: thirdwebClient!,
          chain,
          address: contractAddress,
        })

        const results = await Promise.all(
          BADGE_TYPES.map(async (badge) => {
            const balance = await balanceOf({
              contract,
              owner: walletAddress,
              tokenId: badge.tokenId,
            })
            return { tokenId: badge.tokenId, balance }
          }),
        )

        if (!cancelled) {
          setBadges(results)
        }
      } catch (err) {
        console.error('[useOwnedBadges]', err)
        if (!cancelled) setBadges([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchBadges()

    return () => {
      cancelled = true
    }
  }, [walletAddress, chainKey])

  return { badges, isLoading }
}
