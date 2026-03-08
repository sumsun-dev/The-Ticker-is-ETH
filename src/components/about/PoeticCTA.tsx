import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import { ArrowRight, MessageCircle } from 'lucide-react';
import EthDiamond from './EthDiamond';

const PoeticCTA: React.FC = () => {
    const { t } = useTranslation('about');

    return (
        <section className="py-32 px-6 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.02]">
                <EthDiamond className="w-[400px] h-auto text-brand-accent" />
            </div>
            <div className="container mx-auto max-w-2xl relative z-10">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="text-center"
                >
                    <EthDiamond className="w-6 h-auto text-brand-primary/30 mx-auto mb-8" />
                    <blockquote className="mb-8">
                        <p className="text-xl md:text-2xl text-theme-text-secondary font-light leading-loose">
                            <Trans
                                i18nKey="about:poeticQuote"
                                components={{
                                    seed: <span className="text-theme-text font-medium" />,
                                    br: <br />,
                                }}
                            />
                        </p>
                    </blockquote>
                    <div className="flex items-center justify-center gap-2 mb-12">
                        <div className="w-8 h-[1px] bg-white/10" />
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-primary/40" />
                        <div className="w-8 h-[1px] bg-white/10" />
                    </div>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <a
                            href="/team"
                            className="group inline-flex items-center gap-2.5 px-7 py-3 rounded-full bg-gradient-to-r from-brand-primary to-brand-accent text-white font-medium text-sm hover:shadow-lg hover:shadow-brand-primary/20 transition-all"
                        >
                            {t('cta.contribute')}
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a
                            href="https://t.me/thetickeriseth"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex items-center gap-2.5 px-7 py-3 rounded-full border border-theme-border text-theme-text-secondary font-medium text-sm hover:border-brand-primary/40 hover:text-theme-text transition-all"
                        >
                            <MessageCircle size={16} />
                            {t('cta.telegram')}
                        </a>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};

export default PoeticCTA;
