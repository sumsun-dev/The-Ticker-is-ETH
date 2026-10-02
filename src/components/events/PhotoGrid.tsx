import React from 'react';
import { useTranslation } from 'react-i18next';
import { thumbUrl, type PhotoEntry } from '../../data/ek1GenesisData';

interface PhotoGridProps {
    set: string;
    photos: PhotoEntry[];
    /** 먼저 보여줄 장수. 넘치면 마지막 칸에 남은 장수를 표시한다 */
    max: number;
    /** 높이(px). 너비는 사진 비율을 따른다. 모바일에서는 0.62배로 줄여 한 줄에 여러 장 들어가게 한다 */
    height?: number;
    onOpen: (set: string, index: number) => void;
}

/** 가로 스크롤 없이 줄바꿈되는 사진 묶음. 누르면 라이트박스로 연다 */
const PhotoGrid: React.FC<PhotoGridProps> = ({ set, photos, max, height = 118, onOpen }) => {
    const { t } = useTranslation('events');
    const shown = photos.slice(0, max);
    const rest = photos.length - max + 1;

    return (
        <div className="flex flex-wrap gap-1.5">
            {shown.map(([n, w, h], i) => {
                const isMore = i === max - 1 && photos.length > max;
                return (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onOpen(set, i)}
                        aria-label={isMore ? t('genesis.allPhotos', { count: photos.length }) : t('genesis.openPhoto', { n: i + 1 })}
                        className="relative shrink-0 max-w-full overflow-hidden rounded-lg bg-white/5 cursor-zoom-in group h-[var(--hm)] sm:h-[var(--h)]"
                        style={{ '--h': `${height}px`, '--hm': `${Math.round(height * 0.62)}px` } as React.CSSProperties}
                    >
                        <img
                            src={thumbUrl(set, n)}
                            width={Math.round((w / h) * height)}
                            height={height}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="block h-full w-auto max-w-full object-cover transition-opacity group-hover:opacity-85"
                        />
                        {isMore && (
                            <span className="absolute inset-0 grid place-items-center bg-black/60 text-white text-[15px] font-semibold tabular-nums">
                                +{rest}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default PhotoGrid;
