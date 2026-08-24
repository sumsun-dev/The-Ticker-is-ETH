import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import {
    loadEthNews,
    loadEthDigests,
    groupOf,
    sourceLabelOf,
    type EthNewsItem,
    type EthNewsGroup,
    type EthDigest,
} from '../data/ethNewsData';

const FEED_PAGE_SIZE = 30;

const FEED_GROUPS: Array<'all' | Exclude<EthNewsGroup, 'korea'>> = ['all', 'research', 'twitter', 'community'];

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

function formatDigestDate(date: string, locale: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
    });
}

const News: React.FC = () => {
    const { t, i18n } = useTranslation('news');
    const [digests, setDigests] = useState<EthDigest[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [feedItems, setFeedItems] = useState<EthNewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFeedOpen, setIsFeedOpen] = useState(false);
    const [activeGroup, setActiveGroup] = useState<'all' | EthNewsGroup>('all');
    const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);

    usePageMeta({
        title: 'Ethereum News',
        description: '이더리움 공식 블로그·리서치 포럼·핵심 트위터·커뮤니티 소식을 매일 수집해 한국어 다이제스트로 정리합니다.',
        canonical: '/news',
    });

    useEffect(() => {
        Promise.all([loadEthDigests(), loadEthNews()]).then(([digestData, inbox]) => {
            setDigests(digestData);
            // 피드는 다이제스트 보조 자료: 코인니스(텔레그램) 원문은 저작권상 노출하지 않음
            setFeedItems(inbox.items.filter((item) => item.sourceType !== 'telegram'));
            setIsLoading(false);
        });
    }, []);

    const currentDigest = useMemo(
        () => digests.find((d) => d.date === selectedDate) ?? digests[0] ?? null,
        [digests, selectedDate],
    );

    const filteredFeed = useMemo(
        () => (activeGroup === 'all' ? feedItems : feedItems.filter((item) => groupOf(item) === activeGroup)),
        [feedItems, activeGroup],
    );

    const visibleFeed = filteredFeed.slice(0, visibleCount);

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
            </motion.div>

            {isLoading && (
                <div className="max-w-3xl space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-theme-surface border border-theme-border rounded-2xl p-6 animate-pulse">
                            <div className="h-4 w-32 bg-white/10 rounded mb-4" />
                            <div className="h-6 w-3/4 bg-white/10 rounded mb-3" />
                            <div className="h-4 w-full bg-white/5 rounded" />
                        </div>
                    ))}
                </div>
            )}

            {/* ── 데일리 다이제스트 ─────────────────────────── */}
            {!isLoading && currentDigest && (
                <article className="max-w-3xl">
                    <p className="text-sm font-medium text-brand-accent mb-2">
                        {formatDigestDate(currentDigest.date, i18n.language)} · {t('latestDigest')}
                    </p>
                    <h2 className="text-2xl md:text-4xl font-bold leading-snug mb-5 text-balance">
                        {currentDigest.title}
                    </h2>
                    <p className="text-theme-text-muted text-lg font-light leading-relaxed mb-10">
                        {currentDigest.intro}
                    </p>

                    {currentDigest.sections.map((section) => (
                        <section key={section.heading} className="mb-10">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-eth-purple mb-4">
                                {section.heading}
                            </h3>
                            <div className="space-y-4">
                                {section.items.map((item) => (
                                    <div
                                        key={item.url}
                                        className="bg-theme-surface border border-theme-border rounded-2xl p-5 hover:border-brand-primary/40 transition-colors"
                                    >
                                        <h4 className="font-semibold leading-snug mb-2">{item.title}</h4>
                                        <p className="text-sm text-theme-text-muted leading-relaxed mb-3">
                                            {item.summary}
                                        </p>
                                        <div className="flex items-center gap-3 text-xs text-theme-text-muted">
                                            <span className="font-medium">{item.source}</span>
                                            <span>{item.date}</span>
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-auto inline-flex items-center gap-1 text-brand-accent hover:underline"
                                            >
                                                {t('viewOriginal')} <ExternalLink size={12} aria-hidden />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}

                    {/* 지난 다이제스트 */}
                    {digests.length > 1 && (
                        <section className="mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-theme-text-muted mb-4">
                                {t('pastDigests')}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {digests.map((digest) => (
                                    <button
                                        key={digest.date}
                                        onClick={() => { setSelectedDate(digest.date); window.scrollTo(0, 0); }}
                                        aria-pressed={digest.date === currentDigest.date}
                                        className={`px-4 py-2 rounded-full text-sm transition-all ${
                                            digest.date === currentDigest.date
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-theme-surface text-theme-text-muted hover:text-theme-text'
                                        }`}
                                    >
                                        {digest.date}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}
                </article>
            )}

            {!isLoading && !currentDigest && (
                <p className="text-theme-text-muted py-12">{t('empty')}</p>
            )}

            {/* ── 실시간 수집 피드 (보조) ─────────────────────── */}
            {!isLoading && feedItems.length > 0 && (
                <div className="max-w-3xl mt-14 pt-10 border-t border-theme-border">
                    <button
                        onClick={() => setIsFeedOpen((prev) => !prev)}
                        aria-expanded={isFeedOpen}
                        className="flex items-center gap-2 text-sm font-medium text-theme-text-muted hover:text-theme-text transition-colors"
                    >
                        <ChevronDown
                            size={16}
                            className={`transition-transform ${isFeedOpen ? 'rotate-180' : ''}`}
                            aria-hidden
                        />
                        {isFeedOpen ? t('hideFeed') : t('showFeed')} · {feedItems.length}
                    </button>

                    {isFeedOpen && (
                        <div className="mt-6">
                            <p className="text-xs text-theme-text-muted mb-5">{t('feedNote')}</p>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {FEED_GROUPS.map((group) => (
                                    <button
                                        key={group}
                                        onClick={() => { setActiveGroup(group); setVisibleCount(FEED_PAGE_SIZE); }}
                                        className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                                            activeGroup === group
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-theme-surface text-theme-text-muted hover:text-theme-text'
                                        }`}
                                    >
                                        {t(`filters.${group}`)}
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-2">
                                {visibleFeed.map((item) => {
                                    const group = groupOf(item);
                                    return (
                                        <a
                                            key={item.id}
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex items-center gap-3 py-2.5 px-4 rounded-xl border border-transparent hover:border-theme-border hover:bg-theme-surface transition-colors"
                                        >
                                            <span className={`flex-none px-2 py-0.5 rounded-full text-[10px] font-semibold ${GROUP_BADGE_CLASSES[group]}`}>
                                                {sourceLabelOf(item)}
                                            </span>
                                            <span className="text-sm truncate group-hover:text-brand-accent transition-colors">
                                                {item.title}
                                            </span>
                                            <span className="ml-auto flex-none text-xs text-theme-text-muted">
                                                {formatRelativeTime(item.publishedAt, i18n.language)}
                                            </span>
                                        </a>
                                    );
                                })}
                            </div>
                            {visibleCount < filteredFeed.length && (
                                <div className="pt-5 text-center">
                                    <button
                                        onClick={() => setVisibleCount((prev) => prev + FEED_PAGE_SIZE)}
                                        className="px-6 py-2 rounded-xl bg-theme-surface border border-theme-border text-sm text-theme-text-muted hover:text-theme-text transition-colors"
                                    >
                                        {t('loadMore')} · {filteredFeed.length - visibleCount}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default News;
