import React from 'react';
import { motion } from 'framer-motion';
import { Send, Flag, Mail } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';

const InitiativesSection: React.FC = () => {
    const { t } = useTranslation('home');

    const items = [
        {
            icon: <Send className="text-brand-accent" size={24} />,
            title: t('initiatives.tickerEthTitle'),
            description: t('initiatives.tickerEth'),
        },
        {
            icon: <Flag className="text-brand-primary" size={24} />,
            title: t('initiatives.ethereumKoreaTitle'),
            description: t('initiatives.ethereumKorea'),
        },
        {
            icon: <Mail className="text-pink-400" size={24} />,
            title: t('initiatives.newsletterTitle'),
            description: t('initiatives.newsletter'),
        },
    ];

    return (
        <section className="py-24 relative overflow-hidden bg-theme-bg-secondary">
            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-4xl mx-auto text-center mb-20">
                    <motion.span
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-brand-primary font-bold tracking-widest uppercase text-sm mb-4 block"
                    >
                        {t('initiatives.label')}
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="text-3xl md:text-5xl font-bold mb-8 leading-tight"
                    >
                        <Trans
                            i18nKey="home:initiatives.title"
                            components={{
                                white: <span className="text-theme-text" />,
                                accent: <span className="text-brand-accent" />,
                                br: <br />,
                            }}
                        />
                    </motion.h2>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {items.map((v, i) => (
                        <motion.div
                            key={v.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="p-8 rounded-[2.5rem] border border-theme-border-secondary bg-theme-surface backdrop-blur-md hover:border-brand-primary/30 transition-all group"
                        >
                            <div className="w-14 h-14 bg-theme-surface rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                {v.icon}
                            </div>
                            <h3 className="text-xl font-bold text-theme-text mb-4">{v.title}</h3>
                            <p className="text-theme-text-muted leading-relaxed text-sm font-light">
                                {v.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Background Decoration */}
            <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-accent/5 rounded-full blur-[100px]" />
        </section>
    );
};

export default InitiativesSection;
