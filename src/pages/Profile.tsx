import { usePrivy, useLinkAccount } from '@privy-io/react-auth';
import type { WalletWithMetadata, TwitterOAuthWithMetadata, TelegramWithMetadata } from '@privy-io/react-auth';
import { useTranslation } from 'react-i18next';

const Profile: React.FC = () => {
  const { ready, authenticated, login, user, unlinkTwitter, unlinkTelegram, unlinkWallet } = usePrivy();
  const { linkWallet, linkTwitter, linkTelegram } = useLinkAccount();
  const { t } = useTranslation();

  if (!ready) return null;

  if (!authenticated || !user) {
    return (
      <section className="min-h-[60vh] flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold text-white mb-4">{t('auth.loginRequired')}</h1>
        <p className="text-gray-400 mb-8">{t('auth.loginButton')}</p>
        <button
          onClick={login}
          className="bg-brand-accent hover:bg-brand-accent/80 text-white px-6 py-3 rounded-full font-medium transition-colors"
        >
          {t('auth.connect')}
        </button>
      </section>
    );
  }

  const wallets = user.linkedAccounts.filter(
    (a): a is WalletWithMetadata => a.type === 'wallet',
  );

  const twitterAccount = user.linkedAccounts.find(
    (a): a is TwitterOAuthWithMetadata => a.type === 'twitter_oauth',
  );

  const telegramAccount = user.linkedAccounts.find(
    (a): a is TelegramWithMetadata => a.type === 'telegram',
  );

  return (
    <section className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-white mb-10">{t('auth.profile')}</h1>

      {/* Wallet */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">{t('auth.walletAddress')}</h2>
        {wallets.length > 0 ? (
          <ul className="space-y-3">
            {wallets.map((w) => (
              <li
                key={w.address}
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-5 py-4"
              >
                <span className="text-sm text-gray-300 font-mono break-all">{w.address}</span>
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
          <p className="text-gray-500 text-sm">{t('auth.noWallet')}</p>
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
        <h2 className="text-lg font-semibold text-white mb-4">{t('auth.linkedAccounts')}</h2>
        <div className="space-y-3">
          {/* Twitter */}
          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">Twitter</span>
              {twitterAccount?.username && (
                <span className="text-gray-400 text-sm">@{twitterAccount.username}</span>
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
          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">Telegram</span>
              {telegramAccount && (
                <span className="text-gray-400 text-sm">
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
    </section>
  );
};

export default Profile;
