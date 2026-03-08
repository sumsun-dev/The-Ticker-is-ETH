import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Users, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EthDiamond from './EthDiamond';

const CoreValues: React.FC = () => {
    const { t } = useTranslation('about');

    const values = [
        {
            icon: <Heart size={22} />,
            title: t('publicGoods'),
            subtitle: t('publicGoodsSubtitle'),
            color: 'text-pink-500',
            description: t('publicGoodsDescription'),
        },
        {
            icon: <Users size={22} />,
            title: t('communityDriven'),
            subtitle: t('communityDrivenSubtitle'),
            color: 'text-brand-accent',
            description: t('communityDrivenDescription'),
        },
        {
            icon: <Globe size={22} />,
            title: t('builderEcosystem'),
            subtitle: t('builderEcosystemSubtitle'),
            color: 'text-brand-primary',
            description: t('builderEcosystemDescription'),
        },
    ];

    return (
        <section className="py-32 px-6 relative overflow-hidden">
            <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-brand-primary/5 rounded-full blur-[120px]" />
            <div className="container mx-auto relative z-10">
                <div className="text-center mb-24">
                    <h2 className="text-3xl md:text-4xl font-bold text-theme-text mb-4">{t('philosophy')}</h2>
                    <div className="h-0.5 w-12 bg-gradient-to-r from-brand-primary to-brand-accent mx-auto" />
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {values.map((item, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 60 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.15, duration: 0.6 }}
                            className="group relative p-[1px] rounded-[2rem] bg-gradient-to-b from-white/10 to-transparent hover:from-brand-primary/40 transition-all duration-500"
                        >
                            <div className="relative bg-theme-bg rounded-[2rem] p-8 h-full flex flex-col items-center text-center overflow-hidden">
                                {/* Hover gradient bar */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-0 group-hover:w-3/4 bg-gradient-to-r from-brand-primary to-brand-accent transition-all duration-500" />

                                {/* Hover background EthDiamond */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500">
                                    <EthDiamond className="w-48 h-auto text-brand-accent" />
                                </div>

                                <div className={`relative z-10 w-14 h-14 rounded-2xl bg-white/5 border border-theme-border flex items-center justify-center mb-8 ${item.color} group-hover:scale-110 transition-transform duration-300`}>
                                    {item.icon}
                                </div>
                                <h3 className="relative z-10 text-xl font-bold text-theme-text mb-2">{item.title}</h3>
                                <span className="relative z-10 text-xs font-semibold text-theme-text-muted uppercase tracking-widest mb-4">{item.subtitle}</span>
                                <p className="relative z-10 text-theme-text-secondary font-light leading-relaxed text-sm">
                                    {item.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default CoreValues;
