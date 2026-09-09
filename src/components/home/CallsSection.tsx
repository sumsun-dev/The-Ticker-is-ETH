import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadEthCalls, type CallRecord } from '../../data/ethCallsData';
import { STATUS_DOT, dotDate, latestFullCalls, seriesInfo } from '../../utils/calls';

/** 홈: 최근 코어 개발자 콜 브리프 3건 (정리된 ACDE·ACDC·ACDT만). 카드는 /calls/:id 상세로 */
const CallsSection: React.FC = () => {
    const { t } = useTranslation('home');
    const [calls, setCalls] = useState<CallRecord[]>([]);

    useEffect(() => {
        loadEthCalls()
            .then((file) => setCalls(latestFullCalls(file.calls, 3)))
            .catch(() => setCalls([]));
    }, []);

    if (calls.length === 0) return null;

    return (
        <section className="py-24 bg-theme-bg-secondary">
            <div className="container mx-auto px-6">
                <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                    <div>
                        <span className="text-brand-accent font-semibold text-sm uppercase tracking-wider mb-2 block">{t('calls.badge')}</span>
                        <h2 className="text-3xl md:text-4xl font-bold text-theme-text">{t('calls.title')}</h2>
                        <p className="mt-3 max-w-2xl text-theme-text-secondary">{t('calls.description')}</p>
                    </div>
                    <Link to="/calls" className="flex items-center gap-2 text-brand-primary hover:text-brand-accent transition-colors font-semibold group">
                        {t('calls.viewAll')} <ArrowUpRight size={20} className="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {calls.map((c, i) => {
                        const info = seriesInfo(c.series);
                        const lead = c.lead ?? c.summary;
                        return (
                            <motion.div
                                key={c.id}
                                className="h-full"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                            >
                                <Link
                                    to={`/calls/${c.id}`}
                                    className="group flex h-full flex-col gap-4 rounded-3xl border border-theme-border bg-theme-surface p-6 hover:border-brand-primary/50 transition-all hover:-translate-y-1"
                                >
                                    <span className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider text-white ${info.className}`}>{info.label}</span>
                                            <span className="font-mono text-lg font-bold tabular-nums text-theme-text">#{c.number}</span>
                                        </span>
                                        <span className="font-mono text-xs text-theme-text-muted tabular-nums">{dotDate(c.date)}</span>
                                    </span>
                                    <span className="flex flex-col gap-2">
                                        <span className="text-lg font-semibold leading-snug text-theme-text group-hover:text-brand-accent transition-colors">
                                            {(c.headline ?? c.title).replace(/\n/g, ' ')}
                                        </span>
                                        {lead && <span className="text-sm text-theme-text-secondary leading-relaxed line-clamp-3">{lead}</span>}
                                    </span>
                                    {c.decisions.length > 0 && (
                                        <span className="flex flex-wrap gap-1.5">
                                            {c.decisions.slice(0, 3).map((d) => (
                                                <span key={`${d.label}-${d.status}`} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-theme-border text-xs text-theme-text-secondary">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[d.status]}`} aria-hidden />
                                                    {d.label}
                                                </span>
                                            ))}
                                            {c.decisions.length > 3 && <span className="px-1 py-0.5 text-xs text-theme-text-muted">+{c.decisions.length - 3}</span>}
                                        </span>
                                    )}
                                    <span className="mt-auto text-xs text-theme-text-muted">{t('calls.stats', { decisions: c.decisions.length, topics: c.topics.length })}</span>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default CallsSection;
