import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getContract, sendTransaction } from 'thirdweb'
import { claimTo } from 'thirdweb/extensions/erc1155'
import { privateKeyToAccount } from 'thirdweb/wallets'
import { thirdwebClient, getChainConfig, DEFAULT_CHAIN } from '../../lib/thirdweb'
import { BADGE_TYPES, type ChainKey } from '../../types/rewards'
import ChainSelector from './ChainSelector'

interface MintFormProps {
  chainKey?: ChainKey
  onChainChange?: (chain: ChainKey) => void
}

const MintForm: React.FC<MintFormProps> = ({ chainKey: externalChainKey, onChainChange }) => {
  const { t } = useTranslation()
  const [internalChainKey, setInternalChainKey] = useState<ChainKey>(DEFAULT_CHAIN)
  const [address, setAddress] = useState('')
  const [selectedBadge, setSelectedBadge] = useState(0)
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')

  const chainKey = externalChainKey ?? internalChainKey
  const handleChainChange = onChainChange ?? setInternalChainKey

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address.match(/^0x[a-fA-F0-9]{40}$/) || !thirdwebClient) return

    try {
      setStatus('pending')

      const adminKey = import.meta.env.VITE_ADMIN_PRIVATE_KEY as string | undefined
      if (!adminKey) {
        console.error('[MintForm] Admin key not configured')
        setStatus('error')
        return
      }

      const account = privateKeyToAccount({
        client: thirdwebClient!,
        privateKey: adminKey,
      })

      const { chain, contractAddress } = getChainConfig(chainKey)

      const contract = getContract({
        client: thirdwebClient!,
        chain,
        address: contractAddress,
      })

      const tx = claimTo({
        contract,
        to: address as `0x${string}`,
        tokenId: BADGE_TYPES[selectedBadge].tokenId,
        quantity: 1n,
      })

      await sendTransaction({ transaction: tx, account })
      setStatus('success')
      toast.success(t('rewards.mintSuccess'))
      setAddress('')
    } catch (err) {
      console.error('[MintForm]', err)
      setStatus('error')
      toast.error(t('rewards.mintError'))
    }
  }

  return (
    <form onSubmit={handleMint} className="bg-theme-surface border border-theme-border rounded-xl p-6">
      <h3 className="text-lg font-semibold text-theme-text mb-4">{t('rewards.mintBadge')}</h3>

      <ChainSelector selected={chainKey} onChange={handleChainChange} />

      <div className="mb-4">
        <label htmlFor="mint-recipient" className="block text-sm text-theme-text-muted mb-2">{t('rewards.recipientAddress')}</label>
        <input
          id="mint-recipient"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          className="w-full bg-theme-surface border border-theme-border rounded-lg px-4 py-3 text-theme-text text-sm placeholder-theme-text-muted focus:outline-none focus:border-brand-accent/50"
        />
      </div>

      <div className="mb-6">
        <label id="badge-select-label" className="block text-sm text-theme-text-muted mb-2">{t('rewards.selectBadge')}</label>
        <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="badge-select-label">
          {BADGE_TYPES.map((badge, i) => (
            <button
              key={badge.tokenId.toString()}
              type="button"
              onClick={() => setSelectedBadge(i)}
              className={`p-3 rounded-lg text-left text-sm transition-colors ${
                selectedBadge === i
                  ? 'bg-brand-accent/20 border border-brand-accent/50 text-theme-text'
                  : 'bg-theme-surface border border-theme-border text-theme-text-muted hover:text-theme-text'
              }`}
            >
              {badge.name}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={status === 'pending' || !address}
        className="w-full px-6 py-3 rounded-full bg-brand-accent hover:bg-brand-accent/80 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'pending' ? t('rewards.minting') : t('rewards.mint')}
      </button>

      {status === 'success' && (
        <p className="mt-3 text-sm text-green-400 text-center">{t('rewards.mintSuccess')}</p>
      )}
      {status === 'error' && (
        <p className="mt-3 text-sm text-red-400 text-center">{t('rewards.mintError')}</p>
      )}
    </form>
  )
}

export default MintForm
