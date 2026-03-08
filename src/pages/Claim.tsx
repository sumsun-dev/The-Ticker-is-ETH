import { useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useTranslation } from 'react-i18next'
import { useOwnedBadges } from '../hooks/useOwnedBadges'
import ClaimCard from '../components/rewards/ClaimCard'
import ChainSelector from '../components/rewards/ChainSelector'
import { DEFAULT_CHAIN } from '../lib/thirdweb'
import { BADGE_TYPES, type ChainKey } from '../types/rewards'

const Claim: React.FC = () => {
  const { t } = useTranslation()
  const { ready, authenticated, login, user } = usePrivy()
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedChain, setSelectedChain] = useState<ChainKey>(DEFAULT_CHAIN)

  const walletAccount = user?.linkedAccounts.find(
    (a) => a.type === 'wallet' && 'address' in a,
  )
  const address = walletAccount && 'address' in walletAccount ? walletAccount.address : undefined

  const { badges, isLoading } = useOwnedBadges(
    refreshKey >= 0 ? address : undefined,
    selectedChain,
  )

  const handleClaimSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  if (!ready) return null

  if (!authenticated) {
    return (
      <section className="min-h-[60vh] flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold text-theme-text mb-4">{t('rewards.claimTitle')}</h1>
        <p className="text-theme-text-muted mb-8">{t('rewards.loginToClaim')}</p>
        <button
          onClick={login}
          className="bg-brand-accent hover:bg-brand-accent/80 text-white px-6 py-3 rounded-full font-medium transition-colors"
        >
          {t('auth.connect')}
        </button>
      </section>
    )
  }

  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-theme-text mb-3">{t('rewards.claimTitle')}</h1>
      <p className="text-theme-text-muted mb-6">{t('rewards.claimDescription')}</p>

      <ChainSelector selected={selectedChain} onChange={setSelectedChain} />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {BADGE_TYPES.map((b) => (
            <div
              key={b.tokenId.toString()}
              className="bg-theme-surface border border-theme-border rounded-xl p-6 animate-pulse h-48"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {address && BADGE_TYPES.map((badge) => {
            const owned = badges.find((b) => b.tokenId === badge.tokenId)
            const alreadyOwned = !!owned && owned.balance > 0n

            return (
              <ClaimCard
                key={badge.tokenId.toString()}
                badge={badge}
                walletAddress={address}
                alreadyOwned={alreadyOwned}
                chainKey={selectedChain}
                onSuccess={handleClaimSuccess}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

export default Claim
