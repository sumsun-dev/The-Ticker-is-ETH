import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import PhotoGrid from '../components/events/PhotoGrid';
import Lightbox from '../components/events/Lightbox';
import TranscriptReader from '../components/events/TranscriptReader';
import {
    GENESIS_BANNER,
    GENESIS_PHOTOS,
    GENESIS_SESSIONS,
    NETWORKING_SETS,
    sessionsOf,
    type GenesisSession,
    type Track,
} from '../data/ek1GenesisData';

const FLOORS: Track[] = ['2f', '3f', '4f'];

const formatClass = (f: string) =>
    f === '대담' || f === '키노트' || f === '개회'
        ? 'text-eth-purple border-eth-purple/40'
        : f === '라운드테이블'
          ? 'text-amber-300 border-amber-300/40'
          : 'text-brand-accent border-brand-accent/40';

interface SessionRowProps {
    s: GenesisSession;
    onPhoto: (set: string, i: number) => void;
    onTranscript: (s: GenesisSession) => void;
}

const SessionRow: React.FC<SessionRowProps> = ({ s, onPhoto, onTranscript }) => {
    const { t } = useTranslation('events');
    const photos = GENESIS_PHOTOS[s.id] ?? [];
    return (
        <li className="grid gap-1.5 border-b border-theme-border-secondary py-6 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-5">
            <div className="pt-0.5 text-[13px] tabular-nums text-theme-text-muted">{s.time}</div>
            <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 text-[11px] font-semibold tracking-wide ${formatClass(s.format)}`}>{s.format}</span>
                    {s.eck && <span className="rounded-full bg-brand-accent px-2 text-[11px] font-bold text-black">ECK</span>}
                </div>
                <h3 className="text-[17px] font-semibold leading-snug text-theme-text">{s.title}</h3>
                {s.titleEn && <div className="mt-0.5 text-[13px] text-theme-text-muted">{s.titleEn}</div>}
                <div className="mt-1.5 text-[13px] text-theme-text-secondary">{s.speakers}</div>
                {s.quote && <blockquote className="mt-3 border-l-2 border-eth-purple pl-3 text-sm text-theme-text">“{s.quote}”</blockquote>}
                {(s.summary || s.points.length > 0) && (
                    <details className="group mt-3">
                        <summary className="inline-block cursor-pointer list-none text-[13px] text-brand-accent [&::-webkit-details-marker]:hidden">
                            <span className="group-open:hidden">+ </span>
                            <span className="hidden group-open:inline">− </span>
                            {t('genesis.summary')}
                        </summary>
                        {s.summary && <p className="mt-2 text-sm leading-relaxed text-theme-text-secondary">{s.summary}</p>}
                        {s.points.length > 0 && (
                            <ul className="mt-2.5 grid list-disc gap-1.5 pl-5 text-[13.5px] leading-relaxed text-theme-text-secondary">
                                {s.points.map((p) => (
                                    <li key={p}>{p}</li>
                                ))}
                            </ul>
                        )}
                    </details>
                )}
                {s.transcriptChars && (
                    <button
                        type="button"
                        onClick={() => onTranscript(s)}
                        className="mt-3 rounded-full border border-theme-border px-3 py-1 text-[13px] text-theme-text-secondary hover:bg-white/5 hover:text-theme-text"
                    >
                        {t('genesis.readTranscript', { chars: s.transcriptChars.toLocaleString() })}
                    </button>
                )}
                {photos.length > 0 && (
                    <div className="mt-3.5">
                        <PhotoGrid set={s.id} photos={photos} max={6} onOpen={onPhoto} />
                    </div>
                )}
            </div>
        </li>
    );
};

const EventGenesis: React.FC = () => {
    const { t } = useTranslation('events');
    usePageMeta({ title: 'Ethereum Korea One · Genesis', description: t('genesis.metaDescription'), image: GENESIS_BANNER });

    const [day, setDay] = useState<'d1' | 'd2'>('d1');
    const [floor, setFloor] = useState<Track>('2f');
    const [lightbox, setLightbox] = useState<{ set: string; index: number } | null>(null);
    const [reading, setReading] = useState<GenesisSession | null>(null);

    const openPhoto = useCallback((set: string, index: number) => setLightbox({ set, index }), []);
    const closeLightbox = useCallback(() => setLightbox(null), []);
    const closeReader = useCallback(() => setReading(null), []);

    const titleOf = (set: string) =>
        (NETWORKING_SETS as readonly string[]).includes(set) ? t(`genesis.net.${set}`) : (GENESIS_SESSIONS.find((s) => s.id === set)?.title ?? '');

    const list = sessionsOf(day === 'd1' ? 'd1' : floor);
    const tab = (active: boolean) =>
        `grid gap-0.5 rounded-xl border px-4 py-2.5 text-left transition-colors ${active ? 'border-brand-accent/60 bg-brand-accent/10' : 'border-theme-border hover:bg-white/5'}`;

    return (
        <div className="min-h-screen pt-20 pb-20">
            <header className="border-b border-theme-border-secondary">
                <img src={GENESIS_BANNER} alt={t('genesis.bannerAlt')} className="block h-auto w-full" />
                <div className="container mx-auto max-w-5xl px-6 pt-7 pb-8">
                    <Link to="/events" className="mb-5 inline-flex items-center gap-1.5 text-sm text-theme-text-muted hover:text-theme-text">
                        <ArrowLeft size={14} /> Events
                    </Link>
                    <div className="text-xs font-semibold uppercase tracking-widest text-brand-accent">Ethereum Korea One</div>
                    <h1 className="mt-2 text-4xl font-bold tracking-tight text-theme-text sm:text-6xl">Genesis</h1>
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums text-theme-text-secondary">
                        <span>2026.09.28 – 09.29</span>
                        <span>{t('genesis.day1Venue')}</span>
                        <span>{t('genesis.day2Venue')}</span>
                    </div>
                </div>
            </header>

            <div className="container mx-auto max-w-5xl px-6">
                <section className="grid gap-8 py-11 md:grid-cols-[1.3fr_1fr] md:gap-10">
                    <p className="text-base leading-relaxed text-theme-text-secondary">{t('genesis.intro')}</p>
                    <div className="grid grid-cols-2 self-start overflow-hidden rounded-2xl border border-theme-border-secondary bg-theme-border-secondary gap-px">
                        <div className="bg-brand-surface px-4 py-4">
                            <b className="block text-3xl font-bold tabular-nums text-theme-text">30</b>
                            <span className="text-xs text-theme-text-muted">{t('genesis.statSessions')}</span>
                        </div>
                        <div className="bg-brand-surface px-4 py-4">
                            <b className="block text-3xl font-bold tabular-nums text-theme-text">4</b>
                            <span className="text-xs text-theme-text-muted">{t('genesis.statRoundtables')}</span>
                        </div>
                    </div>
                </section>

                <section className="pt-6" aria-labelledby="genesis-program">
                    <div className="mb-5 flex items-center gap-4">
                        <h2 id="genesis-program" className="whitespace-nowrap text-[22px] font-bold text-theme-text">
                            {t('genesis.program')}
                        </h2>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>
                    <div className="mb-2 flex flex-wrap gap-2" role="tablist" aria-label={t('genesis.program')}>
                        <button type="button" role="tab" aria-selected={day === 'd1'} onClick={() => setDay('d1')} className={tab(day === 'd1')}>
                            <b className="text-[15px] text-theme-text">{t('genesis.day1')}</b>
                            <span className="text-xs text-theme-text-muted">{t('genesis.day1Tab')}</span>
                        </button>
                        <button type="button" role="tab" aria-selected={day === 'd2'} onClick={() => setDay('d2')} className={tab(day === 'd2')}>
                            <b className="text-[15px] text-theme-text">{t('genesis.day2')}</b>
                            <span className="text-xs text-theme-text-muted">{t('genesis.day2Tab')}</span>
                        </button>
                    </div>
                    <p className="mt-3.5 mb-4 text-sm text-theme-text-muted">{day === 'd1' ? t('genesis.day1Note') : t('genesis.day2Note')}</p>
                    {day === 'd2' && (
                        <div className="mb-4 flex flex-wrap gap-1.5">
                            {FLOORS.map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    aria-pressed={floor === f}
                                    onClick={() => setFloor(f)}
                                    className={`rounded-full border px-3 py-1.5 text-[13px] ${floor === f ? 'border-white bg-white font-semibold text-black' : 'border-theme-border-secondary bg-brand-surface text-theme-text-secondary'}`}
                                >
                                    {t(`genesis.floor.${f}`)}
                                </button>
                            ))}
                        </div>
                    )}
                    <ol className="border-t border-theme-border-secondary">
                        {list.map((s) => (
                            <SessionRow key={s.id} s={s} onPhoto={openPhoto} onTranscript={setReading} />
                        ))}
                    </ol>
                </section>

                <section className="pt-16" aria-labelledby="genesis-gallery">
                    <div className="mb-5 flex items-center gap-4">
                        <h2 id="genesis-gallery" className="whitespace-nowrap text-[22px] font-bold text-theme-text">
                            {t('genesis.gallery')}
                        </h2>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>
                    <div className="grid gap-6">
                        {NETWORKING_SETS.map((set) => (
                            <div key={set}>
                                <h3 className="mb-2 text-sm font-semibold text-theme-text-secondary">{t(`genesis.net.${set}`)}</h3>
                                <PhotoGrid set={set} photos={GENESIS_PHOTOS[set] ?? []} max={8} height={150} onOpen={openPhoto} />
                            </div>
                        ))}
                    </div>
                </section>

                <div className="mt-12 flex flex-wrap gap-2.5">
                    <a
                        href="https://one.ethereumkorea.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-theme-border px-5 py-2.5 text-sm font-semibold text-theme-text hover:bg-white/5"
                    >
                        <ExternalLink size={14} /> {t('genesis.officialSite')}
                    </a>
                    <Link to="/events" className="inline-flex items-center rounded-full border border-theme-border px-5 py-2.5 text-sm font-semibold text-theme-text hover:bg-white/5">
                        {t('genesis.otherEvents')}
                    </Link>
                </div>
            </div>

            {lightbox && (
                <Lightbox
                    title={titleOf(lightbox.set)}
                    set={lightbox.set}
                    photos={GENESIS_PHOTOS[lightbox.set] ?? []}
                    index={lightbox.index}
                    onIndex={(index) => setLightbox({ set: lightbox.set, index })}
                    onClose={closeLightbox}
                />
            )}
            {reading && <TranscriptReader session={reading} onClose={closeReader} />}
        </div>
    );
};

export default EventGenesis;
