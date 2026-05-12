import React, { useState, useMemo } from 'react';
import MemberCard from '../components/team/MemberCard';
import AnimatedNumber from '../components/common/AnimatedNumber';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mockContributors } from '../data/mockData';
import { sortMembers, getTotalContributions } from '../utils/members';
import usePageMeta from '../hooks/usePageMeta';

type SortOption = 'contributions' | 'seniority';

const Contributors: React.FC = () => {
    const [filter, setFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('contributions');
    const { t } = useTranslation('team');
    usePageMeta({ title: 'Contributors', description: 'ECK(Ethereum Collective Korea) 기여자 목록' });

    const [now] = useState(() => Date.now());
    const stats = useMemo(() => {
        const memberCount = mockContributors.length;
        const totalContributions = mockContributors.reduce((sum, m) => sum + getTotalContributions(m.contributions), 0);
        const earliest = mockContributors.reduce((min, m) => {
            const start = new Date(m.period.split(' - ')[0].replace(/\./g, '-')).getTime();
            return start < min ? start : min;
        }, Infinity);
        const days = Math.floor((now - earliest) / 86400000);
        return { memberCount, totalContributions, days };
    }, [now]);

    const categories = useMemo(() => {
        const cats = mockContributors.map(c => c.category);
        return ['all', ...Array.from(new Set(cats))];
    }, []);

    const { activeContributors, inactiveContributors } = useMemo(() => {
        const filtered = mockContributors.filter(member => {
            const matchesFilter = filter === 'all' || member.category === filter;
            const matchesSearch =
                member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                member.role.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesFilter && matchesSearch;
        });
        const sorted = sortMembers(filtered, sortBy);
        return {
            activeContributors: sorted.filter(c => c.isCurrent),
            inactiveContributors: sorted.filter(c => !c.isCurrent),
        };
    }, [filter, searchQuery, sortBy]);

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-16"
            >
                <div className="inline-block px-4 py-1.5 rounded-full border border-theme-border bg-theme-surface backdrop-blur-sm text-sm font-medium text-brand-primary mb-4">
                    {t('contributorBadge')}
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-accent">
                    {t('contributorTitle')}
                </h1>
                <p className="text-theme-text-muted max-w-2xl mx-auto text-lg leading-relaxed font-light">
                    {t('contributorDescription')}
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-16"
            >
                {[
                    { label: t('stats.members'), value: stats.memberCount },
                    { label: t('stats.contributions'), value: stats.totalContributions },
                    { label: t('stats.days'), value: stats.days },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        className="bg-theme-surface border border-theme-border rounded-2xl p-6 text-center backdrop-blur-sm"
                    >
                        <AnimatedNumber value={stat.value} className="text-3xl font-bold text-brand-accent" />
                        <div className="text-sm text-theme-text-muted mt-1">{stat.label}</div>
                    </motion.div>
                ))}
            </motion.div>

            <div className="space-y-8 mb-16">
                {/* Category Filter */}
                <div className="flex flex-wrap justify-center gap-3">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${filter === cat
                                ? 'bg-brand-primary text-theme-text shadow-lg shadow-brand-primary/25'
                                : 'bg-theme-surface text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover'
                                }`}
                        >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col md:flex-row justify-center items-center gap-4">
                    {/* Search */}
                    <div className="relative w-full md:w-[28rem] group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-theme-text-muted group-focus-within:text-brand-accent transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder={t('common:search.contributorPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-theme-border rounded-2xl py-3.5 pl-14 pr-6 text-theme-text text-base focus:outline-none focus:border-brand-accent/50 focus:bg-white/10 transition-all font-light"
                        />
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative w-full md:w-auto">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="appearance-none w-full md:w-56 bg-white/5 border border-theme-border rounded-2xl py-3.5 pl-6 pr-12 text-theme-text font-light focus:outline-none focus:border-brand-accent/50 transition-all shadow-xl cursor-pointer text-sm"
                        >
                            <option value="contributions" className="bg-theme-bg">{t('common:sort.contributions')}</option>
                            <option value="seniority" className="bg-theme-bg">{t('common:sort.seniority')}</option>
                        </select>
                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" size={16} />
                    </div>
                </div>
            </div>

            {activeContributors.length > 0 && (
                <div className="mb-16">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                        <h2 className="text-xl font-semibold text-theme-text">{t('sections.active')} <span className="text-theme-text-muted font-normal text-base ml-1">{activeContributors.length}</span></h2>
                    </div>
                    <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence mode="popLayout">
                            {activeContributors.map((c) => (
                                <MemberCard key={c.id} member={c} />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                </div>
            )}

            {inactiveContributors.length > 0 && (
                <div className="mb-16">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-2.5 h-2.5 bg-gray-500 rounded-full" />
                        <h2 className="text-xl font-semibold text-theme-text">{t('sections.inactive')} <span className="text-theme-text-muted font-normal text-base ml-1">{inactiveContributors.length}</span></h2>
                    </div>
                    <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
                        <AnimatePresence mode="popLayout">
                            {inactiveContributors.map((c) => (
                                <MemberCard key={c.id} member={c} />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                </div>
            )}

            {activeContributors.length === 0 && inactiveContributors.length === 0 && (
                <div className="text-center py-20">
                    <Users className="mx-auto text-gray-700 mb-4" size={48} />
                    <p className="text-theme-text-muted text-lg italic font-light tracking-tight">{t('contributorNoResults')}</p>
                </div>
            )}
        </div>
    );
};

export default Contributors;
