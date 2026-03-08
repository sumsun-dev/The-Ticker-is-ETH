import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadResearchIndex, type ResearchIndexItem } from '../../data/researchData';
import EthThumbnail from '../shared/EthThumbnail';

const UpdatesSection: React.FC = () => {
    const { t } = useTranslation('home');
    const [latestUpdates, setLatestUpdates] = useState<ResearchIndexItem[]>([]);

    useEffect(() => {
        loadResearchIndex().then(data => setLatestUpdates(data.slice(0, 3)));
    }, []);

    return (
        <section className="py-24 bg-brand-dark/50">
            <div className="container mx-auto px-6">
                <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                    <div>
                        <motion.span
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            className="text-brand-accent font-semibold text-sm uppercase tracking-wider mb-2 block"
                        >
                            {t('updates.badge')}
                        </motion.span>
                        <h2 className="text-3xl md:text-4xl font-bold text-theme-text">{t('updates.title')}</h2>
                    </div>
                    <Link to="/contents" className="flex items-center gap-2 text-brand-primary hover:text-brand-accent transition-colors font-semibold group">
                        {t('updates.viewAll')} <ArrowUpRight size={20} className="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                {latestUpdates.length === 0 ? (
                    <div className="grid md:grid-cols-3 gap-8">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="bg-theme-surface border border-theme-border rounded-3xl overflow-hidden animate-pulse">
                                <div className="h-48 bg-theme-surface" />
                                <div className="p-6 space-y-3">
                                    <div className="h-3 w-20 bg-theme-surface-hover rounded" />
                                    <div className="h-5 w-full bg-theme-surface-hover rounded" />
                                    <div className="h-4 w-3/4 bg-theme-surface-hover rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                <div className="grid md:grid-cols-3 gap-8">
                    {latestUpdates.map((item, i) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="bg-theme-surface border border-theme-border rounded-3xl overflow-hidden group hover:border-brand-primary/50 transition-all hover:-translate-y-2"
                        >
                            <Link to={`/contents/${item.id}`} className="block h-48 relative overflow-hidden">
                                {item.thumbnailUrl ? (
                                    <img
                                        src={item.thumbnailUrl}
                                        alt={item.title}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                                    />
                                ) : (
                                    <EthThumbnail articleId={item.id} className="grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" />
                                )}
                                <div className="absolute top-4 left-4">
                                    <span className="bg-brand-primary/80 backdrop-blur-md text-[10px] font-bold text-theme-text px-3 py-1 rounded-full uppercase tracking-widest">
                                        {item.category}
                                    </span>
                                </div>
                            </Link>
                            <div className="p-6">
                                <div className="flex items-center gap-2 text-theme-text-muted text-xs mb-3">
                                    <Calendar size={14} />
                                    {item.date}
                                </div>
                                <Link to={`/contents/${item.id}`}>
                                    <h3 className="text-xl font-bold text-theme-text mb-4 group-hover:text-brand-accent transition-colors line-clamp-2">
                                        {item.title}
                                    </h3>
                                </Link>
                                <p className="text-theme-text-muted text-sm mb-6 line-clamp-2">
                                    {item.summary}
                                </p>
                                <Link to={`/contents/${item.id}`} className="text-sm font-bold text-theme-text flex items-center gap-2 group/btn">
                                    {t('updates.readArticle')} <ArrowUpRight size={16} className="text-brand-primary group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>
                )}
            </div>
        </section>
    );
};

export default UpdatesSection;
