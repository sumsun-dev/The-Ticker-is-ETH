import React from 'react';
import { useTranslation } from 'react-i18next';
import { photoUrl, thumbUrl, type PhotoEntry } from '../../data/ek1GenesisData';

interface SessionPhotosProps {
    set: string;
    photos: PhotoEntry[];
    onOpen: (set: string, index: number) => void;
}

/**
 * 세션 사진: 크게 보이는 리드 1장 + 오른쪽에 보조 2장.
 * 리드는 가로 사진이면 원래 비율, 세로 사진이면 4:3으로 위쪽을 살려 자른다. 보조 컷은 칸에 맞춰 자른다.
 * 사진이 더 있으면 마지막 칸에 남은 장수를 표시하고, 누르면 라이트박스에서 전부 넘겨 본다.
 */
const SessionPhotos: React.FC<SessionPhotosProps> = ({ set, photos, onOpen }) => {
    const { t } = useTranslation('events');
    if (photos.length === 0) return null;
    const [lead, ...rest] = photos;
    const side = rest.slice(0, 2);
    const hidden = photos.length - 1 - side.length;
    const leadLandscape = lead[1] >= lead[2];

    const tile = 'relative block overflow-hidden rounded-lg cursor-zoom-in group';
    const img = 'transition-opacity duration-300 group-hover:opacity-85';

    return (
        <div className={`grid gap-1.5 ${side.length ? 'grid-cols-[minmax(0,2fr)_minmax(0,1fr)] max-w-[720px]' : 'max-w-[480px]'}`}>
            <button
                type="button"
                onClick={() => onOpen(set, 0)}
                aria-label={t('genesis.openPhoto', { n: 1 })}
                className={tile}
                style={{ backgroundColor: lead[3], aspectRatio: leadLandscape ? `${lead[1]} / ${lead[2]}` : '4 / 3' }}
            >
                <img
                    src={photoUrl(set, lead[0])}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-cover ${leadLandscape ? '' : 'object-top'} ${img}`}
                />
            </button>
            {side.length > 0 && (
                <div className={`grid min-h-0 gap-1.5 ${side.length === 2 ? 'grid-rows-2' : ''}`}>
                    {side.map(([n, , , color], i) => {
                        const index = i + 1;
                        const more = i === side.length - 1 && hidden > 0;
                        return (
                            <button
                                key={n}
                                type="button"
                                onClick={() => onOpen(set, index)}
                                aria-label={more ? t('genesis.allPhotos', { count: photos.length }) : t('genesis.openPhoto', { n: index + 1 })}
                                className={`${tile} min-h-0`}
                                style={{ backgroundColor: color }}
                            >
                                <img src={thumbUrl(set, n)} alt="" loading="lazy" decoding="async" className={`absolute inset-0 h-full w-full object-cover object-top ${img}`} />
                                {more && (
                                    <span className="absolute inset-0 grid place-items-center bg-black/55 text-[15px] font-semibold tabular-nums text-white">
                                        +{hidden}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SessionPhotos;
