import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import {
    loadEthNews,
    groupOf,
    sourceLabelOf,
    type EthNewsItem,
    type EthNewsGroup,
} from '../data/ethNewsData';

const PAGE_SIZE = 30;

const GROUPS: Array<'all' | EthNewsGroup> = ['all', 'research', 'twitter', 'community', 'korea'];

const GROUP_BADGE_CLASSES: Record<EthNewsGroup, string> = {
    research: 'text-eth-purple bg-eth-purple/10',
    twitter: 'text-brand-accent bg-brand-accent/10',
    community: 'text-theme-text-muted bg-white/5',
    korea: 'text-social-telegram bg-social-telegram/10',
};

function formatRelativeTime(iso: string, locale: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.round(diffMs / 60_000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (minutes < 60) return rtf.format(-Math.max(minutes, 0), 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    if (days < 14) return rtf.format(-days, 'day');
    return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

const News: React.FC = () => {
    const { t, i18n } = useTranslation('news');
    const [items, setItems] = useState<EthNewsItem[]>([]);
    const [fetchedAt, setFetchedAt] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeGroup, setActiveGroup] = useState<'all' | EthNewsGroup>('all');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    usePageMeta({
        title: 'Ethereum News',
        description:
            '이더리움 공식 블로그, 리서치 포럼, 핵심 트위터, 커뮤니티에서 매일 수집한 최신 소식.',
        canonical: '/news',
    });

    useEffect(() => {
        loadEthNews().then((inbox) => {
            setItems(inbox.items);
            setFetchedAt(inbox.fetchedAt);
            setIsLoading(false);
        });
    }, []);

    const countsByGroup = useMemo(() => {
        const counts: Record<'all' | EthNewsGroup, number> = {
            all: items.length,
            research: 0,
            twitter: 0,
            community: 0,
            korea: 0,
        };
        for (const item of items) counts[groupOf(item)]++;
        return counts;
    }, [items]);

    const filteredItems = useMemo(
        () => (activeGroup === 'all' ? items : items.filter((item) => groupOf(item) === activeGroup)),
        [items, activeGroup],
    );

    const visibleItems = filteredItems.slice(0, visibleCount);
    const hasMore = visibleCount < filteredItems.length;

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-12">
                <div className="inline-block px-4 py-1.5 rounded-full border border-theme-border bg-theme-surface backdrop-blur-sm text-sm font-medium text-brand-primary mb-4">
                    {t('badge')}
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-accent">
                    Ethereum News
                </h1>
                <p className="text-theme-text-muted max-w-xl text-lg font-light leading-relaxed">
                    {t('description')}
                </p>
                {fetchedAt && (
                    <p className="text-sm text-theme-text-muted mt-3">
                        {t('updatedAt')} · {formatRelativeTime(fetchedAt, i18n.language)}
                    </p>
                )}
            </motion.div>

            <div className="flex flex-wrap gap-3 mb-10">
                {GROUPS.map((group) => (
                    <button
                        key={group}
                        onClick={() => { setActiveGroup(group); setVisibleCount(PAGE_SIZE); }}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                            activeGroup === group
                                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/25'
                                : 'bg-theme-surface text-theme-text-muted hover:text-theme-text'
                        }`}
                    >
                        {t(`filters.${group}`)}
                        <span className="ml-2 text-xs opacity-70">{countsByGroup[group]}</span>
                    </button>
                ))}
            </div>

            <div className="max-w-3xl space-y-3">
                {isLoading &&
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-theme-surface border border-theme-border rounded-2xl p-5 animate-pulse">
                            <div className="h-3 w-24 bg-white/10 rounded mb-3" />
                            <div className="h-5 w-3/4 bg-white/10 rounded mb-2" />
                            <div className="h-4 w-full bg-white/5 rounded" />
                        </div>
                    ))}

                {!isLoading && visibleItems.length === 0 && (
                    <p className="text-theme-text-muted py-12 text-center">{t('empty')}</p>
                )}

                {visibleItems.map((item) => {
                    const group = groupOf(item);
                    return (
                        <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block bg-theme-surface border border-theme-border rounded-2xl p-5 hover:border-brand-primary/50 transition-colors"
                        >
                            <div className="flex items-center gap-3 mb-2 text-xs">
                                <span className={`px-2.5 py-0.5 rounded-full font-semibold ${GROUP_BADGE_CLASSES[group]}`}>
                                    {sourceLabelOf(item)}
                                </span>
                                <span className="text-theme-text-muted">
                                    {formatRelativeTime(item.publishedAt, i18n.language)}
                                </span>
                                <ExternalLink
                                    size={13}
                                    className="ml-auto text-theme-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-hidden
                                />
                            </div>
                            <h2 className="font-semibold leading-snug mb-1 group-hover:text-brand-accent transition-colors">
                                {item.title}
                            </h2>
                            {item.summary && item.summary !== item.title && (
                                <p className="text-sm text-theme-text-muted line-clamp-2">{item.summary}</p>
                            )}
                        </a>
                    );
                })}

                {hasMore && (
                    <div className="pt-6 text-center">
                        <button
                            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                            className="px-8 py-3 rounded-2xl bg-theme-surface border border-theme-border text-theme-text-muted hover:text-theme-text hover:border-brand-primary/50 transition-colors font-medium"
                        >
                            {t('loadMore')} · {filteredItems.length - visibleCount}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default News;
