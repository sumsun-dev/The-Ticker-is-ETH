import { useState } from 'react';
import { usePrivy, useLinkAccount } from '@privy-io/react-auth';
import type { WalletWithMetadata, TwitterOAuthWithMetadata, TelegramWithMetadata } from '@privy-io/react-auth';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useOwnedBadges } from '../hooks/useOwnedBadges';
import BadgeGrid from '../components/rewards/BadgeGrid';
import ChainSelector from '../components/rewards/ChainSelector';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { DEFAULT_CHAIN } from '../lib/thirdweb';
import type { ChainKey } from '../types/rewards';

const Profile: React.FC = () => {
  const { ready, authenticated, user, unlinkTwitter, unlinkTelegram, unlinkWallet } = usePrivy();
  const { linkWallet, linkTwitter, linkTelegram } = useLinkAccount();
  const { t } = useTranslation();
  const [selectedChain, setSelectedChain] = useState<ChainKey>(DEFAULT_CHAIN);

  const wallets = user?.linkedAccounts.filter(
    (a): a is WalletWithMetadata => a.type === 'wallet',
  ) ?? [];

  const twitterAccount = user?.linkedAccounts.find(
    (a): a is TwitterOAuthWithMetadata => a.type === 'twitter_oauth',
  );

  const telegramAccount = user?.linkedAccounts.find(
    (a): a is TelegramWithMetadata => a.type === 'telegram',
  );

  const primaryWalletAddress = wallets.length > 0 ? wallets[0].address : undefined;
  const { badges, isLoading: badgesLoading } = useOwnedBadges(primaryWalletAddress, selectedChain);

  if (!ready) return null;

  if (!authenticated || !user) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-theme-text mb-10">{t('auth.profile')}</h1>

      {/* Wallet */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-theme-text mb-4">{t('auth.walletAddress')}</h2>
        {wallets.length > 0 ? (
          <ul className="space-y-3">
            {wallets.map((w) => (
              <li
                key={w.address}
                className="flex items-center justify-between bg-theme-surface border border-theme-border rounded-xl px-5 py-4"
              >
                <span className="text-sm text-theme-text-secondary font-mono break-all">{w.address}</span>
                {wallets.length > 1 && (
                  <button
                    onClick={() => unlinkWallet(w.address)}
                    className="ml-4 text-sm text-red-400 hover:text-red-300 transition-colors shrink-0"
                  >
                    {t('auth.unlink')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-theme-text-muted text-sm">{t('auth.noWallet')}</p>
        )}
        <button
          onClick={() => linkWallet()}
          className="mt-4 text-sm text-brand-accent hover:text-brand-accent/80 transition-colors"
        >
          + {t('auth.addWallet')}
        </button>
      </div>

      {/* Linked Accounts */}
      <div>
        <h2 className="text-lg font-semibold text-theme-text mb-4">{t('auth.linkedAccounts')}</h2>
        <div className="space-y-3">
          {/* Twitter */}
          <div className="flex items-center justify-between bg-theme-surface border border-theme-border rounded-xl px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-theme-text font-medium">Twitter</span>
              {twitterAccount?.username && (
                <span className="text-theme-text-muted text-sm">@{twitterAccount.username}</span>
              )}
            </div>
            {twitterAccount ? (
              <button
                onClick={() => unlinkTwitter(twitterAccount.subject)}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                {t('auth.unlink')}
              </button>
            ) : (
              <button
                onClick={() => linkTwitter()}
                className="text-sm text-brand-accent hover:text-brand-accent/80 transition-colors"
              >
                {t('auth.link')}
              </button>
            )}
          </div>

          {/* Telegram */}
          <div className="flex items-center justify-between bg-theme-surface border border-theme-border rounded-xl px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-theme-text font-medium">Telegram</span>
              {telegramAccount && (
                <span className="text-theme-text-muted text-sm">
                  {telegramAccount.firstName ?? telegramAccount.telegramUserId}
                </span>
              )}
            </div>
            {telegramAccount ? (
              <button
                onClick={() => unlinkTelegram(telegramAccount.telegramUserId)}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                {t('auth.unlink')}
              </button>
            ) : (
              <button
                onClick={() => linkTelegram()}
                className="text-sm text-brand-accent hover:text-brand-accent/80 transition-colors"
              >
                {t('auth.link')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Badges */}
      <ErrorBoundary
        fallback={
          <div className="mt-8 p-6 rounded-xl bg-theme-surface border border-theme-border text-center">
            <p className="text-theme-text-muted text-sm">{t('error.description')}</p>
          </div>
        }
      >
        <div className="mt-8">
          <ChainSelector selected={selectedChain} onChange={setSelectedChain} />
          <BadgeGrid badges={badges} isLoading={badgesLoading} chainKey={selectedChain} />
        </div>
      </ErrorBoundary>
    </section>
  );
};

export default Profile;
