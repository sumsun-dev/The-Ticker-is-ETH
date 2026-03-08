import { useTranslation } from 'react-i18next'
import { SUPPORTED_CHAINS } from '../../lib/thirdweb'
import type { ChainKey } from '../../types/rewards'

interface ChainSelectorProps {
  selected: ChainKey
  onChange: (chain: ChainKey) => void
}

const CHAIN_KEYS = Object.keys(SUPPORTED_CHAINS) as ChainKey[]

const ChainSelector: React.FC<ChainSelectorProps> = ({ selected, onChange }) => {
  const { t } = useTranslation()

  return (
    <div className="mb-6">
      <label className="block text-sm text-theme-text-muted mb-2">{t('rewards.selectChain')}</label>
      <div className="inline-flex rounded-lg border border-theme-border overflow-hidden">
        {CHAIN_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selected === key
                ? 'bg-brand-accent text-white'
                : 'bg-theme-surface text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover'
            }`}
          >
            {t(`rewards.chain${SUPPORTED_CHAINS[key].name}`)}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ChainSelector
