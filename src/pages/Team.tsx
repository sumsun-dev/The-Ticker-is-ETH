import React, { useState, useMemo } from 'react';
import MemberCard from '../components/team/MemberCard';
import AnimatedNumber from '../components/common/AnimatedNumber';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mockMembers, mockContributors } from '../data/mockData';
import { sortMembers, getTotalContributions } from '../utils/members';
import usePageMeta from '../hooks/usePageMeta';
import type { TeamMember } from '../types/team';

type SortOption = 'contributions' | 'seniority';

// 코어팀과 이름이 겹치는 기여자는 코어팀 카드만 남긴다 (Home과 같은 기준)
const coreNames = new Set(mockMembers.map(m => m.name.toLowerCase()));
const contributors = mockContributors.filter(c => !coreNames.has(c.name.toLowerCase()));
const everyone = [...mockMembers, ...contributors];

const MemberGrid: React.FC<{ members: TeamMember[]; dim?: boolean }> = ({ members, dim }) => (
    <motion.div layout className={`grid md:grid-cols-2 lg:grid-cols-3 gap-6 ${dim ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}`}>
        <AnimatePresence mode="popLayout">
            {members.map((m) => (
                <MemberCard key={m.id} member={m} />
            ))}
        </AnimatePresence>
    </motion.div>
);

const SectionTitle: React.FC<{ title: string; count: number; dot: string }> = ({ title, count, dot }) => (
    <div className="flex items-center gap-3 mb-8">
        <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <h2 className="text-2xl font-bold text-theme-text">
            {title} <span className="text-theme-text-muted font-normal text-base ml-1">{count}</span>
        </h2>
        <div className="h-px flex-grow bg-gradient-to-r from-theme-border to-transparent" />
    </div>
);

const Team: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('contributions');
    const [filter, setFilter] = useState<string>('all');
    const { t } = useTranslation('team');
    usePageMeta({ title: 'Team', description: 'ECK(Ethereum Collective Korea) 코어팀과 기여자' });

    const [now] = useState(() => Date.now());
    const stats = useMemo(() => {
        const totalContributions = everyone.reduce((sum, m) => sum + getTotalContributions(m.contributions), 0);
        const earliest = everyone.reduce((min, m) => {
            const start = new Date(m.period.split(' - ')[0].replace(/\./g, '-')).getTime();
            return start < min ? start : min;
        }, Infinity);
        return { memberCount: everyone.length, totalContributions, days: Math.floor((now - earliest) / 86400000) };
    }, [now]);

    const categories = useMemo(() => ['all', ...Array.from(new Set(contributors.map(c => c.category)))], []);

    const { core, alumni, active, inactive } = useMemo(() => {
        const q = searchQuery.toLowerCase();
        const matches = (m: TeamMember) => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
        const sortedCore = sortMembers(mockMembers.filter(matches), sortBy);
        const sortedContrib = sortMembers(
            contributors.filter(c => matches(c) && (filter === 'all' || c.category === filter)),
            sortBy,
        );
        return {
            core: sortedCore.filter(m => m.isCurrent),
            alumni: sortedCore.filter(m => !m.isCurrent),
            active: sortedContrib.filter(c => c.isCurrent),
            inactive: sortedContrib.filter(c => !c.isCurrent),
        };
    }, [searchQuery, sortBy, filter]);

    const nothing = core.length + alumni.length + active.length + inactive.length === 0;

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-16"
            >
                <div className="inline-block px-4 py-1.5 rounded-full border border-theme-border bg-theme-surface backdrop-blur-sm text-sm font-medium text-brand-primary mb-4">
                    {t('badge')}
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-accent">
                    {t('title')}
                </h1>
                <p className="text-theme-text-muted max-w-2xl mx-auto text-lg leading-relaxed">
                    {t('description')}
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

            <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-16">
                {/* Search */}
                <div className="relative w-full md:w-[28rem] group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-theme-text-muted group-focus-within:text-brand-accent transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder={t('common:search.placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-theme-surface border border-theme-border rounded-2xl py-4 pl-14 pr-6 text-theme-text text-lg focus:outline-none focus:border-brand-accent/50 focus:bg-theme-surface-hover transition-all font-light placeholder:text-theme-text-muted shadow-2xl"
                    />
                </div>

                {/* Sort Dropdown */}
                <div className="relative w-full md:w-auto">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="appearance-none w-full md:w-56 bg-theme-surface border border-theme-border rounded-2xl py-4 pl-6 pr-12 text-theme-text font-light focus:outline-none focus:border-brand-accent/50 transition-all shadow-xl cursor-pointer"
                    >
                        <option value="contributions" className="bg-theme-bg">{t('common:sort.contributions')}</option>
                        <option value="seniority" className="bg-theme-bg">{t('common:sort.seniority')}</option>
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none" size={18} />
                </div>
            </div>

            <div className="space-y-24">
                {core.length > 0 && (
                    <section>
                        <SectionTitle title={t('sections.core')} count={core.length} dot="bg-brand-accent" />
                        <MemberGrid members={core} />
                    </section>
                )}

                <section>
                    <SectionTitle title={t('sections.contributors')} count={active.length} dot="bg-green-500" />
                    {/* Category Filter (기여자에만 적용) */}
                    <div className="flex flex-wrap gap-3 mb-10">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setFilter(cat)}
                                aria-pressed={filter === cat}
                                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${filter === cat
                                    ? 'bg-brand-primary text-theme-text shadow-lg shadow-brand-primary/25'
                                    : 'bg-theme-surface text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover'
                                    }`}
                            >
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </button>
                        ))}
                    </div>
                    {active.length > 0 ? (
                        <MemberGrid members={active} />
                    ) : (
                        <div className="text-center py-10 bg-theme-surface rounded-3xl border border-dashed border-theme-border">
                            <p className="text-theme-text-muted italic">{t('contributorNoResults')}</p>
                        </div>
                    )}
                </section>

                {alumni.length + inactive.length > 0 && (
                    <section>
                        <SectionTitle title={t('sections.alumni')} count={alumni.length + inactive.length} dot="bg-gray-500" />
                        <MemberGrid members={[...alumni, ...inactive]} dim />
                    </section>
                )}

                {nothing && (
                    <div className="text-center py-20">
                        <Users className="mx-auto text-gray-700 mb-4" size={48} />
                        <p className="text-theme-text-muted text-lg italic tracking-tight font-light">
                            {t('common:noResults')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Team;
