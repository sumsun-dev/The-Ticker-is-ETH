import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import { GENESIS_BANNER } from '../data/ek1GenesisData';

interface PastEvent {
    id: string;
    year: number;
    date: string;
    title: string;
    descriptionKey: string;
    locationKey: string;
    link: string;
    linkKey: 'website' | 'archive';
    image?: string;
}

const pastEvents: PastEvent[] = [
    {
        id: 'ek1-2026-04',
        year: 2026,
        date: '2026.04.16',
        title: 'Ethereum Korea One',
        descriptionKey: 'ethereumKoreaOne',
        locationKey: 'dsrv',
        link: 'https://ethereumkorea.io/events/2026-04-ethereum-korea-one',
        linkKey: 'website',
    },
    {
        id: 'ethcon2024',
        year: 2024,
        date: '2024.10.18 – 10.20',
        title: 'Ethcon Korea 2024',
        descriptionKey: 'ethcon2024',
        locationKey: 'seoul',
        link: 'https://2024.ethcon.kr/',
        linkKey: 'website',
        image: '/assets/events/ethcon2024.webp',
    },
    {
        id: 'ethcon2023',
        year: 2023,
        date: '2023.09.01 – 09.03',
        title: 'Ethcon Korea 2023',
        descriptionKey: 'ethcon2023',
        locationKey: 'platz2',
        link: 'https://2023.ethcon.kr/',
        linkKey: 'website',
        image: '/assets/events/ethcon2023.png',
    },
    {
        id: 'ethcon2020',
        year: 2020,
        date: '2020.12.19 – 12.20',
        title: 'Ethcon Korea 2020',
        descriptionKey: 'ethcon2020',
        locationKey: 'seoulOnline',
        link: 'https://2024.ethcon.kr/archives/',
        linkKey: 'archive',
    },
    {
        id: 'ethcon2019',
        year: 2019,
        date: '2019.05.27 – 05.28',
        title: 'Ethcon Korea 2019',
        descriptionKey: 'ethcon2019',
        locationKey: 'coex',
        link: 'https://genesis.ethcon.kr/',
        linkKey: 'website',
        image: '/assets/events/ethcon2019.jpg',
    },
];

const years = [...new Set(pastEvents.map((e) => e.year))];

