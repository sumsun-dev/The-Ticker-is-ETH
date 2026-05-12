import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Send, Linkedin, Mail, Twitter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MemberAvatarFlow from './MemberAvatarFlow';

const Hero: React.FC = () => {
    const { t } = useTranslation('home');
    const containerRef = useRef<HTMLDivElement>(null);
    // ... rest of imports
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"]
    });

    const y = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

    return (
        <div ref={containerRef} className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden bg-theme-bg text-theme-text pt-24 lg:pt-32">
            {/* Background Effects: Deep Premium Atmosphere */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-brand-primary/10 rounded-full blur-[160px] opacity-20" />
                <div className="absolute inset-0 opacity-[0.02] bg-grid-pattern" />
            </div>

            <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{ opacity }}
                    className="max-w-4xl"
                >
                    <span className="text-xs font-medium uppercase tracking-[0.4em] text-theme-text-muted mb-6 block">
                        {t('hero.badge')}
                    </span>

                    <h1 className="text-5xl md:text-7xl lg:text-[100px] font-black mb-6 tracking-[-0.04em] leading-[0.9] uppercase italic text-theme-text">
                        Ethereum <br />
                        Collective <span className="text-brand-accent">Korea</span>
                    </h1>
                    <p className="text-base md:text-lg text-theme-text-secondary max-w-2xl mx-auto mb-4 leading-relaxed">
                        {t('hero.tagline')}
                    </p>
                    <p className="text-sm md:text-base text-theme-text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
                        {t('hero.subTagline')}
                    </p>

                    {/* SNS Icons */}
                    <div className="flex justify-center gap-4 mb-8">
                        {[
                            { icon: Send, href: "https://t.me/thetickeriseth", label: "Telegram" },
                            { icon: Twitter, href: "https://x.com/TickerisETH_kr", label: "Twitter" },
                            { icon: Linkedin, href: "https://linkedin.com/company/the-ticker-is-eth/", label: "LinkedIn" },
                            { icon: Mail, href: "https://substack.com/@tickeriseth", label: "Newsletter" }
                        ].map((sns, idx) => (
                            <motion.a
                                key={idx}
                                href={sns.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                whileHover={{ y: -4, scale: 1.1 }}
                                className="p-2.5 rounded-full bg-theme-surface border border-theme-border text-white/40 hover:text-theme-text hover:border-white/30 hover:bg-theme-surface-hover transition-all duration-300 group"
                                title={sns.label}
                            >
                                <sns.icon size={16} strokeWidth={1.5} />
                            </motion.a>
                        ))}
                    </div>

                    <div className="flex justify-center mb-0">
                        <Link to="/about" className="group relative px-12 py-4 bg-transparent border border-theme-border rounded-full overflow-hidden transition-all duration-500 hover:border-white/40 inline-block">
                            <span className="relative z-10 text-xs font-bold tracking-[0.3em] uppercase transition-colors duration-500 group-hover:text-theme-text">
                                {t('hero.learnMore')}
                            </span>
                            <div className="absolute inset-0 bg-theme-surface translate-y-full transition-transform duration-500 group-hover:translate-y-0" />
                        </Link>
                    </div>
                </motion.div>
            </div>

            {/* Custom Logo Image with Parallax and Animation - Restored Size */}
            <motion.div
                style={{ y }}
                className="relative w-full max-w-xs mt-10 lg:mt-12 aspect-[506/878] min-h-[280px] flex items-center justify-center pointer-events-none select-none px-6"
            >
                {/* Member Avatar Flow Animation Overlay - Behind the Logo */}
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                    <MemberAvatarFlow />
                </div>

                <div className="relative z-20">
                    {/* Backglow for the logo */}
                    <div className="absolute inset-0 bg-theme-surface blur-3xl rounded-full scale-75" />

                    <motion.img
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        src="/assets/eck-logo.svg"
                        alt={t('hero.logoAlt')}
                        className="w-full h-auto object-contain mx-auto relative mask-logo-fade"
                    />
                </div>

                {/* Bottom Shadow Fade - Deeply recessed to avoid any clipping */}
                <div className="absolute inset-x-0 -bottom-20 h-40 bg-gradient-to-t from-brand-dark via-brand-dark/20 to-transparent -z-10" />
            </motion.div>


            {/* Explore Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 text-white/20"
            >
                <span className="text-[9px] uppercase tracking-[0.4em] font-bold">{t('hero.explore')}</span>
                <div className="w-[1px] h-12 bg-gradient-to-b from-white/20 to-transparent" />
            </motion.div>
        </div>
    );
};


export default Hero;
