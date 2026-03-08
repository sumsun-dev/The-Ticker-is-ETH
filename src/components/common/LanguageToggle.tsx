import { useTranslation } from 'react-i18next';

const LanguageToggle: React.FC = () => {
    const { i18n } = useTranslation();
    const isKo = i18n.language === 'ko';

    const toggle = () => {
        i18n.changeLanguage(isKo ? 'en' : 'ko');
    };

    return (
        <button
            onClick={toggle}
            className="flex items-center gap-1 text-sm font-medium text-theme-text-muted hover:text-theme-text transition-colors"
            aria-label={isKo ? 'Switch to English' : '한국어로 변경'}
        >
            <span className={isKo ? 'text-theme-text font-bold' : ''}>KO</span>
            <span className="text-theme-text-muted">/</span>
            <span className={!isKo ? 'text-theme-text font-bold' : ''}>EN</span>
        </button>
    );
};

export default LanguageToggle;
