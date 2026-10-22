import React from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { VideoLang } from '../../data/videoData';

/** 영상 음성(진행) 언어. 화면 텍스트는 사이트 언어로 바뀌어도 영상 음성은 그대로라 따로 표시한다 */
const SpokenLangBadge: React.FC<{ lang: VideoLang; className?: string }> = ({ lang, className = '' }) => {
    const { t } = useTranslation('contents');
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border border-theme-border px-2 py-0.5 text-[11px] font-semibold text-theme-text-secondary ${className}`}
        >
            <Languages size={11} aria-hidden="true" />
            {t(lang === 'ko' ? 'video.spokenKo' : 'video.spokenEn')}
        </span>
    );
};

export default SpokenLangBadge;
