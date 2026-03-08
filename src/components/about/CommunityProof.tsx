import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Award, Calendar, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AnimatedNumber from '../common/AnimatedNumber';

const LAUNCH_DATE = new Date('2024-11-01');

const CommunityProof: React.FC = () => {
    const { t } = useTranslation('about');

    const [now] = useState(() => Date.now());
    useEffect(() => { /* captured Date.now() once on mount */ }, []);

    const daysSinceLaunch = useMemo(
        () => Math.floor((now - LAUNCH_DATE.getTime()) / (24 * 60 * 60 * 1000)),
        [now],
    );

    const proofs = [
        {
            icon: <Award size={24} />,
            title: t('community.octant'),
            description: t('community.octantDescription'),
            color: 'text-yellow-500',
            stat: null,
        },
        {
            icon: <Calendar size={24} />,
            title: t('community.days'),
            description: t('community.daysDescription'),
            color: 'text-brand-primary',
            stat: daysSinceLaunch,
        },
        {
            icon: <Github size={24} />,
            title: t('community.github'),
            description: t('community.githubDescription'),
            color: 'text-theme-text',
            stat: null,
        },
    ];

    return (
        <section className="py-24 px-6 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-accent/5 rounded-full blur-[100px]" />
            <div className="container mx-auto relative z-10">
                <div className="text-center mb-16">
                    <motion.span
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-accent/20 bg-brand-accent/5 text-xs font-semibold tracking-widest text-brand-accent uppercase mb-4"
                    >
                        {t('community.badge')}
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-3xl md:text-4xl font-bold text-theme-text"
                    >
                        {t('community.title')}
                    </motion.h2>
                </div>

                <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    {proofs.map((proof, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.15, duration: 0.5 }}
                            className="relative p-[1px] rounded-2xl bg-gradient-to-b from-white/10 to-transparent"
                        >
                            <div className="bg-brand-dark/80 backdrop-blur-xl rounded-2xl p-6 h-full flex flex-col">
                                <div className={`${proof.color} mb-4`}>
                                    {proof.icon}
                                </div>
                                <h3 className="text-lg font-bold text-theme-text mb-2">{proof.title}</h3>
                                {proof.stat !== null && (
                                    <div className="text-3xl font-black text-theme-text mb-2 tabular-nums">
                                        <AnimatedNumber value={proof.stat} />
                                        <span className="text-brand-primary text-lg ml-1">{t('community.daysUnit')}</span>
                                    </div>
                                )}
                                <p className="text-sm text-theme-text-secondary font-light leading-relaxed mt-auto">
                                    {proof.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default CommunityProof;
