import React, { useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CallRecord } from '../../data/ethCallsData';
import Avatar from '../debates/Avatar';
import { holderOfSpeaker, speakerOf, videoAt, type Remark } from '../../utils/calls';

interface RemarkModalProps {
    call: CallRecord;
    entries: Remark[];
    index: number;
    /** 목록 제목 (인물 이름이나 주제). 없으면 단일 발언 */
    title?: string;
    onIndex: (i: number) => void;
    onClose: () => void;
}

/** 콜 발언 팝업: 자막 원문 발췌와 번역, 같은 목록(인물·주제)의 다른 발언으로 이동 */
const RemarkModal: React.FC<RemarkModalProps> = ({ call, entries, index, title, onIndex, onClose }) => {
    const { t } = useTranslation('calls');
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
    const speaker = speakerOf(call, entry.position.speaker);
    const holder = holderOfSpeaker(speaker);
    const video = videoAt(call.videoUrl, entry.position.timestamp);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8" role="presentation" onClick={onClose}>
            <div className="absolute inset-0 bg-brand-dark/70 backdrop-blur-sm" aria-hidden />
            <div
                role="dialog"
                data-testid="remark-modal"
                aria-modal="true"
                aria-label={speaker.name}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-3xl max-h-full overflow-y-auto rounded-2xl border border-theme-border bg-theme-surface shadow-2xl text-theme-text"
            >
                <div className="flex items-center gap-3 px-5 py-4 border-b border-theme-border">
                    <Avatar holder={holder} size="lg" />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-bold">{speaker.name}</span>
                            {speaker.handle && (
                                <a href={`https://x.com/${speaker.handle}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-theme-text-muted hover:text-brand-accent">
                                    @{speaker.handle}
                                </a>
                            )}
                        </div>
                        <div className="text-xs text-theme-text-muted flex flex-wrap gap-x-2">
                            {holder.role && <span>{holder.role}</span>}
                            <span className="truncate">{entry.topic.title}</span>
                            {entry.position.timestamp && <span className="font-mono tabular-nums">{entry.position.timestamp}</span>}
                            {entry.position.viaChat && <span>{t('detail.viaChat')}</span>}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('modal.close')}
                        className="w-8 h-8 rounded-full border border-theme-border flex items-center justify-center text-theme-text-muted hover:text-theme-text"
                    >
                        <X size={16} aria-hidden />
                    </button>
                </div>

                <div className="grid md:grid-cols-2">
                    <div className="p-5 md:border-r border-theme-border flex flex-col gap-2">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-theme-text-muted">{entry.position.viaChat ? t('modal.chatOriginal') : t('modal.original')}</span>
                        {entry.position.original ? (
                            <p className="text-sm leading-relaxed text-theme-text-secondary whitespace-pre-line">{entry.position.original}</p>
                        ) : (
                            <p className="text-sm leading-relaxed text-theme-text-muted">{t('modal.noOriginal')}</p>
                        )}
                    </div>
                    <div className="p-5 flex flex-col gap-2 border-t md:border-t-0 border-theme-border">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-theme-text-muted">{entry.position.translation ? t('modal.translation') : t('modal.summary')}</span>
                        <p className="text-sm leading-relaxed whitespace-pre-line">{entry.position.translation ?? entry.position.text}</p>
                        {entry.position.translation && <p className="text-xs leading-relaxed text-theme-text-muted border-t border-theme-border pt-2 mt-1">{entry.position.text}</p>}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-theme-border text-xs text-theme-text-muted">
                    {video && (
                        <a href={video} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-accent hover:underline">
                            {t('modal.video', { t: entry.position.timestamp ?? '' })} <ExternalLink size={11} aria-hidden />
                        </a>
                    )}
                    {speaker.handle && (
                        <a href={`https://x.com/${speaker.handle}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 hover:text-brand-accent">
                            {t('modal.viewOnX')} <ExternalLink size={11} aria-hidden />
                        </a>
                    )}
                </div>

                {entries.length > 1 && (
                    <div className="px-5 py-4 border-t border-theme-border flex flex-col gap-2">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-theme-text-muted">
                            {title ? t('modal.remarksOf', { name: title, count: entries.length }) : t('modal.topicRemarks', { title: entry.topic.title, count: entries.length })} · {index + 1}/{entries.length}
                        </span>
                        <ul className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                            {entries.map((e, i) => (
                                <li key={`${e.topic.title}-${e.position.speaker}-${i}`}>
                                    <button
                                        type="button"
                                        onClick={() => onIndex(i)}
                                        aria-current={i === index}
                                        className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border text-xs transition-colors ${
                                            i === index ? 'border-brand-primary bg-theme-surface-hover' : 'border-theme-border hover:border-brand-primary/50'
                                        }`}
                                    >
                                        <span className="font-mono text-theme-text-muted tabular-nums">{e.position.timestamp ?? '--:--:--'}</span>
                                        <span className="font-semibold shrink-0">{speakerOf(call, e.position.speaker).name}</span>
                                        <span className="truncate text-theme-text-secondary">{e.position.text}</span>
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

export default RemarkModal;
