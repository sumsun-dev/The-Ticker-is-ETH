import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import { loadEthDigests, type EthDigest } from '../data/ethNewsData';

function formatDigestDate(date: string, locale: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
    });
}

const News: React.FC = () => {
    const { t, i18n } = useTranslation('news');
    const [digests, setDigests] = useState<EthDigest[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    usePageMeta({
        title: 'Ethereum News',
        description: '이더리움 공식 블로그·리서치 포럼·핵심 트위터·커뮤니티 소식을 매일 수집해 한국어 다이제스트로 정리합니다.',
        canonical: '/news',
    });

    useEffect(() => {
        loadEthDigests().then((digestData) => {
            setDigests(digestData);
            setIsLoading(false);
        });
    }, []);

    const currentDigest = useMemo(
        () => digests.find((d) => d.date === selectedDate) ?? digests[0] ?? null,
        [digests, selectedDate],
    );

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-12">
                <div className="inline-block px-4 py-1.5 rounded-full border border-theme-border bg-theme-surface backdrop-blur-sm text-sm font-medium text-brand-primary mb-4">
                    {t('badge')}
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-accent">
                    Ethereum News
                </h1>
                <p className="text-theme-text-muted max-w-xl text-lg font-light leading-relaxed">
                    {t('description')}
                </p>
            </motion.div>

            {isLoading && (
                <div className="max-w-3xl space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-theme-surface border border-theme-border rounded-2xl p-6 animate-pulse">
                            <div className="h-4 w-32 bg-white/10 rounded mb-4" />
                            <div className="h-6 w-3/4 bg-white/10 rounded mb-3" />
                            <div className="h-4 w-full bg-white/5 rounded" />
                        </div>
                    ))}
                </div>
            )}

            {!isLoading && currentDigest && (
                <article className="max-w-3xl">
                    <p className="text-sm font-medium text-brand-accent mb-2">
                        {formatDigestDate(currentDigest.date, i18n.language)} · {t('latestDigest')}
                    </p>
                    <h2 className="text-2xl md:text-4xl font-bold leading-snug mb-5 text-balance">
                        {currentDigest.title}
                    </h2>
                    <p className="text-theme-text-muted text-lg font-light leading-relaxed mb-10">
                        {currentDigest.intro}
                    </p>

                    {currentDigest.sections.map((section) => (
                        <section key={section.heading} className="mb-10">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-eth-purple mb-4">
                                {section.heading}
                            </h3>
                            <div className="space-y-4">
                                {section.items.map((item) => (
                                    <div
                                        key={item.url}
                                        className="bg-theme-surface border border-theme-border rounded-2xl p-5 hover:border-brand-primary/40 transition-colors"
                                    >
                                        <h4 className="font-semibold leading-snug mb-2">{item.title}</h4>
                                        <p className="text-sm text-theme-text-muted leading-relaxed mb-3">
                                            {item.summary}
                                        </p>
                                        <div className="flex items-center gap-3 text-xs text-theme-text-muted">
                                            <span className="font-medium">{item.source}</span>
                                            <span>{item.date}</span>
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-auto inline-flex items-center gap-1 text-brand-accent hover:underline"
                                            >
                                                {t('viewOriginal')} <ExternalLink size={12} aria-hidden />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}

                    {digests.length > 1 && (
                        <section className="mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-theme-text-muted mb-4">
                                {t('pastDigests')}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {digests.map((digest) => (
                                    <button
                                        key={digest.date}
                                        onClick={() => { setSelectedDate(digest.date); window.scrollTo(0, 0); }}
                                        aria-pressed={digest.date === currentDigest.date}
                                        className={`px-4 py-2 rounded-full text-sm transition-all ${
                                            digest.date === currentDigest.date
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-theme-surface text-theme-text-muted hover:text-theme-text'
                                        }`}
                                    >
                                        {digest.date}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}
                </article>
            )}

            {!isLoading && !currentDigest && (
                <p className="text-theme-text-muted py-12">{t('empty')}</p>
            )}
        </div>
    );
};

export default News;
