import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, Clock, ArrowRight, PenSquare, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadContentsIndex, type ResearchIndexItem } from '../data/researchData';
import { getAvatarFallbackUrl } from '../utils/members';
import EthThumbnail from '../components/shared/EthThumbnail';
import usePageMeta from '../hooks/usePageMeta';

const PAGE_SIZE = 12;
const DEBOUNCE_MS = 300;

function getSessionList<T>(key: string): T[] {
    try {
        const stored = sessionStorage.getItem(key);
        return stored ? JSON.parse(stored) as T[] : [];
    } catch {
        return [];
    }
}

const Contents: React.FC = () => {
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [activeAuthor, setActiveAuthor] = useState<string>('all');
    const [isAdmin] = useState(() => localStorage.getItem('isAdmin') === 'true');
    const [contentsItems, setContentsItems] = useState<ResearchIndexItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const { t } = useTranslation('contents');
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    usePageMeta({ title: 'Contents', description: '이더리움 리서치, 뉴스, 주간 리포트' });

    const handleSearchInput = useCallback((value: string) => {
        setSearchInput(value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchQuery(value);
            setVisibleCount(PAGE_SIZE);
        }, DEBOUNCE_MS);
    }, []);

    useEffect(() => {
        return () => clearTimeout(debounceRef.current);
    }, []);

    useEffect(() => {
        loadContentsIndex().then(data => {
            setContentsItems(data);
            setIsLoading(false);
        });
    }, []);

    const categories = ['all', 'Short', 'Forwarded', 'Research', 'Weekly Report'];

    const authors = useMemo(() => {
        const authorSet = new Set(contentsItems.map(item => item.author));
        return Array.from(authorSet).sort();
    }, [contentsItems]);

    const filteredContents = useMemo(() => {
        const deletedIds = new Set(getSessionList<string>('deletedIds'));
        const published = getSessionList<ResearchIndexItem>('publishedEntries');

        const existingIds = new Set(contentsItems.map(item => item.id));
        const newEntries = published.filter(e => !existingIds.has(e.id) && !deletedIds.has(e.id));
        const allItems = [...newEntries, ...contentsItems];

        return allItems.filter(item => {
            if (deletedIds.has(item.id)) return false;
            const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
            const matchesAuthor = activeAuthor === 'all' || item.author === activeAuthor;
            const matchesSearch =
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.author.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesAuthor && matchesSearch;
        });
    }, [searchQuery, activeCategory, activeAuthor, contentsItems]);

    const visibleItems = useMemo(
        () => filteredContents.slice(0, visibleCount),
        [filteredContents, visibleCount],
    );

    const hasMore = visibleCount < filteredContents.length;

    const handleLoadMore = useCallback(() => {
        setVisibleCount(prev => prev + PAGE_SIZE);
    }, []);

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <div className="inline-block px-4 py-1.5 rounded-full border border-theme-border bg-theme-surface backdrop-blur-sm text-sm font-medium text-brand-primary mb-4">
                        {t('badge')}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-accent">
                        Contents
                    </h1>
                    <p className="text-theme-text-muted max-w-xl text-lg font-light leading-relaxed">
                        {t('description')}
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    {isAdmin && (
                        <Link
                            to="/contents/write"
                            className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/80 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-brand-primary/20"
                        >
                            <PenSquare size={20} />
                            {t('writeResearch')}
                        </Link>
                    )}
                </motion.div>
            </div>

            <div className="space-y-8 mb-16">
                {/* Category Filter */}
                <div className="flex flex-wrap gap-3">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => { setActiveCategory(cat); setVisibleCount(PAGE_SIZE); }}
                            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeCategory === cat
                                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/25'
                                : 'bg-theme-surface text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover'
                                }`}
                        >
                            {cat === 'all' ? t('categories.all') : t(`categories.${cat}`)}
                        </button>
                    ))}
                </div>

                {/* Author Filter */}
                {authors.length > 1 && (
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-sm text-theme-text-muted mr-1">{t('authorFilter')}:</span>
                        <button
                            onClick={() => { setActiveAuthor('all'); setVisibleCount(PAGE_SIZE); }}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeAuthor === 'all'
                                ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/30'
                                : 'bg-theme-surface text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover'
                                }`}
                        >
                            {t('allAuthors')}
                        </button>
                        {authors.map((author) => (
                            <button
                                key={author}
                                onClick={() => { setActiveAuthor(author); setVisibleCount(PAGE_SIZE); }}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${activeAuthor === author
                                    ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/30'
                                    : 'bg-theme-surface text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover'
                                    }`}
                            >
                                {author}
                            </button>
                        ))}
                    </div>
                )}

                {/* Search */}
                <div className="relative w-full md:w-[28rem] group">
                    <label htmlFor="contents-search" className="sr-only">{t('common:search.researchPlaceholder')}</label>
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-theme-text-muted group-focus-within:text-brand-accent transition-colors" size={20} aria-hidden="true" />
                    <input
                        id="contents-search"
                        type="text"
                        placeholder={t('common:search.researchPlaceholder')}
                        value={searchInput}
                        onChange={(e) => handleSearchInput(e.target.value)}
                        className="w-full bg-theme-surface border border-theme-border rounded-2xl py-4 pl-14 pr-6 text-theme-text text-lg focus:outline-none focus:border-brand-accent/50 focus:bg-theme-surface-hover transition-all font-light placeholder:text-theme-text-muted shadow-2xl"
                    />
                </div>
            </div>

            <div aria-live="polite" className="sr-only">
                {!isLoading && `${filteredContents.length} results`}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-32">
                    <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <AnimatePresence mode="popLayout">
                    {visibleItems.map((item) => (
                        <motion.article
                            key={item.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="group bg-theme-surface border border-theme-border rounded-[2.5rem] overflow-hidden hover:border-brand-primary/50 transition-all duration-500 flex flex-col"
                        >
                            <Link to={`/contents/${item.id}`} className="block relative aspect-video overflow-hidden">
                                {item.thumbnailUrl ? (
                                    <img
                                        src={item.thumbnailUrl}
                                        alt={item.title}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                ) : (
                                    <EthThumbnail articleId={item.id} className="transition-transform duration-700 group-hover:scale-110" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-brand-dark to-transparent opacity-60" />
                                <div className="absolute top-4 left-4 flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-full bg-brand-primary/20 backdrop-blur-md border border-theme-border text-xs font-bold text-brand-primary uppercase">
                                        {t(`categories.${item.category}`)}
                                    </span>
                                    {'forwardedFrom' in item && item.forwardedFrom && (
                                        <span className="px-3 py-1 rounded-full bg-theme-surface backdrop-blur-md border border-theme-border text-xs text-theme-text-secondary">
                                            via {item.forwardedFrom === 'Unknown' ? t('forwardedFromUnknown') : item.forwardedFrom}
                                        </span>
                                    )}
                                </div>
                            </Link>

                            <div className="p-8 flex-grow flex flex-col">
                                <Link to={`/contents/${item.id}`}>
                                    <h3 className="text-2xl font-bold mb-4 group-hover:text-brand-accent transition-colors line-clamp-2 leading-snug">
                                        {item.title}
                                    </h3>
                                </Link>
                                <p className="text-theme-text-muted font-light text-base mb-6 line-clamp-3 leading-relaxed">
                                    {item.summary}
                                </p>

                                <div className="mt-auto pt-6 border-t border-theme-border-secondary flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5 text-theme-text-muted">
                                            <img
                                                src={item.authorAvatar}
                                                alt={item.author}
                                                loading="lazy"
                                                decoding="async"
                                                width={20}
                                                height={20}
                                                className="w-5 h-5 rounded-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = getAvatarFallbackUrl(item.author, 20);
                                                }}
                                            />
                                            <span>{item.author}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-theme-text-muted">
                                            <Clock size={14} />
                                            <span>{item.readTime}</span>
                                        </div>
                                    </div>
                                    <Link
                                        to={`/contents/${item.id}`}
                                        className="text-brand-primary hover:text-theme-text transition-colors p-2"
                                    >
                                        <ArrowRight size={20} />
                                    </Link>
                                </div>
                            </div>
                        </motion.article>
                    ))}
                </AnimatePresence>
            </div>
            )}

            {!isLoading && hasMore && (
                <div className="flex justify-center mt-12">
                    <button
                        onClick={handleLoadMore}
                        className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-theme-surface border border-theme-border text-theme-text-secondary hover:text-theme-text hover:bg-theme-surface-hover hover:border-brand-primary/30 transition-all font-medium"
                    >
                        <ChevronDown size={18} />
                        {t('loadMore', { count: Math.min(PAGE_SIZE, filteredContents.length - visibleCount) })}
                    </button>
                </div>
            )}

            {!isLoading && filteredContents.length === 0 && (
                <div className="text-center py-32 rounded-[3rem] bg-theme-surface/50 border border-dashed border-theme-border">
                    <BookOpen className="mx-auto text-gray-700 mb-6" size={64} />
                    <p className="text-theme-text-muted text-xl font-light italic">
                        {t('noResults')}
                    </p>
                </div>
            )}
        </div>
    );
};

export default Contents;
