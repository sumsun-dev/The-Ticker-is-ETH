import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import { loadEthDigests, type EthDigest, type EthDigestSection } from '../data/ethNewsData';

function formatDigestDate(date: string, locale: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
    });
}

/** "오늘의 논쟁 · 담론" 섹션은 시각적으로 구분한다 */
function isDebateSection(section: EthDigestSection): boolean {
    return section.heading.includes('논쟁');
}

/** "오늘의 인사이트" 섹션 — 해석·명제 중심이라 가장 강조한다 */
function isInsightSection(section: EthDigestSection): boolean {
    return section.heading.includes('인사이트');
}

const News: React.FC = () => {
    const { t, i18n } = useTranslation('news');
    const [searchParams, setSearchParams] = useSearchParams();
    const [digests, setDigests] = useState<EthDigest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const selectedDate = searchParams.get('date');

    usePageMeta({
        title: 'Ethereum News',
        description: '이더리움 공식 블로그·리서치 포럼·핵심 트위터·커뮤니티 소식을 매일 수집해 한국어 다이제스트로 정리합니다.',
        canonical: '/news',
        image: digests[0]?.coverImage,
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

    const selectDigest = (date: string) => {
        setSearchParams(date === digests[0]?.date ? {} : { date });
        window.scrollTo({ top: 0 });
    };

    const scrollToSection = (index: number) => {
        document.getElementById(`digest-sec-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const archiveCard = (digest: EthDigest, compact: boolean) => {
        const isCurrent = digest.date === currentDigest?.date;
        return (
            <button
                key={digest.date}
                onClick={() => selectDigest(digest.date)}
                aria-pressed={isCurrent}
                className={`group text-left rounded-2xl overflow-hidden border transition-all ${
                    isCurrent
                        ? 'border-brand-primary'
                        : 'border-theme-border hover:border-brand-primary/50 hover:-translate-y-0.5'
                }`}
            >
                {digest.coverImage ? (
                    <img
                        src={digest.coverImage}
                        alt=""
                        loading="lazy"
                        className="w-full aspect-[1200/630] object-cover"
                    />
                ) : (
                    <div className="w-full aspect-[1200/630] bg-gradient-to-br from-brand-surface-light to-brand-dark flex items-center justify-center">
                        <span className="text-theme-text-muted text-sm">{digest.date}</span>
                    </div>
                )}
                <div className={`bg-theme-surface ${compact ? 'p-3' : 'p-4'}`}>
                    <p className="text-xs text-theme-text-muted mb-1">{digest.date}</p>
                    <p className={`font-semibold leading-snug line-clamp-2 group-hover:text-brand-accent transition-colors ${compact ? 'text-xs' : 'text-sm'}`}>
                        {digest.title}
                    </p>
                </div>
            </button>
        );
    };

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-10">
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

            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12 lg:items-start">
              <div className="max-w-3xl">
                {isLoading && (
                    <div className="space-y-4">
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
                    <article>
                        {currentDigest.coverImage && (
                            <img
                                src={currentDigest.coverImage}
                                alt={currentDigest.title}
                                className="w-full rounded-2xl border border-theme-border mb-8"
                                loading="eager"
                            />
                        )}
                        <p className="text-sm font-medium text-brand-accent mb-2">
                            {formatDigestDate(currentDigest.date, i18n.language)} · {t('latestDigest')}
                        </p>
                        <h2 className="text-2xl md:text-4xl font-bold leading-snug mb-5 text-balance">
                            {currentDigest.title}
                        </h2>
                        <p className="text-theme-text-muted text-lg font-light leading-relaxed mb-8">
                            {currentDigest.intro}
                        </p>

                        {/* 섹션 앵커 칩 — 모바일용 (데스크톱은 사이드바 목차) */}
                        {currentDigest.sections.length > 1 && (
                            <nav className="flex flex-wrap gap-2 mb-10 lg:hidden" aria-label={t('sectionNav')}>
                                {currentDigest.sections.map((section, i) => (
                                    <button
                                        key={section.heading}
                                        onClick={() => scrollToSection(i)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                                            isDebateSection(section)
                                                ? 'border-brand-accent/40 text-brand-accent hover:bg-brand-accent/10'
                                                : 'border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-surface'
                                        }`}
                                    >
                                        {section.heading}
                                        <span className="ml-1.5 opacity-60">{section.items.length}</span>
                                    </button>
                                ))}
                            </nav>
                        )}

                        {currentDigest.sections.map((section, i) => {
                            const debate = isDebateSection(section);
                            const insight = isInsightSection(section);
                            return (
                                <section key={section.heading} id={`digest-sec-${i}`} className="mb-10 scroll-mt-28">
                                    <h3
                                        className={`text-sm font-bold uppercase tracking-widest mb-4 ${
                                            debate ? 'text-brand-accent' : 'text-eth-purple'
                                        }`}
                                    >
                                        {section.heading}
                                    </h3>
                                    <div className="space-y-4">
                                        {section.items.map((item) => (
                                            <div
                                                key={item.url}
                                                className={`rounded-2xl p-5 transition-colors border ${
                                                    insight
                                                        ? 'bg-eth-purple/[.05] border-eth-purple/20 hover:border-eth-purple/40'
                                                        : debate
                                                        ? 'bg-brand-accent/[.04] border-brand-accent/20 hover:border-brand-accent/40'
                                                        : 'bg-theme-surface border-theme-border hover:border-brand-primary/40'
                                                }`}
                                            >
                                                <h4 className="font-semibold leading-snug mb-2">{item.title}</h4>
                                                <p className="text-sm text-theme-text-muted leading-relaxed mb-3">
                                                    {item.summary}
                                                </p>
                                                {item.why && (
                                                    <p className="text-sm text-eth-purple/90 leading-relaxed mb-3">
                                                        {item.why}
                                                    </p>
                                                )}
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
                            );
                        })}
                    </article>
                )}

                {!isLoading && !currentDigest && (
                    <p className="text-theme-text-muted py-12">{t('empty')}</p>
                )}

                {/* 아카이브 — 모바일 하단 그리드 (데스크톱은 사이드바) */}
                {!isLoading && digests.length > 1 && (
                    <div className="mt-16 pt-10 border-t border-theme-border lg:hidden">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-theme-text-muted mb-6">
                            {t('pastDigests')}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {digests.map((digest) => archiveCard(digest, false))}
                        </div>
                    </div>
                )}
              </div>

              {/* 데스크톱 사이드바: 이번 호 목차 + 지난 다이제스트 */}
              {!isLoading && currentDigest && (
                  <aside className="hidden lg:block">
                      <div className="sticky top-28 space-y-10">
                          {currentDigest.sections.length > 1 && (
                              <nav aria-label={t('sectionNav')}>
                                  <h3 className="text-xs font-bold uppercase tracking-widest text-theme-text-muted mb-3">
                                      {t('toc')}
                                  </h3>
                                  <ul className="space-y-1">
                                      {currentDigest.sections.map((section, i) => (
                                          <li key={section.heading}>
                                              <button
                                                  onClick={() => scrollToSection(i)}
                                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                                      isDebateSection(section)
                                                          ? 'text-brand-accent hover:bg-brand-accent/10'
                                                          : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-surface'
                                                  }`}
                                              >
                                                  {section.heading}
                                                  <span className="ml-2 text-xs opacity-60">{section.items.length}</span>
                                              </button>
                                          </li>
                                      ))}
                                  </ul>
                              </nav>
                          )}

                          {digests.length > 1 && (
                              <div>
                                  <h3 className="text-xs font-bold uppercase tracking-widest text-theme-text-muted mb-3">
                                      {t('pastDigests')}
                                  </h3>
                                  <div className="flex flex-col gap-3">
                                      {digests.slice(0, 6).map((digest) => archiveCard(digest, true))}
                                  </div>
                              </div>
                          )}
                      </div>
                  </aside>
              )}
            </div>
          </div>
        </div>
    );
};

export default News;
