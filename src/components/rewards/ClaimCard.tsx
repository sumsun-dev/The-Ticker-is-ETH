import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getContract, sendTransaction } from 'thirdweb'
import { claimTo } from 'thirdweb/extensions/erc1155'
import { privateKeyToAccount } from 'thirdweb/wallets'
import { thirdwebClient, getChainConfig } from '../../lib/thirdweb'
import type { BadgeType, ChainKey } from '../../types/rewards'

interface ClaimCardProps {
  badge: BadgeType
  walletAddress: string
  alreadyOwned: boolean
  chainKey: ChainKey
  onSuccess: () => void
}

const ClaimCard: React.FC<ClaimCardProps> = ({ badge, walletAddress, alreadyOwned, chainKey, onSuccess }) => {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')

  const handleClaim = async () => {
    if (alreadyOwned || status === 'pending' || !thirdwebClient) return

    try {
      setStatus('pending')

      const { chain, contractAddress } = getChainConfig(chainKey)

      const contract = getContract({
        client: thirdwebClient!,
        chain,
        address: contractAddress,
      })

      // Note: In production, this would use Privy's embedded wallet provider
      // For MVP, claim transactions require thirdweb dashboard claim conditions
      const tx = claimTo({
        contract,
        to: walletAddress,
        tokenId: badge.tokenId,
        quantity: 1n,
      })

      // Use a server-side relayer or admin key in production
      const adminKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY as string | undefined
      if (!adminKey) {
        console.error('[ClaimCard] Admin key not configured')
        setStatus('error')
        return
      }

      const account = privateKeyToAccount({
        client: thirdwebClient!,
        privateKey: adminKey,
      })

      await sendTransaction({ transaction: tx, account })
      setStatus('success')
      toast.success(t('rewards.claimSuccess'))
      onSuccess()
    } catch (err) {
      console.error('[ClaimCard]', err)
      setStatus('error')
      toast.error(t('rewards.claimError'))
    }
  }

  return (
    <div className="bg-theme-surface border border-theme-border rounded-xl p-6 hover:border-brand-accent/30 transition-all">
      <div className="text-4xl mb-3">🏅</div>
      <h3 className="text-lg font-semibold text-theme-text mb-1">{badge.name}</h3>
      <p className="text-sm text-theme-text-muted mb-4">{badge.description}</p>

      {alreadyOwned ? (
        <span className="inline-block px-4 py-2 rounded-full bg-green-500/10 text-green-400 text-sm font-medium border border-green-500/20">
          {t('rewards.alreadyClaimed')}
        </span>
      ) : (
        <button
          onClick={handleClaim}
          disabled={status === 'pending'}
          aria-label={`${t('rewards.claim')} ${badge.name}`}
          className="px-6 py-2 rounded-full bg-brand-accent hover:bg-brand-accent/80 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'pending' ? t('rewards.claiming') : t('rewards.claim')}
        </button>
      )}

      {status === 'success' && (
        <p className="mt-3 text-sm text-green-400">{t('rewards.claimSuccess')}</p>
      )}
      {status === 'error' && (
        <p className="mt-3 text-sm text-red-400">{t('rewards.claimError')}</p>
      )}
    </div>
  )
}

export default ClaimCard
