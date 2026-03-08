import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import EthDiamond from './EthDiamond';

const AboutHero: React.FC = () => {
    const { t } = useTranslation('about');
    const sectionRef = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ['start start', 'end start'],
    });
    const textY = useTransform(scrollYProgress, [0, 1], [0, 120]);
    const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

    return (
        <section ref={sectionRef} className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
            {/* Background Image */}
            <div className="absolute inset-0">
                <img
                    src="/assets/about/hero-bg.png"
                    alt=""
                    decoding="async"
                    className="w-full h-full object-cover opacity-40"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/40 via-brand-dark/50 to-brand-dark" />
            </div>

            {/* Background Decorations */}
            <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 opacity-[0.03]">
                <EthDiamond className="w-[600px] h-auto text-brand-accent" />
            </div>
            <div className="absolute top-20 left-10 w-72 h-72 bg-brand-primary/5 rounded-full blur-[120px]" />

            {/* Content with Parallax */}
            <motion.div
                style={{ y: textY, opacity: textOpacity }}
                className="container mx-auto relative z-10 text-center"
            >
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-4xl mx-auto"
                >
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/5 backdrop-blur-sm text-xs font-semibold tracking-widest text-brand-primary uppercase mb-8"
                    >
                        <EthDiamond className="w-3 h-auto" />
                        {t('badge')}
                    </motion.span>
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-10 leading-tight tracking-tight text-theme-text">
                        <Trans
                            i18nKey="about:heroTitle"
                            components={{
                                accent: <span className="bg-gradient-to-r from-brand-accent to-brand-primary bg-clip-text text-transparent" />,
                                br: <br />,
                            }}
                        />
                    </h1>
                    <p className="text-xl text-theme-text-secondary font-light leading-relaxed max-w-2xl mx-auto">
                        {t('heroDescription')}
                    </p>
                </motion.div>
            </motion.div>
        </section>
    );
};

export default AboutHero;
