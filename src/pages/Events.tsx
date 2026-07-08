import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';

interface EventItem {
    id: number;
    date: string;
    title: string;
    descriptionKey: string;
    location?: string;
    link?: string;
    tag?: string;
    image?: string;
}

const upcomingEvents: EventItem[] = [
    {
        id: 102,
        date: '2026.09.28 - 09.29',
        title: 'Ethereum Korea Week',
        descriptionKey: 'ethereumKoreaWeek',
        location: 'Conrad Seoul & Seongsu, Seoul',
        link: 'https://one.ethereumkorea.io/',
        tag: 'Upcoming',
    },
];

const pastEvents: EventItem[] = [
    {
        id: 101,
        date: '2026.04.16',
        title: 'Ethereum Korea One',
        descriptionKey: 'ethereumKoreaOne',
        location: 'DSRV, Seoul',
        link: 'https://ethereumkorea.io/events/2026-04-ethereum-korea-one',
    },
    {
        id: 4,
        date: '2024.10.18 - 10.20',
        title: 'Ethcon Korea 2024',
        descriptionKey: 'ethcon2024',
        location: 'Seoul, Korea',
        link: 'https://2024.ethcon.kr/',
        image: '/assets/events/ethcon2024.webp',
    },
    {
        id: 3,
        date: '2023.09.01 - 09.03',
        title: 'Ethcon Korea 2023',
        descriptionKey: 'ethcon2023',
        location: 'Platz2 (플라츠2), Seoul',
        link: 'https://2023.ethcon.kr/',
        image: '/assets/events/ethcon2023.png',
    },
    {
        id: 2,
        date: '2020.12.19 - 12.20',
        title: 'Ethcon Korea 2020',
        descriptionKey: 'ethcon2020',
        location: 'Seoul, Korea (Online Hybrid)',
        link: 'https://2024.ethcon.kr/archives/',
    },
    {
        id: 1,
        date: '2019.05.27 - 05.28',
        title: 'Ethcon Korea 2019',
        descriptionKey: 'ethcon2019',
        location: 'COEX Grand Ballroom, Seoul',
        link: 'https://genesis.ethcon.kr/',
        image: '/assets/events/ethcon2019.jpg',
    },
];

const EventCard: React.FC<{ event: EventItem; index: number; upcoming?: boolean }> = ({ event, index, upcoming }) => {
    const { t } = useTranslation('events');

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`bg-white/5 border rounded-2xl overflow-hidden transition-colors ${
                upcoming ? 'border-brand-accent/30 hover:border-brand-accent/60' : 'border-theme-border hover:border-white/20'
            }`}
        >
            {/* Image */}
            {event.image && (
                <div className="w-full overflow-hidden relative">
                    <img
                        src={event.image}
                        alt={event.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-auto block opacity-90 hover:opacity-100 transition-opacity duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-brand-surface to-transparent" />
                </div>
            )}

            <div className="p-6 flex flex-col md:flex-row gap-5 items-start">
                <div className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap flex items-center gap-2 shrink-0 ${
                    upcoming ? 'bg-brand-accent/20 text-brand-accent' : 'bg-brand-primary/20 text-brand-primary'
                }`}>
                    <Calendar size={14} />
                    {event.date}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-theme-text">{event.title}</h3>
                        {event.tag && (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full">
                                {event.tag}
                            </span>
                        )}
                    </div>
                    <p className="text-theme-text-secondary text-sm leading-relaxed">{t(`descriptions.${event.descriptionKey}`)}</p>
                    {event.location && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-theme-text-muted">
                            <MapPin size={12} /> {event.location}
                        </div>
                    )}
                    {event.link && (
                        <a href={event.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm text-brand-accent hover:underline">
                            <ExternalLink size={13} /> {t('common:visitWebsite')}
                        </a>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const Events: React.FC = () => {
    const { t } = useTranslation('events');
    usePageMeta({ title: 'Events', description: 'Ethcon Korea 및 이더리움 이벤트' });

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto"
            >
                {/* Upcoming Events */}
                <h1 className="text-4xl font-bold mb-3 text-center text-theme-text">{t('upcoming')}</h1>
                <p className="text-center text-theme-text-muted text-sm mb-12">{t('upcomingSubtitle')}</p>

                <div className="space-y-6 mb-20">
                    {upcomingEvents.map((event, index) => (
                        <EventCard key={event.id} event={event} index={index} upcoming />
                    ))}
                </div>

                {/* Past Events */}
                <div className="flex items-center gap-4 mb-8">
                    <h2 className="text-2xl font-bold text-theme-text whitespace-nowrap">{t('past')}</h2>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="space-y-6">
                    {pastEvents.map((event, index) => (
                        <EventCard key={event.id} event={event} index={index} />
                    ))}
                </div>

                {/* CTA */}
                <div className="mt-20 text-center p-8 bg-gradient-to-br from-brand-primary/10 to-transparent rounded-3xl border border-theme-border-secondary">
                    <h3 className="text-xl font-bold mb-4">{t('ctaTitle')}</h3>
                    <p className="text-theme-text-secondary mb-6">{t('ctaDescription')}</p>
                    <a href="https://t.me/thetickerisethchat" target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-white text-black font-semibold rounded-full hover:bg-gray-200 transition-colors inline-block">
                        {t('contactUs')}
                    </a>
                </div>
            </motion.div>
        </div>
    );
};

export default Events;
