import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { thumbUrl, type PhotoEntry } from '../../data/ek1GenesisData';
import { layoutRows } from '../../utils/justify';

interface JustifiedGalleryProps {
    set: string;
    photos: PhotoEntry[];
    /** 보여줄 줄 수. 넘치면 마지막 칸에 남은 장수를 표시한다 */
    rows: number;
    onOpen: (set: string, index: number) => void;
}

const JustifiedGallery: React.FC<JustifiedGalleryProps> = ({ set, photos, rows, onOpen }) => {
    const { t } = useTranslation('events');
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () => setWidth(el.clientWidth);
        update();
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const target = width < 640 ? 104 : 160;
    const layout = width ? layoutRows(photos.map(([, w, h]) => w / h), width, target, rows) : [];
    const shown = layout.reduce((n, r) => n + r.count, 0);
    const hidden = photos.length - shown;

    const starts = layout.map((_, ri) => layout.slice(0, ri).reduce((n, r) => n + r.count, 0));
    return (
        <div ref={ref} className="grid gap-1.5">
            {layout.map((row, ri) => (
                <div key={ri} className="flex gap-1.5 overflow-hidden">
                    {photos.slice(starts[ri], starts[ri] + row.count).map(([n, w, h, color], k) => {
                        const i = starts[ri] + k;
                        const more = i === shown - 1 && hidden > 0;
                        return (
                            <button
                                key={n}
                                type="button"
                                onClick={() => onOpen(set, i)}
                                aria-label={more ? t('genesis.allPhotos', { count: photos.length }) : t('genesis.openPhoto', { n: i + 1 })}
                                className="relative shrink-0 overflow-hidden rounded-lg cursor-zoom-in group"
                                style={{ width: (w / h) * row.height, height: row.height, backgroundColor: color }}
                            >
                                <img src={thumbUrl(set, n)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-85" />
                                {more && <span className="absolute inset-0 grid place-items-center bg-black/55 text-[15px] font-semibold tabular-nums text-white">+{hidden}</span>}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default JustifiedGallery;
