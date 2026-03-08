import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mockMembers, mockContributors } from '../../data/mockData';
import EthDiamond from './EthDiamond';

const TeamPreview: React.FC = () => {
    const { t } = useTranslation('about');

    const allMembers = useMemo(() => {
        const coreNames = new Set(mockMembers.map(m => m.name.toLowerCase()));
        const uniqueContributors = mockContributors.filter(
            c => !coreNames.has(c.name.toLowerCase()),
        );
        return [...mockMembers, ...uniqueContributors].slice(0, 20);
    }, []);

    return (
        <section className="py-24 px-6 border-y border-theme-border-secondary bg-white/[0.01] relative overflow-hidden">
            <div className="absolute top-10 right-10 opacity-[0.02]">
                <EthDiamond className="w-72 h-auto text-brand-primary" />
            </div>
            <div className="container mx-auto relative z-10 text-center">
                <motion.span
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/5 text-xs font-semibold tracking-widest text-brand-primary uppercase mb-4"
                >
                    {t('teamPreview.badge')}
                </motion.span>
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-3xl md:text-4xl font-bold text-theme-text mb-4"
                >
                    {t('teamPreview.title')}
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="text-theme-text-secondary font-light mb-12 max-w-lg mx-auto"
                >
                    {t('teamPreview.description')}
                </motion.p>

                {/* Member Grid */}
                <div className="flex flex-wrap items-center justify-center gap-4 mb-12 max-w-3xl mx-auto">
                    {allMembers.map((member, idx) => (
                        <motion.a
                            key={member.id}
                            href={`/team/${member.id}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.05, duration: 0.4 }}
                            className="group relative"
                        >
                            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-theme-border-secondary ring-2 ring-transparent group-hover:ring-brand-primary/50 group-hover:-translate-y-2 transition-all duration-300">
                                <img
                                    src={member.avatarUrl}
                                    alt={member.name}
                                    loading="lazy"
                                    decoding="async"
                                    width={64}
                                    height={64}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {/* Tooltip */}
                            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                <span className="text-[10px] text-theme-text-secondary bg-brand-dark/90 px-2 py-0.5 rounded">{member.name}</span>
                            </div>
                        </motion.a>
                    ))}
                </div>

                {/* CTA */}
                <motion.a
                    href="/team"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    className="group inline-flex items-center gap-2 text-sm font-medium text-brand-primary hover:text-brand-accent transition-colors"
                >
                    {t('teamPreview.viewAll')}
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </motion.a>
            </div>
        </section>
    );
};

export default TeamPreview;
