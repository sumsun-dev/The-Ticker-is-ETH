import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const quickLinks = [
  { key: 'nav.about', path: '/about' },
  { key: 'nav.coreTeam', path: '/team' },
  { key: 'nav.contents', path: '/contents' },
  { key: 'nav.events', path: '/events' },
  { key: 'nav.ecosystem', path: '/ecosystem' },
] as const;

const NotFound: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-16">
      <span className="text-7xl font-black text-theme-text/10 mb-4 select-none">404</span>
      <h1 className="text-2xl font-bold text-theme-text mb-3">{t('notFound.title')}</h1>
      <p className="text-theme-text-muted text-sm mb-8 max-w-md">{t('notFound.description')}</p>

      <Link
        to="/"
        className="px-6 py-3 rounded-full bg-brand-accent hover:bg-brand-accent/80 text-white font-medium transition-colors mb-10"
      >
        {t('notFound.backHome')}
      </Link>

      <div className="w-full max-w-sm">
        <h2 className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-4">
          {t('notFound.quickLinks')}
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {quickLinks.map(({ key, path }) => (
            <Link
              key={path}
              to={path}
              className="px-4 py-2 rounded-full bg-theme-surface hover:bg-theme-surface-hover text-sm text-theme-text-secondary hover:text-theme-text transition-colors border border-theme-border"
            >
              {t(key)}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NotFound;
