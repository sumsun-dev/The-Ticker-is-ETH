import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import './i18n'
import './index.css'
import App from './App.tsx'

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['wallet', 'google', 'twitter', 'telegram'],
        appearance: {
          theme: 'dark',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
)
