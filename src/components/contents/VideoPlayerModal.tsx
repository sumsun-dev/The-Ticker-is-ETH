import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { embedUrl, watchUrl, type VideoItem } from '../../data/videoData';

interface VideoPlayerModalProps {
    video: VideoItem;
    onClose: () => void;
}

/** 영상 재생 창. Esc, 닫기 버튼, 바깥 영역 클릭으로 닫는다 */
const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ video, onClose }) => {
    const { t } = useTranslation('contents');
    const closeRef = useRef<HTMLButtonElement>(null);

    const dialogRef = useRef<HTMLDivElement>(null);

    // 열 때 닫기 버튼으로 포커스를 옮기고, 닫을 때 연 버튼으로 돌려준다
    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
            opener?.focus();
        };
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Tab') trapFocus(e);
        };
        const trapFocus = (e: KeyboardEvent) => {
            const items = dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button, iframe');
            if (!items || items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const onBackdrop = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    return createPortal(
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={video.title}
            onClick={onBackdrop}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 px-4 py-6"
        >
            <div className="w-full max-w-5xl">
                <div className="mb-3 flex items-center gap-3 text-sm text-theme-text-secondary">
                    <b className="truncate font-semibold text-theme-text">{video.title}</b>
                    <a
                        href={watchUrl(video.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10"
                    >
                        <ExternalLink size={13} /> {t('video.watchOnYoutube')}
                    </a>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10"
                    >
                        <X size={14} /> {t('video.close')}
                    </button>
                </div>
                <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
                    <iframe
                        title={video.title}
                        src={embedUrl(video.id)}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default VideoPlayerModal;
