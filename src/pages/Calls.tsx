import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import { loadEthCalls, type CallRecord, type CallsStatus } from '../data/ethCallsData';
import { MAIN_SERIES, STATUS_DOT, callLabel, dotDate, forksOf, groupByMonth, mentionsEip, nextCallEstimate, seriesInfo, splitDuration, todayKst } from '../utils/calls';

const KICKER = 'text-[11px] font-mono uppercase tracking-widest text-theme-text-muted';
const CHIP = 'px-4 py-1.5 rounded-full text-sm font-medium transition-colors';
const on = (active: boolean) => (active ? 'bg-brand-primary text-white' : 'bg-theme-surface text-theme-text-muted hover:text-theme-text');

type SeriesFilter = 'all' | (typeof MAIN_SERIES)[number];

const Calls: React.FC = () => {
    const { t } = useTranslation('calls');
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [status, setStatus] = useState<CallsStatus | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [series, setSeries] = useState<SeriesFilter>('all');
    const [fork, setFork] = useState<string | null>(null);
    const [eip, setEip] = useState('');

    usePageMeta({ title: 'Core Dev Calls', description: t('description'), canonical: '/calls' });

    useEffect(() => {
        loadEthCalls()
            .then((file) => {
                // 정리본만 보여준다. 결정 기록이 없는 브레이크아웃은 목록에 넣지 않는다 (오너 결정)
                setCalls(file.calls.filter((c) => c.kind === 'full'));
                setStatus(file.status);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const forks = useMemo(() => forksOf(calls), [calls]);
    const next = useMemo(() => nextCallEstimate(calls, todayKst()), [calls]);
    const visible = useMemo(
        () =>
            calls.filter((c) => {
                if (series !== 'all' && c.series !== series) return false;
                if (fork && !c.decisions.some((d) => d.fork === fork)) return false;
                if (eip.trim() && !mentionsEip(c, eip)) return false;
                return true;
            }),
        [calls, series, fork, eip],
    );
    const groups = useMemo(() => groupByMonth(visible), [visible]);

    const duration = (min?: number) => {
        if (!min) return null;
        const { h, m } = splitDuration(min);
        return h > 0 ? t('duration.hm', { h, m }) : t('duration.m', { m });
    };

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <div className="max-w-5xl mx-auto">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
                    <div className="inline-block px-4 py-1.5 rounded-full border border-theme-border bg-theme-surface backdrop-blur-sm text-sm font-medium text-brand-primary mb-4">
                        {t('badge')}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-accent">Core Dev Calls</h1>
                    <p className="text-theme-text-muted max-w-2xl text-base md:text-lg font-light leading-relaxed">{t('description')}</p>
                </motion.div>

                {(next || status?.currentFork || status?.nextFork) && (
                    <div className="rounded-2xl border border-theme-border bg-theme-surface grid md:grid-cols-3 mb-8 divide-y md:divide-y-0 md:divide-x divide-theme-border">
                        {next && (
                            <div className="p-5 flex flex-col gap-1.5">
                                <span className={KICKER}>{t('strip.nextCall')}</span>
                                <span className="font-bold">
                                    {next.label} · <span className="font-mono tabular-nums">{dotDate(next.date)}</span>
                                </span>
                                <span className="text-xs text-theme-text-muted">{t('strip.nextCallNote')}</span>
                            </div>
                        )}
                        {status?.currentFork && (
                            <div className="p-5 flex flex-col gap-1.5">
                                <span className={KICKER}>
                                    {status.currentFork.name} · {status.currentFork.stage}
                                </span>
                                <span className="font-bold leading-snug">{status.currentFork.line}</span>
                                {status.basis && <span className="text-xs text-theme-text-muted">{t('strip.basis', { label: status.basis.toUpperCase() })}</span>}
                            </div>
                        )}
                        {status?.nextFork && (
                            <div className="p-5 flex flex-col gap-1.5">
                                <span className={KICKER}>
                                    {status.nextFork.name} · {status.nextFork.stage}
                                </span>
                                <span className="font-bold leading-snug">{status.nextFork.line}</span>
                                {status.basis && <span className="text-xs text-theme-text-muted">{t('strip.basis', { label: status.basis.toUpperCase() })}</span>}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mb-6" role="tablist" aria-label={t('filter.all')}>
                    <button type="button" role="tab" aria-selected={series === 'all'} onClick={() => setSeries('all')} className={`${CHIP} ${on(series === 'all')}`}>
                        {t('filter.all')} <span className="ml-1 text-xs opacity-70">{calls.length}</span>
                    </button>
                    {MAIN_SERIES.map((s) => (
                        <button key={s} type="button" role="tab" aria-selected={series === s} onClick={() => setSeries(series === s ? 'all' : s)} className={`${CHIP} ${on(series === s)}`}>
                            {seriesInfo(s).label}
                        </button>
                    ))}
                    {forks.length > 0 && <span className="w-px h-5 bg-theme-border mx-1" aria-hidden />}
                    {forks.map((f) => (
                        <button key={f} type="button" aria-pressed={fork === f} onClick={() => setFork(fork === f ? null : f)} className={`${CHIP} ${on(fork === f)}`}>
                            {f}
                        </button>
                    ))}
                    <input
                        type="search"
                        value={eip}
                        onChange={(e) => setEip(e.target.value)}
                        placeholder={t('filter.eip')}
                        aria-label={t('filter.eip')}
                        className="ml-auto w-full sm:w-56 px-4 py-1.5 rounded-full text-sm bg-theme-surface border border-theme-border text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-brand-primary"
                    />
                </div>

                {isLoading ? (
                    <div className="space-y-3" aria-busy>
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-20 rounded-xl bg-theme-surface animate-pulse" />
                        ))}
                    </div>
                ) : groups.length === 0 ? (
                    <p className="text-theme-text-muted py-12">{t('empty')}</p>
                ) : (
                    <div className="flex flex-col gap-8">
                        {groups.map(({ month, calls: list }) => (
                            <section key={month} className="flex flex-col gap-2">
                                <div className="flex items-baseline gap-3">
                                    <span className={KICKER}>{t('month', { year: month.slice(0, 4), month: Number(month.slice(5, 7)) })}</span>
                                    <span className="text-xs text-theme-text-muted">{t('monthStats', { calls: list.length, decisions: list.reduce((n, c) => n + c.decisions.length, 0) })}</span>
                                </div>
                                <ul className="rounded-2xl border border-theme-border bg-theme-surface overflow-hidden">
                                    {list.map((c) => {
                                        const info = seriesInfo(c.series);
                                        return (
                                            <li key={c.id} className="border-t first:border-t-0 border-theme-border">
                                                <Link
                                                    to={`/calls/${c.id}`}
                                                    className="group grid grid-cols-[minmax(0,1fr)] md:grid-cols-[150px_minmax(0,1fr)_190px] gap-x-5 gap-y-2 px-5 py-4 hover:bg-theme-surface-hover transition-colors"
                                                >
                                                    <span className="flex md:flex-col items-center md:items-start gap-2 md:gap-1.5">
                                                        <span className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider text-white ${info.className}`}>{info.label}</span>
                                                            <span className="font-mono text-lg font-bold tabular-nums">#{c.number}</span>
                                                        </span>
                                                        <span className="font-mono text-xs text-theme-text-muted tabular-nums">{dotDate(c.date)}</span>
                                                    </span>
                                                    <span className="min-w-0 flex flex-col gap-1.5">
                                                        <span className="font-semibold leading-snug group-hover:text-brand-accent transition-colors">{c.headline?.replace(/\n/g, ' ') ?? c.title}</span>
                                                        {c.summary && <span className="text-sm text-theme-text-secondary leading-relaxed">{c.summary}</span>}
                                                        {c.decisions.length > 0 && (
                                                            <span className="flex flex-wrap gap-1.5 mt-0.5">
                                                                {c.decisions.slice(0, 5).map((d) => (
                                                                    <span key={`${d.label}-${d.status}`} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-theme-border text-xs text-theme-text-secondary whitespace-nowrap">
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[d.status]}`} aria-hidden />
                                                                        {d.label}
                                                                        <span className="text-[10px] font-bold tracking-wider text-theme-text-muted">{d.status}</span>
                                                                    </span>
                                                                ))}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex md:flex-col md:items-end gap-x-3 gap-y-1 text-xs text-theme-text-muted md:text-right">
                                                        <span className="font-semibold text-theme-text">{t('row.stats', { decisions: c.decisions.length, topics: c.topics.length })}</span>
                                                        <span>{[t('row.people', { people: c.speakers.filter((s) => s.share > 0).length }), duration(c.durationMin)].filter(Boolean).join(' · ')}</span>
                                                        <span className="text-brand-accent">{callLabel(c)}</span>
                                                    </span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Calls;
