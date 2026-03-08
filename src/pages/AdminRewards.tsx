import { usePrivy } from '@privy-io/react-auth'
import { useTranslation } from 'react-i18next'
import MintForm from '../components/rewards/MintForm'

const AdminRewards: React.FC = () => {
  const { t } = useTranslation()
  const { ready, authenticated, login } = usePrivy()

  if (!ready) return null

  if (!authenticated) {
    return (
      <section className="min-h-[60vh] flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold text-theme-text mb-4">{t('rewards.adminTitle')}</h1>
        <p className="text-theme-text-muted mb-8">{t('auth.loginButton')}</p>
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
    <section className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-theme-text mb-3">{t('rewards.adminTitle')}</h1>
      <p className="text-theme-text-muted mb-10">{t('rewards.adminDescription')}</p>
      <MintForm />
    </section>
  )
}

export default AdminRewards
