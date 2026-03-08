import { useTranslation } from 'react-i18next'
import { SUPPORTED_CHAINS } from '../../lib/thirdweb'
import { BADGE_TYPES, type OwnedBadge, type ChainKey } from '../../types/rewards'

interface BadgeGridProps {
  badges: OwnedBadge[]
  isLoading: boolean
  chainKey?: ChainKey
}

const BadgeGrid: React.FC<BadgeGridProps> = ({ badges, isLoading, chainKey }) => {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {BADGE_TYPES.map((badge) => (
          <div
            key={badge.tokenId.toString()}
            className="bg-theme-surface border border-theme-border rounded-xl p-4 animate-pulse h-32"
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-theme-text mb-4">
        {t('rewards.badges')}
        {chainKey && (
          <span className="ml-2 text-sm font-normal text-theme-text-muted">
            ({SUPPORTED_CHAINS[chainKey].name})
          </span>
        )}
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {BADGE_TYPES.map((badgeType) => {
          const owned = badges.find((b) => b.tokenId === badgeType.tokenId)
          const hasBalance = owned && owned.balance > 0n

          return (
            <div
              key={badgeType.tokenId.toString()}
              className={`bg-theme-surface border rounded-xl p-4 transition-all ${
                hasBalance
                  ? 'border-brand-accent/30 hover:border-brand-accent/50'
                  : 'border-theme-border opacity-40 grayscale'
              }`}
            >
              <div className="text-3xl mb-2">{badgeType.icon.includes('/') ? '🏅' : badgeType.icon}</div>
              <h3 className="text-sm font-semibold text-theme-text mb-1">{badgeType.name}</h3>
              <p className="text-xs text-theme-text-muted">{badgeType.description}</p>
              {hasBalance && (
                <span className="mt-2 inline-block text-xs text-brand-accent font-medium">
                  {t('rewards.owned')}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default BadgeGrid
