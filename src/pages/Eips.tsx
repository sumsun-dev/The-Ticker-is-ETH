import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import StandardTabs from '../components/eips/StandardTabs';
import { loadEipList, EIP_TOPICS, type EipRecord } from '../data/eipsData';
import { loadEthCalls, type CallRecord } from '../data/ethCallsData';
import { inclusionLabel, inclusionOf, lastDiscussed, matchEip, sortByRecent } from '../utils/eips';
import { dotDate, STATUS_TEXT } from '../utils/calls';

const KICKER = 'text-[11px] font-mono uppercase tracking-widest text-theme-text-muted';
const CHIP = 'min-h-[36px] px-4 py-1.5 rounded-full text-sm font-medium transition-colors';
const on = (active: boolean) => (active ? 'bg-brand-primary text-white' : 'bg-theme-surface text-theme-text-muted hover:text-theme-text');

type Step = { title: string; code: string; body: string };
type Term = { term: string; def: string };

const Eips: React.FC = () => {
    const { t } = useTranslation('eips');
    const [records, setRecords] = useState<EipRecord[]>([]);
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [topic, setTopic] = useState<string | null>(null);
    const [fork, setFork] = useState<string | null>(null);

    usePageMeta({ title: 'EIPs', description: t('description'), canonical: '/eips' });

    useEffect(() => {
        Promise.all([loadEipList(), loadEthCalls()])
            .then(([e, c]) => {
                setRecords(e.eips);
                setCalls(c.calls);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const rows = useMemo(
        () => sortByRecent(records.map((record) => ({ record, inc: inclusionOf(calls, record.number), last: lastDiscussed(calls, record.number) }))),
        [records, calls],
    );
    const topics = useMemo(() => EIP_TOPICS.filter((tp) => records.some((r) => r.topic === tp)), [records]);
    const forks = useMemo(() => [...new Set(rows.map((r) => r.inc?.fork).filter((f): f is string => Boolean(f)))], [rows]);
    const visible = useMemo(() => rows.filter((r) => matchEip(r.record, r.inc, { query, topic, fork })), [rows, query, topic, fork]);

    const steps = t('flow.steps', { returnObjects: true }) as Step[];
    const terms = t('terms.items', { returnObjects: true }) as Term[];

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <div className="max-w-5xl mx-auto break-keep">
                <StandardTabs active="eip" />
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-14">
                    <div className="inline-block px-4 py-1.5 rounded-full border border-theme-border bg-theme-surface backdrop-blur-sm text-sm font-medium text-brand-primary mb-4">
                        {t('badge')}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-accent">{t('title')}</h1>
                    <p className="text-theme-text-muted max-w-3xl text-base md:text-lg font-light leading-relaxed">{t('description')}</p>
                </motion.div>

                <section aria-labelledby="eip-flow" className="border-t border-theme-border py-10">
                    <h2 id="eip-flow" className="text-2xl font-bold mb-2">
                        {t('flow.title')}
                    </h2>
                    <p className="text-theme-text-muted mb-6">{t('flow.intro')}</p>
                    <ol className="grid gap-2.5 sm:gap-3 grid-cols-2 lg:grid-cols-3">
                        {steps.map((s, i) => (
                            <li key={s.code} className={`rounded-xl border border-theme-border p-4 sm:p-5 flex flex-col gap-1.5 sm:gap-2 ${i >= 4 ? 'bg-brand-primary/10' : 'bg-theme-surface'}`}>
                                <span className={KICKER}>{i + 1}</span>
                                <span className="text-lg font-bold">{s.title}</span>
                                <span className="font-mono text-sm font-semibold text-brand-accent">{s.code}</span>
                                <span className="text-sm leading-relaxed text-theme-text-muted">{s.body}</span>
                            </li>
                        ))}
                    </ol>
                    <p className="mt-4 text-sm text-theme-text-muted">{t('flow.dfi')}</p>
                </section>

                <section aria-labelledby="eip-terms" className="border-t border-theme-border py-10">
                    <h2 id="eip-terms" className="text-2xl font-bold mb-4">
                        {t('terms.title')}
                    </h2>
                    <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                        {terms.map((x) => (
                            <div key={x.term} className="py-3 border-b border-theme-border">
                                <dt className="font-bold text-sm">{x.term}</dt>
                                <dd className="mt-1 text-sm leading-relaxed text-theme-text-muted">{x.def}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                <section aria-labelledby="eip-list" className="border-t border-theme-border pt-10">
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                        <div>
                            <h2 id="eip-list" className="text-2xl font-bold">
                                {t('list.title')}
                            </h2>
                            <p className="mt-1 text-sm text-theme-text-muted">{t('list.count', { count: records.length })}</p>
                        </div>
                        <label className="flex flex-col gap-1 text-xs text-theme-text-muted w-full sm:w-72">
                            {t('list.search')}
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t('list.searchPlaceholder')}
                                className="h-11 px-4 rounded-full text-sm bg-theme-surface border border-theme-border text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-brand-primary"
                            />
                        </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-6" role="group" aria-label={t('list.topic')}>
                        <button type="button" aria-pressed={!topic && !fork} onClick={() => (setTopic(null), setFork(null))} className={`${CHIP} ${on(!topic && !fork)}`}>
                            {t('list.all')}
                        </button>
                        {forks.map((f) => (
                            <button key={f} type="button" aria-pressed={fork === f} onClick={() => setFork(fork === f ? null : f)} className={`${CHIP} ${on(fork === f)}`}>
                                {f}
                            </button>
                        ))}
                        {forks.length > 0 && topics.length > 0 && <span className="w-px h-5 bg-theme-border mx-1" aria-hidden />}
                        {topics.map((tp) => (
                            <button key={tp} type="button" aria-pressed={topic === tp} onClick={() => setTopic(topic === tp ? null : tp)} className={`${CHIP} ${on(topic === tp)}`}>
                                {tp}
                            </button>
                        ))}
                    </div>

                    {isLoading ? (
                        <div className="grid gap-4 md:grid-cols-2" aria-busy>
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="h-48 rounded-xl bg-theme-surface animate-pulse" />
                            ))}
                        </div>
                    ) : records.length === 0 ? (
                        <p className="text-theme-text-muted">{t('list.none')}</p>
                    ) : visible.length === 0 ? (
                        <p className="text-theme-text-muted">{t('list.empty')}</p>
                    ) : (
                        <ul className="grid gap-4 md:grid-cols-2">
                            {visible.map(({ record: r, inc, last }) => (
                                <li key={r.number}>
                                    <Link
                                        to={`/eips/${r.number}`}
                                        className="h-full rounded-xl border border-theme-border bg-theme-surface p-5 flex flex-col gap-3 hover:border-brand-primary transition-colors"
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-sm text-theme-text-muted">EIP-{r.number}</span>
                                            <span className={`text-xs font-semibold ${inc ? STATUS_TEXT[inc.status] : 'text-theme-text-muted'}`}>
                                                {inclusionLabel(inc, r.meta.status)}
                                                {inc?.headliner ? ` · ${t('detail.headliner', { fork: '' }).trim()}` : ''}
                                            </span>
                                        </span>
                                        <span className="text-lg font-bold leading-snug">{r.titleKo}</span>
                                        <span className="text-sm leading-relaxed text-theme-text-muted">{r.summary}</span>
                                        <span className="mt-auto pt-3 border-t border-theme-border flex flex-wrap gap-x-4 gap-y-1 text-xs text-theme-text-muted">
                                            <span>{r.topic}</span>
                                            <span>{last ? t('list.last', { date: dotDate(last.date).slice(5), call: last.call }) : t('list.noCall')}</span>
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Eips;
