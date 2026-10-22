import { useTranslation } from 'react-i18next';
import { toVideoLang, type VideoLang } from '../data/videoData';

/** 지금 사이트 언어에 맞는 영상 텍스트 언어 */
export default function useVideoLang(): VideoLang {
    const { i18n } = useTranslation();
    return toVideoLang(i18n.resolvedLanguage ?? i18n.language);
}
