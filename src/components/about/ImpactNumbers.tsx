import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, Eye, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AnimatedNumber from '../common/AnimatedNumber';
import { mockContributors } from '../../data/mockData';
import { loadResearchIndex } from '../../data/researchData';
import telegramStats from '../../data/telegram-stats.json';

const LAUNCH_DATE = new Date('2024-11-01');

const ImpactNumbers: React.FC = () => {
    const { t } = useTranslation('about');

    const [now] = useState(() => Date.now());
    const [researchCount, setResearchCount] = useState(0);

    useEffect(() => {
        loadResearchIndex().then(data => setResearchCount(data.length));
    }, []);

    const stats = useMemo(() => {
        const daysSinceLaunch = Math.floor(
            (now - LAUNCH_DATE.getTime()) / (24 * 60 * 60 * 1000),
        );

        return [
            {
                icon: <Users size={20} />,
                value: mockContributors.length,
                suffix: '+',
                label: t('impact.contributors'),
            },
            {
                icon: <FileText size={20} />,
                value: researchCount,
                suffix: '+',
                label: t('impact.content'),
            },
            {
                icon: <Eye size={20} />,
                value: telegramStats.totalViews,
                suffix: '+',
                label: t('impact.views'),
            },
            {
                icon: <Calendar size={20} />,
                value: daysSinceLaunch,
                suffix: '+',
                label: t('impact.days'),
            },
        ];
    }, [t, now, researchCount]);

    return (
        <section className="py-24 px-6 relative overflow-hidden">
            {/* Horizontal gradient lines */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-primary/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-accent/20 to-transparent" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-brand-primary/5 rounded-full blur-[120px]" />

            <div className="container mx-auto relative z-10">
                <div className="text-center mb-16">
                    <motion.span
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-accent/20 bg-brand-accent/5 text-xs font-semibold tracking-widest text-brand-accent uppercase mb-4"
                    >
                        {t('impact.badge')}
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-3xl md:text-4xl font-bold text-theme-text"
                    >
                        {t('impact.title')}
                    </motion.h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                    {stats.map((stat, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1, duration: 0.5 }}
                            className="flex flex-col items-center text-center p-6"
                        >
                            <div className="text-brand-accent mb-4">
                                {stat.icon}
                            </div>
                            <div className="text-4xl md:text-5xl font-black text-theme-text mb-2 tabular-nums">
                                <AnimatedNumber value={stat.value} />
                                <span className="text-brand-primary">{stat.suffix}</span>
                            </div>
                            <span className="text-xs font-semibold text-theme-text-muted uppercase tracking-widest">
                                {stat.label}
                            </span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ImpactNumbers;