const Events: React.FC = () => {
    const { t } = useTranslation('events');
    usePageMeta({ title: 'Events', description: t('metaDescription') });

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
                <h1 className="text-4xl font-bold text-theme-text">Events</h1>
                <p className="mt-2 mb-10 text-theme-text-muted">{t('subtitle')}</p>

                {/* Upcoming: 예정 행사가 없을 때는 채널 구독 안내 */}
                <div className="mb-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-theme-border bg-white/[0.02] px-6 py-5">
                    <div>
                        <div className="text-xs uppercase tracking-widest text-theme-text-muted">Upcoming</div>
                        <b className="text-theme-text">{t('upcomingEmptyTitle')}</b>
                        <p className="mt-0.5 text-sm text-theme-text-muted">{t('upcomingEmptyBody')}</p>
                    </div>
                    <a
                        href="https://t.me/thetickeriseth"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-theme-border px-4 py-2 text-sm font-semibold text-theme-text hover:bg-white/5"
                    >
                        {t('subscribe')}
                    </a>
                </div>

                <SectionHead title={t('recent')} />
                <article className="mb-16 overflow-hidden rounded-2xl border border-brand-accent/30 bg-brand-surface">
                    <Link to="/events/ek1-genesis" className="block">
                        <img src={GENESIS_BANNER} alt={t('genesis.bannerAlt')} className="block h-auto w-full" />
                    </Link>
                    <div className="grid gap-5 p-6">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <h2 className="text-2xl font-bold text-theme-text">
                                <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-brand-accent">Ethereum Korea One</span>
                                Genesis
                            </h2>
                            <span className="rounded-lg bg-brand-accent/15 px-3 py-1.5 text-sm font-bold tabular-nums text-brand-accent">2026.09.28 – 09.29</span>
                        </div>
                        <p className="text-theme-text-secondary">{t('genesis.lead')}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <DayBox title={t('genesis.day1')} lines={[t('genesis.day1Meta'), t('genesis.day1Who')]} />
                            <DayBox title={t('genesis.day2')} lines={[t('genesis.day2Meta'), t('genesis.day2Who')]} />
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                            <Link
                                to="/events/ek1-genesis"
                                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-200"
                            >
                                {t('genesis.viewRecord')} <ArrowRight size={15} />
                            </Link>
                            <a
                                href="https://one.ethereumkorea.io/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-theme-border px-5 py-2.5 text-sm font-semibold text-theme-text hover:bg-white/5"
                            >
                                <ExternalLink size={14} /> {t('genesis.officialSite')}
                            </a>
                        </div>
                    </div>
                </article>

                <SectionHead title={t('past')} count={pastEvents.length} />
                <div>
                    {years.map((year, yi) => (
                        <div key={year} className={`grid gap-3 py-5 sm:grid-cols-[72px_1fr] sm:gap-5 ${yi ? 'border-t border-theme-border-secondary' : 'pt-0'}`}>
                            <div className="text-xl font-bold tabular-nums text-theme-text-muted">{year}</div>
                            <div className="grid gap-4">
                                {pastEvents
                                    .filter((e) => e.year === year)
                                    .map((e) => (
                                        <div key={e.id} className="grid grid-cols-[88px_1fr] items-start gap-3 sm:grid-cols-[120px_1fr] sm:gap-4">
                                            <div className="grid min-h-[64px] place-items-center overflow-hidden rounded-lg border border-theme-border-secondary bg-white/5 text-xs text-theme-text-muted">
                                                {e.image ? <img src={e.image} alt={e.title} loading="lazy" className="block h-auto w-full" /> : e.title.startsWith('Ethcon') ? 'ETHCON' : 'EK1'}
                                            </div>
                                            <div>
                                                <h3 className="text-[17px] font-semibold text-theme-text">{e.title}</h3>
                                                <div className="mt-0.5 text-[13px] tabular-nums text-theme-text-muted">
                                                    {e.date} · {t(`locations.${e.locationKey}`)}
                                                </div>
                                                <p className="mt-1.5 text-sm text-theme-text-secondary">{t(`descriptions.${e.descriptionKey}`)}</p>
                                                <a href={e.link} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[13px] text-brand-accent hover:underline">
                                                    {t(`links.${e.linkKey}`)}
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-16 rounded-3xl border border-theme-border-secondary bg-gradient-to-br from-brand-primary/10 to-transparent p-8 text-center">
                    <h3 className="mb-3 text-xl font-bold">{t('ctaTitle')}</h3>
                    <p className="mb-6 text-theme-text-secondary">{t('ctaDescription')}</p>
                    <a
                        href="https://t.me/thetickerisethchat"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-full bg-white px-6 py-3 font-semibold text-black transition-colors hover:bg-gray-200"
                    >
                        {t('contactUs')}
                    </a>
                </div>
            </motion.div>
        </div>
    );
};

const SectionHead: React.FC<{ title: string; count?: number }> = ({ title, count }) => (
    <div className="mb-5 flex items-center gap-4">
        <h2 className="whitespace-nowrap text-[22px] font-bold text-theme-text">{title}</h2>
        <div className="h-px flex-1 bg-white/10" />
        {count !== undefined && <span className="text-sm tabular-nums text-theme-text-muted">{count}</span>}
    </div>
);

const DayBox: React.FC<{ title: string; lines: string[] }> = ({ title, lines }) => (
    <div className="grid gap-1 rounded-xl border border-theme-border-secondary bg-white/[0.02] px-4 py-3.5">
        <b className="text-sm text-theme-text">{title}</b>
        {lines.map((l) => (
            <span key={l} className="text-[13px] text-theme-text-muted">
                {l}
            </span>
        ))}
    </div>
);

export default Events;
