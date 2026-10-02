import React, { useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { photoUrl, type PhotoEntry } from '../../data/ek1GenesisData';

interface LightboxProps {
    title: string;
    set: string;
    photos: PhotoEntry[];
    index: number;
    onIndex: (i: number) => void;
    onClose: () => void;
}

/** 사진 크게 보기. 좌우 화살표 키, 사진 클릭으로 넘기고 Esc로 닫는다 */
const Lightbox: React.FC<LightboxProps> = ({ title, set, photos, index, onIndex, onClose }) => {
    const { t } = useTranslation('events');
    const closeRef = useRef<HTMLButtonElement>(null);
    const step = useCallback((d: number) => onIndex((index + d + photos.length) % photos.length), [index, onIndex, photos.length]);

    useEffect(() => {
        closeRef.current?.focus();
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') step(1);
            if (e.key === 'ArrowLeft') step(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, step]);

    const [n] = photos[index];
    const nav = 'hidden sm:grid shrink-0 w-11 h-11 place-items-center rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/10';

    return (
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex flex-col bg-black/95 px-4 py-3">
            <div className="mx-auto mb-2 flex w-full max-w-6xl items-center gap-3 text-sm text-theme-text-secondary">
                <b className="truncate text-theme-text font-semibold">{title}</b>
                <span className="ml-auto tabular-nums">
                    {index + 1} / {photos.length}
                </span>
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10"
                >
                    <X size={14} /> {t('genesis.close')}
                </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center gap-3">
                <button type="button" onClick={() => step(-1)} aria-label={t('genesis.prevPhoto')} className={nav}>
                    <ChevronLeft size={20} />
                </button>
                <img
                    src={photoUrl(set, n)}
                    alt=""
                    onClick={() => step(1)}
                    className="max-h-full max-w-full rounded-md object-contain cursor-pointer"
                />
                <button type="button" onClick={() => step(1)} aria-label={t('genesis.nextPhoto')} className={nav}>
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );
};

export default Lightbox;
