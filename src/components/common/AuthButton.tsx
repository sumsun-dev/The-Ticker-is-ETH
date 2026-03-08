import { useState, useRef, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const truncateAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

const AuthButton: React.FC = () => {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!ready) return null;

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent px-4 py-2 rounded-full text-sm font-medium transition-colors border border-brand-accent/30"
      >
        {t('auth.connect')}
      </button>
    );
  }

  const walletAccount = user?.linkedAccounts.find(
    (a) => a.type === 'wallet' || a.type === 'smart_wallet',
  );
  const displayLabel = walletAccount && 'address' in walletAccount
    ? truncateAddress(walletAccount.address)
    : t('auth.profile');

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="bg-theme-surface hover:bg-theme-surface-hover text-theme-text px-4 py-2 rounded-full text-sm font-medium transition-colors border border-theme-border"
      >
        {displayLabel}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 bg-theme-bg border border-theme-border rounded-xl shadow-xl overflow-hidden z-50">
          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-3 text-sm text-theme-text-secondary hover:bg-theme-surface hover:text-theme-text transition-colors"
          >
            {t('auth.profile')}
          </Link>
          <button
            onClick={() => { logout(); setIsOpen(false); }}
            className="w-full text-left px-4 py-3 text-sm text-theme-text-secondary hover:bg-theme-surface hover:text-theme-text transition-colors border-t border-theme-border-secondary"
          >
            {t('auth.logout')}
          </button>
        </div>
      )}
    </div>
  );
};

export default AuthButton;
