import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** /eips와 /ercs 목록 위의 탭. 상단 메뉴는 EIPs 하나로 두고 여기서 나눈다 */
const StandardTabs: React.FC<{ active: 'eip' | 'erc' }> = ({ active }) => {
    const { t } = useTranslation('ercs');
    const tab = (key: 'eip' | 'erc', to: string) => (
        <Link
            to={to}
            role="tab"
            aria-selected={active === key}
            className={`min-h-[40px] flex items-center px-4 rounded-full text-sm transition-colors ${active === key ? 'bg-brand-primary text-white font-semibold' : 'bg-theme-surface text-theme-text-muted hover:text-theme-text'}`}
        >
            {t(`tabs.${key}`)}
        </Link>
    );
    return (
        <div role="tablist" aria-label={t('tabs.label')} className="flex flex-wrap gap-1.5 mb-8">
            {tab('eip', '/eips')}
            {tab('erc', '/ercs')}
        </div>
    );
};

export default StandardTabs;
