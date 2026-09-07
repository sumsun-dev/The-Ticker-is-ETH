import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import { loadEthDebates, type Debate } from '../data/ethDebatesData';
import Avatar from '../components/debates/Avatar';
import { STATUS_DOT, STATUS_ORDER, countByCategory, countByStatus, shortDate } from '../utils/debates';

/** 목록 행의 찬반 대면: 찬성 인물 vs 반대 인물 (없으면 첫 두 입장) */
const FaceOff: React.FC<{ debate: Debate }> = ({ debate }) => {
    const pro = debate.positions.find((p) => p.stance === 'pro') ?? debate.positions[0];
    const con = debate.positions.find((p) => p.stance === 'con') ?? debate.positions.find((p) => p !== pro);
    const stack = (holders: Debate['positions'][number]['holders']) => (
        <span className="inline-flex">
            {holders.slice(0, 3).map((h, i) => (
                <Avatar key={h.handle ?? h.name} holder={h} size="sm" className={i > 0 ? '-ml-2 ring-2 ring-brand-dark' : 'ring-2 ring-brand-dark'} />
            ))}
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1.5">
            {stack(pro.holders)}
            {con && (
                <>
                    <span className="text-[10px] font-mono text-theme-text-muted tracking-wider">vs</span>
                    {stack(con.holders)}
                </>
            )}
        </span>
    );
};

const Debates: React.FC = () => {
    const { t } = useTranslation('debates');
    const [debates, setDebates] = useState<Debate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [category, setCategory] = useState<string | null>(null);

    usePageMeta({ title: 'Ethereum Debates', description: t('description'), canonical: '/debates' });

    useEffect(() => {
        loadEthDebates()
            .then(setDebates)
            .finally(() => setIsLoading(false));
    }, []);

    const categories = useMemo(() => countByCategory(debates), [debates]);
    const visible = useMemo(() => (category ? debates.filter((d) => d.category === category) : debates), [debates, category]);
    const statusCounts = useMemo(() => countByStatus(visible), [visible]);

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <div className="max-w-4xl mx-auto">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-10">
                    <div className="inline-block px-4 py-1.5 rounded-full border border-theme-border bg-theme-surface backdrop-blur-sm text-sm font-medium text-brand-primary mb-4">
                        {t('badge')}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-accent">
                        Ethereum Debates
                    </h1>
                    <p className="text-theme-text-muted max-w-xl text-lg font-light leading-relaxed">{t('description')}</p>
                </motion.div>

                <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label={t('all')}>
                    <button
                        role="tab"
                        aria-selected={category === null}
                        onClick={() => setCategory(null)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            category === null ? 'bg-brand-primary text-white' : 'bg-theme-surface text-theme-text-muted hover:text-theme-text'
                        }`}
                    >
                        {t('all')} <span className="ml-1 text-xs opacity-70">{debates.length}</span>
                    </button>
                    {categories.map(({ category: c, count }) => (
                        <button
                            key={c}
                            role="tab"
                            aria-selected={category === c}
                            onClick={() => setCategory(category === c ? null : c)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                category === c ? 'bg-brand-primary text-white' : 'bg-theme-surface text-theme-text-muted hover:text-theme-text'
                            }`}
                        >
                            {c} <span className="ml-1 text-xs opacity-70">{count}</span>
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-theme-text-muted mb-6">
                    {STATUS_ORDER.filter((s) => statusCounts[s] > 0).map((s) => (
                        <span key={s} className="inline-flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} aria-hidden />
                            {t(`status.${s}`)} {statusCounts[s]}
                        </span>
                    ))}
                </div>

                {isLoading ? (
                    <div className="space-y-3" aria-busy>
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-16 rounded-xl bg-theme-surface animate-pulse" />
                        ))}
                    </div>
                ) : visible.length === 0 ? (
                    <p className="text-theme-text-muted py-12">{t('empty')}</p>
                ) : (
                    <ul className="border-t border-theme-border">
                        {visible.map((d) => (
                            <li key={d.id} className="border-b border-theme-border">
                                <Link
                                    to={`/debates/${d.id}`}
                                    className="group grid grid-cols-[12px_minmax(0,1fr)_auto] sm:grid-cols-[12px_minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 py-4 px-1 -mx-1 rounded-lg hover:bg-theme-surface transition-colors"
                                >
                                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[d.status]}`} title={t(`status.${d.status}`)} aria-label={t(`status.${d.status}`)} />
                                    <span className="min-w-0">
                                        <span className="block font-semibold leading-snug group-hover:text-brand-accent transition-colors">{d.title}</span>
                                        <span className="block text-xs text-theme-text-muted mt-1">
                                            {d.category} · {t('positionsCount', { count: d.positions.length })} · {t('quotesCount', { count: d.timeline.length })}
                                        </span>
                                    </span>
                                    <span className="hidden sm:inline-flex">
                                        <FaceOff debate={d} />
                                    </span>
                                    <span className="font-mono text-xs text-theme-text-muted tabular-nums">{shortDate(d.lastActivity)}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default Debates;
