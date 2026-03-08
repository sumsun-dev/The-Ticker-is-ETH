import { PrivyProvider } from '@privy-io/react-auth';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string;

const PrivyWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PrivyProvider
    appId={PRIVY_APP_ID}
    config={{
      loginMethods: ['wallet', 'google', 'twitter', 'telegram'],
      appearance: { theme: 'dark' },
      embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
    }}
  >
    {children}
  </PrivyProvider>
);

export default PrivyWrapper;
