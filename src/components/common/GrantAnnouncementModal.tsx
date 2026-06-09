import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, ArrowRight, Check, Users, CalendarDays } from 'lucide-react';

// Bump this key when the announcement content changes so the popup re-appears
// for visitors who previously dismissed an older version.
const STORAGE_KEY = 'eck-grant-popup-2026q3';
const GRANT_URL = 'https://ethereumkorea.io/grant';
const SHOW_DELAY_MS = 900;

// true이면 저장소 무시하고 매번 노출(미리보기용). 운영에서는 false 유지.
const PREVIEW_FORCE = false;

const GrantAnnouncementModal: React.FC = () => {
    const { t } = useTranslation('home');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!PREVIEW_FORCE) {
            try {
                // Permanently hidden via "don't show again"...
                if (localStorage.getItem(STORAGE_KEY) === 'hide') return;
                // ...or already seen in this browsing session.
                if (sessionStorage.getItem(STORAGE_KEY) === 'seen') return;
            } catch {
                // Storage may be unavailable (private mode) — show anyway.
            }
        }
        const timer = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, []);

    const close = useCallback(() => {
        setOpen(false);
        try {
            sessionStorage.setItem(STORAGE_KEY, 'seen');
        } catch {
            /* ignore */
        }
    }, []);

    const dontShowAgain = useCallback(() => {
        setOpen(false);
        try {
            localStorage.setItem(STORAGE_KEY, 'hide');
        } catch {
            /* ignore */
        }
    }, []);

    // Close on Escape + lock body scroll while open.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, close]);

    if (typeof document === 'undefined') return null;

    const who = t('grantPopup.who', { returnObjects: true }) as string[];
    const offer = t('grantPopup.offer', { returnObjects: true }) as string[];

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="grant-modal-title"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={close}
                        aria-hidden="true"
                    />

                    {/* Card */}
                    <motion.div
                        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-2xl shadow-black/50"
                        initial={{ opacity: 0, y: 24, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.98 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {/* Brand glow header */}
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-primary/25 via-brand-primary/5 to-transparent" />

                        {/* Ethereum Korea logo watermark */}
                        <img
                            src="/assets/ethereum-korea-logo-white.png"
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none absolute left-1/2 top-1/2 w-[300px] max-w-[80%] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.09]"
                        />

                        {/* Close button */}
                        <button
                            type="button"
                            onClick={close}
                            aria-label={t('grantPopup.close')}
                            className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full border border-theme-border bg-brand-dark/60 text-theme-text-muted transition-colors hover:text-theme-text hover:border-brand-primary/40"
                        >
                            <X size={16} />
                        </button>

                        <div className="relative max-h-[88vh] overflow-y-auto px-6 pb-6 pt-7 sm:px-8 sm:pb-8">
                            {/* Tag */}
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-accent">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent opacity-75" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-accent" />
                                </span>
                                {t('grantPopup.tag')}
                            </span>

                            {/* Title */}
                            <p className="mt-4 text-sm font-medium text-theme-text-muted">
                                {t('grantPopup.program')}
                            </p>
                            <h2
                                id="grant-modal-title"
                                className="mt-1 text-2xl font-bold leading-tight tracking-tight text-theme-text sm:text-[28px]"
                            >
                                {t('grantPopup.title')}
                            </h2>

                            {/* Intro */}
                            <p className="mt-3 text-[14px] leading-relaxed text-theme-text-secondary">
                                {t('grantPopup.intro')}
                            </p>

                            {/* Who */}
                            <div className="mt-6">
                                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-theme-text-muted">
                                    {t('grantPopup.whoTitle')}
                                </h3>
                                <ul className="mt-2.5 space-y-2">
                                    {who.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-theme-text-secondary">
                                            <Check size={15} className="mt-0.5 shrink-0 text-brand-accent" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Offer */}
                            <div className="mt-5">
                                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-theme-text-muted">
                                    {t('grantPopup.offerTitle')}
                                </h3>
                                <ul className="mt-2.5 space-y-2">
                                    {offer.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-theme-text-secondary">
                                            <Check size={15} className="mt-0.5 shrink-0 text-brand-accent" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Meta cards */}
                            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-theme-border-secondary bg-brand-dark/40 px-4 py-3">
                                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-theme-text-muted">
                                        <Users size={13} className="text-brand-accent" />
                                        {t('grantPopup.metaCohortLabel')}
                                    </div>
                                    <p className="mt-1 text-sm font-semibold text-theme-text">{t('grantPopup.metaCohort')}</p>
                                </div>
                                <div className="rounded-xl border border-theme-border-secondary bg-brand-dark/40 px-4 py-3">
                                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-theme-text-muted">
                                        <CalendarDays size={13} className="text-brand-accent" />
                                        {t('grantPopup.metaScheduleLabel')}
                                    </div>
                                    <p className="mt-1 text-sm font-semibold text-theme-text">{t('grantPopup.metaSchedule')}</p>
                                </div>
                            </div>

                            {/* Contact */}
                            <p className="mt-5 text-xs leading-relaxed text-theme-text-muted">
                                {t('grantPopup.contact')}
                            </p>

                            {/* CTA */}
                            <a
                                href={GRANT_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={close}
                                className="group mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-accent px-7 py-3.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-brand-primary/25"
                            >
                                {t('grantPopup.cta')}
                                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                            </a>

                            {/* Don't show again */}
                            <button
                                type="button"
                                onClick={dontShowAgain}
                                className="mt-3 block w-full text-center text-xs text-theme-text-muted transition-colors hover:text-theme-text-secondary"
                            >
                                {t('grantPopup.dismiss')}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

export default GrantAnnouncementModal;
