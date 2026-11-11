import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import { GENESIS_BANNER } from '../data/ek1GenesisData';
import { DEVCON8_IMAGES } from '../data/devcon8Data';
import { PAST_EVENTS as pastEvents } from '../data/pastEvents';

const years = [...new Set(pastEvents.map((e) => e.year))];

const Events: React.FC = () => {
    const { t } = useTranslation('events');
    usePageMeta({ title: 'Events', description: t('metaDescription') });
    const [params, setParams] = useSearchParams();
    const tab = params.get('type') === 'global' ? 'global' : 'eck';

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
                <h1 className="text-4xl font-bold text-theme-text">Events</h1>
                <p className="mt-2 mb-10 text-theme-text-muted">{t('subtitle')}</p>

                {/* Upcoming: 예정 행사가 없을 때는 채널 구독 안내 */}
                <div className="mb-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-theme-border bg-white/[0.02] px-6 py-5">
                    <div>
                        <div className="text-xs uppercase tracking-widest text-theme-text-muted">Upcoming</div>
                        <b className="text-theme-text">{t('upcomingEmptyTitle')}</b>
                        <p className="mt-0.5 text-sm text-theme-text-muted">{t('upcomingEmptyBody')}</p>
                    </div>
                    <a
                        href="https://t.me/thetickeriseth"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-theme-border px-4 py-2 text-sm font-semibold text-theme-text hover:bg-white/5"
                    >
                        {t('subscribe')}
                    </a>
                </div>

                <div role="tablist" className="mb-8 flex gap-1 border-b border-theme-border-secondary">
                    {(['eck', 'global'] as const).map((k) => (
                        <button
                            key={k}
                            type="button"
                            role="tab"
                            aria-selected={tab === k}
                            onClick={() => setParams(k === 'global' ? { type: 'global' } : {}, { replace: true })}
                            className={`-mb-px border-b-2 px-4 py-2.5 text-[15px] font-semibold ${tab === k ? 'border-white text-theme-text' : 'border-transparent text-theme-text-muted hover:text-theme-text'}`}
                        >
                            {t(k === 'eck' ? 'tabEck' : 'tabGlobal')}
                            <span className="ml-1.5 text-xs tabular-nums text-theme-text-muted">{k === 'eck' ? pastEvents.length + 1 : 1}</span>
                        </button>
                    ))}
                </div>

                {tab === 'global' && (
                    <>
                        <p className="mb-6 text-sm text-theme-text-muted">{t('globalNote')}</p>
                        {/* ponytail: 외부 행사 리포트가 하나뿐이라 카드 직접 작성. 늘어나면 배열로 */}
                        <article className="overflow-hidden rounded-2xl border border-theme-border-secondary bg-brand-surface">
                            <Link to="/events/devcon-8" className="block">
                                <img src={DEVCON8_IMAGES.keyVisual} alt="Devcon VIII India 공식 키 비주얼" className="block aspect-[1800/953] h-auto w-full object-cover" />
                            </Link>
                            <div className="grid gap-4 p-6">
                                <div className="flex flex-wrap items-baseline justify-between gap-3">
                                    <h2 className="text-2xl font-bold text-theme-text">
                                        <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-brand-accent">Ethereum Foundation · Mumbai</span>
                                        Devcon 8 India
                                    </h2>
                                    <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold tabular-nums text-theme-text">2026.11.03 ~ 11.06</span>
                                </div>
                                <div className="grid grid-cols-[72px_1fr] items-center gap-4 rounded-xl border border-theme-border-secondary bg-white/[0.02] p-3 sm:grid-cols-[88px_1fr]">
                                    <img src={DEVCON8_IMAGES.vitalik} alt="" className="aspect-square w-full rounded-lg object-cover object-top" />
                                    <p className="text-sm text-theme-text-secondary">
                                        가면을 쓰고 개막 키노트에 오른 비탈릭부터 Mission 2028, 글램스테르담 연기까지 주요 발표 16개와 소식을 영상과 함께 정리했습니다. 다음 Devcon은
                                        2027년 리스본입니다.
                                    </p>
                                </div>
                                <div>
                                    <Link
                                        to="/events/devcon-8"
                                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-200"
                                    >
                                        리포트 보기 <ArrowRight size={15} />
                                    </Link>
                                </div>
                            </div>
                        </article>
                    </>
                )}

                {tab === 'eck' && (
                    <>
                        <SectionHead title={t('recent')} />
                        <article className="mb-16 overflow-hidden rounded-2xl border border-brand-accent/30 bg-brand-surface">
                            <Link to="/events/ek1-genesis" className="block">
                                <img src={GENESIS_BANNER} alt={t('genesis.bannerAlt')} className="block h-auto w-full" />
                            </Link>
                            <div className="grid gap-5 p-6">
                                <div className="flex flex-wrap items-baseline justify-between gap-3">
                                    <h2 className="text-2xl font-bold text-theme-text">
                                        <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-brand-accent">Ethereum Korea One</span>
                                        Genesis
                                    </h2>
                                    <span className="rounded-lg bg-brand-accent/15 px-3 py-1.5 text-sm font-bold tabular-nums text-brand-accent">2026.09.29</span>
                                </div>
                                <p className="text-theme-text-secondary">{t('genesis.lead')}</p>
                                <DayBox title={t('genesis.day2')} lines={[t('genesis.day2Meta'), t('genesis.day2Who')]} />
                                <div className="flex flex-wrap gap-2.5">
                                    <Link
                                        to="/events/ek1-genesis"
                                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-200"
                                    >
                                        {t('genesis.viewRecord')} <ArrowRight size={15} />
                                    </Link>
                                    <a
                                        href="https://one.ethereumkorea.io/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-full border border-theme-border px-5 py-2.5 text-sm font-semibold text-theme-text hover:bg-white/5"
                                    >
                                        <ExternalLink size={14} /> {t('genesis.officialSite')}
                                    </a>
                                </div>
                            </div>
                        </article>

                        <SectionHead title={t('past')} count={pastEvents.length} />
                        <div>
                            {years.map((year, yi) => (
                                <div key={year} className={`grid gap-3 py-5 sm:grid-cols-[72px_1fr] sm:gap-5 ${yi ? 'border-t border-theme-border-secondary' : 'pt-0'}`}>
                                    <div className="text-xl font-bold tabular-nums text-theme-text-muted">{year}</div>
                                    <div className="grid gap-4">
                                        {pastEvents
                                            .filter((e) => e.year === year)
                                            .map((e) => (
                                                <div key={e.id} className="grid grid-cols-[88px_1fr] items-start gap-3 sm:grid-cols-[120px_1fr] sm:gap-4">
                                                    <div className="grid min-h-[64px] place-items-center overflow-hidden rounded-lg border border-theme-border-secondary bg-white/5 text-xs text-theme-text-muted">
                                                        {e.image ? <img src={e.image} alt={e.title} loading="lazy" className="block h-auto w-full" /> : e.title.startsWith('Ethcon') ? 'ETHCON' : 'EK1'}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-[17px] font-semibold text-theme-text">{e.title}</h3>
                                                        <div className="mt-0.5 text-[13px] tabular-nums text-theme-text-muted">
                                                            {e.date} · {t(`locations.${e.locationKey}`)}
                                                        </div>
                                                        <p className="mt-1.5 text-sm text-theme-text-secondary">{t(`descriptions.${e.descriptionKey}`)}</p>
                                                        <a href={e.link} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[13px] text-brand-accent hover:underline">
                                                            {t(`links.${e.linkKey}`)}
                                                        </a>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                    </>
                )}

                <div className="mt-16 rounded-3xl border border-theme-border-secondary bg-gradient-to-br from-brand-primary/10 to-transparent p-8 text-center">
                    <h3 className="mb-3 text-xl font-bold">{t('ctaTitle')}</h3>
                    <p className="mb-6 text-theme-text-secondary">{t('ctaDescription')}</p>
                    <a
                        href="https://t.me/thetickerisethchat"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-full bg-white px-6 py-3 font-semibold text-black transition-colors hover:bg-gray-200"
                    >
                        {t('contactUs')}
                    </a>
                </div>
            </motion.div>
        </div>
    );
};

const SectionHead: React.FC<{ title: string; count?: number }> = ({ title, count }) => (
    <div className="mb-5 flex items-center gap-4">
        <h2 className="whitespace-nowrap text-[22px] font-bold text-theme-text">{title}</h2>
        <div className="h-px flex-1 bg-white/10" />
        {count !== undefined && <span className="text-sm tabular-nums text-theme-text-muted">{count}</span>}
    </div>
);

const DayBox: React.FC<{ title: string; lines: string[] }> = ({ title, lines }) => (
    <div className="grid gap-1 rounded-xl border border-theme-border-secondary bg-white/[0.02] px-4 py-3.5">
        <b className="text-sm text-theme-text">{title}</b>
        {lines.map((l) => (
            <span key={l} className="text-[13px] text-theme-text-muted">
                {l}
            </span>
        ))}
    </div>
);

export default Events;
