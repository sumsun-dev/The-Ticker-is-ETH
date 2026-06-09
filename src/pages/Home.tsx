import React, { useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import Hero from '../components/home/Hero';
import MissionSection from '../components/home/MissionSection';
import InitiativesSection from '../components/home/InitiativesSection';
import { motion } from 'framer-motion';

const UpdatesSection = lazy(() => import('../components/home/UpdatesSection'));
const EcosystemSection = lazy(() => import('../components/home/EcosystemSection'));
import { useTranslation } from 'react-i18next';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { mockMembers, mockContributors } from '../data/mockData';
import usePageMeta from '../hooks/usePageMeta';
import GrantAnnouncementModal from '../components/common/GrantAnnouncementModal';

const Home: React.FC = () => {
    const { t } = useTranslation('home');
    usePageMeta({ title: '', description: 'ECK(Ethereum Collective Korea) — 한국 이더리움 생태계 공공재 콜렉티브' });

    const allMembers = useMemo(() => {
        const coreNames = new Set(mockMembers.map(m => m.name.toLowerCase()));
        const uniqueContributors = mockContributors.filter(
            c => !coreNames.has(c.name.toLowerCase()),
        );
        return [...mockMembers, ...uniqueContributors].slice(0, 20);
    }, []);

    return (
        <div className="bg-theme-bg">
            <GrantAnnouncementModal />
            <Hero />

            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
            >
                <MissionSection />
                <InitiativesSection />
                <Suspense fallback={null}>
                    <UpdatesSection />
                    <EcosystemSection />
                </Suspense>

                {/* CTA Section — Team Preview Style */}
                <section className="py-24 px-6 relative overflow-hidden">
                    <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-brand-primary/5 rounded-full blur-[100px]" />
                    <div className="container mx-auto max-w-3xl relative z-10 text-center">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-3xl md:text-4xl font-bold text-theme-text mb-4 tracking-tight"
                        >
                            {t('cta.title')}
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.15 }}
                            className="text-theme-text-muted font-light mb-10 max-w-xl mx-auto leading-relaxed whitespace-pre-line"
                        >
                            {t('cta.description')}
                        </motion.p>

                        {/* Member Avatars */}
                        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
                            {allMembers.map((member, idx) => (
                                <motion.div
                                    key={member.id}
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.04, duration: 0.35 }}
                                    className="group relative"
                                >
                                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden border-2 border-theme-border-secondary ring-2 ring-transparent group-hover:ring-brand-primary/50 group-hover:-translate-y-2 transition-all duration-300">
                                        <img
                                            src={member.avatarUrl}
                                            alt={member.name}
                                            loading="lazy"
                                            decoding="async"
                                            width={56}
                                            height={56}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                        <span className="text-[10px] text-theme-text-muted bg-brand-dark/90 px-2 py-0.5 rounded">{member.name}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* CTA Buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.4 }}
                            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
                        >
                            <Link
                                to="/contributors"
                                className="group inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-brand-primary to-brand-accent text-white font-medium text-sm hover:shadow-lg hover:shadow-brand-primary/20 transition-all"
                            >
                                {t('cta.contributor')}
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <a
                                href="https://t.me/thetickeriseth"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-2 px-7 py-3 rounded-full border border-theme-border text-theme-text-secondary font-medium text-sm hover:border-brand-primary/40 hover:text-theme-text transition-all"
                            >
                                <MessageCircle size={16} />
                                {t('cta.telegram')}
                            </a>
                        </motion.div>
                    </div>
                </section>
            </motion.div>
        </div>
    );
};

export default Home;
