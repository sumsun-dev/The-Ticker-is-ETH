import { useMemo } from 'react'
import { usePrivy } from '@privy-io/react-auth'

interface ThirdwebAccountInfo {
  address: string
}

export function useThirdwebAccount(): ThirdwebAccountInfo | null {
  const { user, authenticated } = usePrivy()

  return useMemo(() => {
    if (!authenticated || !user) return null

    const walletAccount = user.linkedAccounts.find(
      (a) => a.type === 'wallet',
    )

    if (!walletAccount || !('address' in walletAccount)) return null

    return { address: walletAccount.address }
  }, [authenticated, user])
}
