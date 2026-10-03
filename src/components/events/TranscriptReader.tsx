import React, { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { loadTranscripts, type GenesisSession, type GenesisTranscript } from '../../data/ek1GenesisData';

interface TranscriptReaderProps {
    session: GenesisSession;
    onClose: () => void;
}

/** 세션 전문 창. 목차·각주 링크는 창 안에서 스크롤한다 */
const TranscriptReader: React.FC<TranscriptReaderProps> = ({ session, onClose }) => {
    const { t } = useTranslation('events');
    const [tx, setTx] = useState<GenesisTranscript | null | 'error'>(null);
    const boxRef = useRef<HTMLElement>(null);

    useEffect(() => {
        let alive = true;
        loadTranscripts()
            .then((all) => alive && setTx(all[session.id] ?? 'error'))
            .catch(() => alive && setTx('error'));
        return () => {
            alive = false;
        };
    }, [session.id]);

    useEffect(() => {
        boxRef.current?.focus();
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const onClick = (e: React.MouseEvent) => {
        const a = (e.target as HTMLElement).closest('a[href^="#"]');
        if (!a) return;
        e.preventDefault();
        document.getElementById(a.getAttribute('href')!.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div role="dialog" aria-modal="true" aria-label={t('genesis.transcriptOf', { title: session.title })} className="fixed inset-0 z-[100] flex flex-col bg-black/90 px-4 py-3">
            <div className="mx-auto mb-2 flex w-full max-w-3xl items-center justify-between">
                <b className="text-sm text-theme-text">{t('genesis.transcript')}</b>
                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs text-theme-text-secondary hover:bg-white/10"
                >
                    <X size={14} /> {t('genesis.close')}
                </button>
            </div>
            <article
                ref={boxRef}
                tabIndex={-1}
                onClick={onClick}
                className="genesis-transcript mx-auto w-full max-w-3xl min-h-0 flex-1 overflow-y-auto rounded-2xl border border-theme-border bg-brand-surface px-5 py-6 sm:px-7 outline-none"
            >
                <h2 className="text-xl font-bold text-theme-text">{session.title}</h2>
                <p className="mt-1 mb-4 text-sm text-theme-text-muted">{session.speakers}</p>
                <p role="note" className="mb-5 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-100/90">
                    {t('genesis.transcriptNotice')}
                </p>
                {tx === null && <p className="text-theme-text-muted">{t('genesis.loading')}</p>}
                {tx === 'error' && <p className="text-theme-text-muted">{t('genesis.loadError')}</p>}
                {tx && tx !== 'error' && (
                    <>
                        <nav className="mb-6 flex flex-wrap gap-1.5">
                            {tx.toc.map((item, i) => (
                                <a
                                    key={item}
                                    href={`#${session.id}-s${i + 1}`}
                                    className="rounded-full border border-theme-border-secondary px-2.5 py-0.5 text-xs text-theme-text-secondary hover:border-brand-accent hover:text-theme-text"
                                >
                                    {item}
                                </a>
                            ))}
                        </nav>
                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(tx.body) }} />
                        {tx.notes.length > 0 && (
                            <div className="mt-8 border-t border-theme-border pt-4 text-[13px] text-theme-text-muted">
                                <b className="text-theme-text-secondary">{t('genesis.footnotes')}</b>
                                <ol className="mt-2 grid list-decimal gap-2 pl-5">
                                    {tx.notes.map((note) => (
                                        <li key={note.n} id={`${session.id}-fn${note.n}`} className="scroll-mt-3">
                                            <span className="mr-1.5 rounded-full border border-amber-400/40 px-1.5 text-[11px] text-amber-300">{note.kind}</span>
                                            <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.html) }} />
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </>
                )}
            </article>
        </div>
    );
};

export default TranscriptReader;
