import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DebateHolder, DebateStance, DebateTimelineEntry } from '../../data/ethDebatesData';
import Avatar from './Avatar';
import { STANCE_TEXT, shortDate } from '../../utils/debates';

interface TweetModalProps {
    entries: DebateTimelineEntry[];
    index: number;
    /** 목록 제목 (인물 이름이나 입장 라벨). 없으면 단일 트윗 */
    title?: string;
    holderOf: (by: string) => DebateHolder;
    onIndex: (i: number) => void;
    onClose: () => void;
}

/** 인용 트윗 팝업: 원문 전문과 번역, 같은 목록(인물·입장)의 다른 발언으로 이동 */
const TweetModal: React.FC<TweetModalProps> = ({ entries, index, title, holderOf, onIndex, onClose }) => {
    const { t } = useTranslation('debates');
    const entry = entries[index];

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' && index < entries.length - 1) onIndex(index + 1);
            if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
        };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [entries.length, index, onClose, onIndex]);

    if (!entry) return null;
    const holder = holderOf(entry.by);
    const stance = entry.stance as DebateStance | undefined;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8" role="presentation" onClick={onClose}>
            <div className="absolute inset-0 bg-brand-dark/70 backdrop-blur-sm" aria-hidden />
            <div
                role="dialog"
                data-testid="tweet-modal"
                aria-modal="true"
                aria-label={holder.name}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-3xl max-h-full overflow-y-auto rounded-2xl border border-theme-border bg-theme-surface shadow-2xl text-theme-text"
            >
                <div className="flex items-center gap-3 px-5 py-4 border-b border-theme-border">
                    <Avatar holder={holder} size="lg" />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-bold">{holder.name}</span>
                            {holder.handle && (
                                <a href={`https://x.com/${holder.handle}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-theme-text-muted hover:text-brand-accent">
                                    @{holder.handle}
                                </a>
                            )}
                        </div>
                        <div className="text-xs text-theme-text-muted flex flex-wrap gap-x-2">
                            {holder.role && <span>{holder.role}</span>}
                            <span className="font-mono tabular-nums">{entry.date}</span>
                            {entry.replyTo && <span>{t('repliedTo', { name: holderOf(entry.replyTo).name })}</span>}
                        </div>
                    </div>
                    {stance && <span className={`text-xs ${STANCE_TEXT[stance]}`}>{t(`stance.${stance}`)}</span>}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('close')}
                        className="w-8 h-8 rounded-full border border-theme-border flex items-center justify-center text-theme-text-muted hover:text-theme-text"
                    >
                        <X size={16} aria-hidden />
                    </button>
                </div>

                <div className="grid md:grid-cols-2">
                    <div className="p-5 md:border-r border-theme-border flex flex-col gap-2">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-theme-text-muted">{t('original')}</span>
                        {entry.original ? (
                            <p className="text-sm leading-relaxed text-theme-text-secondary whitespace-pre-line">{entry.original}</p>
                        ) : (
                            <p className="text-sm leading-relaxed text-theme-text-muted">{t('noOriginal')}</p>
                        )}
                    </div>
                    <div className="p-5 flex flex-col gap-2 border-t md:border-t-0 border-theme-border">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-theme-text-muted">
                            {entry.translation ? t('translation') : t('summaryTranslation')}
                        </span>
                        <p className="text-sm leading-relaxed whitespace-pre-line">{entry.translation ?? entry.quote}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-theme-border text-xs text-theme-text-muted">
                    {entry.digest && (
                        <Link to={`/news?date=${entry.digest}`} className="hover:text-brand-accent">
                            {t('digestOf', { date: shortDate(entry.digest) })}
                        </Link>
                    )}
                    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-brand-accent hover:underline">
                        {t('viewOnX')} <ExternalLink size={11} aria-hidden />
                    </a>
                </div>

                {entries.length > 1 && (
                    <div className="px-5 py-4 border-t border-theme-border flex flex-col gap-2">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-theme-text-muted">
                            {title ? t('remarksOf', { title }) : t('otherRemarks')} · {index + 1}/{entries.length}
                        </span>
                        <ul className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                            {entries.map((e, i) => (
                                <li key={`${e.url}-${i}`}>
                                    <button
                                        type="button"
                                        onClick={() => onIndex(i)}
                                        aria-current={i === index}
                                        className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border text-xs transition-colors ${
                                            i === index ? 'border-brand-primary bg-theme-surface-hover' : 'border-theme-border hover:border-brand-primary/50'
                                        }`}
                                    >
                                        <span className="font-mono text-theme-text-muted tabular-nums">{shortDate(e.date)}</span>
                                        <span className="font-semibold shrink-0">{holderOf(e.by).name}</span>
                                        <span className="truncate text-theme-text-secondary">{e.quote}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TweetModal;
