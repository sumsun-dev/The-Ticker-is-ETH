import { useLocation } from 'react-router-dom';
import { IS_EN, otherLangHref } from '../../utils/lang';

// 언어마다 주소가 달라(검색엔진이 따로 색인) 전환은 링크 이동이다
const LanguageToggle: React.FC = () => {
    const { pathname, search, hash } = useLocation();
    const isKo = !IS_EN;

    return (
        <a
            href={otherLangHref(pathname, search + hash, IS_EN)}
            hrefLang={isKo ? 'en' : 'ko'}
            className="flex items-center gap-1 text-sm font-medium text-theme-text-muted hover:text-theme-text transition-colors"
            aria-label={isKo ? 'Switch to English' : '한국어로 변경'}
        >
            <span className={isKo ? 'text-theme-text font-bold' : ''}>KO</span>
            <span className="text-theme-text-muted">/</span>
            <span className={!isKo ? 'text-theme-text font-bold' : ''}>EN</span>
        </a>
    );
};

export default LanguageToggle;
