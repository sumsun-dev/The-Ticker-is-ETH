import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import EthDiamond from './EthDiamond';

const wordVariants = {
    hidden: { y: '100%', opacity: 0 },
    visible: (i: number) => ({
        y: 0,
        opacity: 1,
        transition: { delay: 0.3 + i * 0.06, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
    }),
};

const OriginStory: React.FC = () => {
    const { t } = useTranslation('about');
    const titleWords = t('whoWeAre').split(' ');

    return (
        <section className="py-24 px-6 border-y border-theme-border-secondary bg-white/[0.01] relative overflow-hidden">
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-brand-accent/5 rounded-full blur-[100px]" />
            <div className="container mx-auto">
                <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-24 items-center">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                    >
                        <h2 className="text-2xl font-bold text-theme-text mb-6 flex items-center gap-3">
                            <EthDiamond className="w-5 h-auto text-brand-primary" />
                            <span className="flex flex-wrap gap-x-2">
                                {titleWords.map((word, i) => (
                                    <span key={i} className="overflow-hidden inline-block">
                                        <motion.span
                                            className="inline-block"
                                            variants={wordVariants}
                                            custom={i}
                                        >
                                            {word}
                                        </motion.span>
                                    </span>
                                ))}
                            </span>
                        </h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.4 }}
                            className="text-lg text-theme-text-secondary leading-relaxed font-light"
                        >
                            <Trans
                                i18nKey="about:whoWeAreDescription"
                                components={{ bold: <span className="text-theme-text font-medium" /> }}
                            />
                        </motion.p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                        className="relative p-[1px] rounded-3xl bg-gradient-to-br from-brand-primary/30 via-transparent to-brand-accent/30"
                    >
                        <div className="bg-brand-dark/90 p-8 rounded-3xl backdrop-blur-sm">
                            <p className="text-lg text-theme-text-secondary leading-relaxed font-light">
                                <Trans
                                    i18nKey="about:philosophyBox"
                                    components={{ accent: <span className="text-brand-accent font-medium" /> }}
                                />
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default OriginStory;
