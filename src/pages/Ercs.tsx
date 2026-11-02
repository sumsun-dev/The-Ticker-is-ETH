import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import StandardTabs from '../components/eips/StandardTabs';
import { ERC_TOPICS, loadErcIndex, loadErcs, type ErcIndexEntry, type ErcRecord } from '../data/ercsData';
import { loadEips } from '../data/eipsData';
import { ERC_STATUSES, ERC_STATUS_TEXT, baseStandards, dependentsOf, matchErc, sortErcs, standardHref, statusCounts } from '../utils/ercs';

const CHIP = 'min-h-[36px] px-4 py-1.5 rounded-full text-sm font-medium transition-colors';
const on = (active: boolean) => (active ? 'bg-brand-primary text-white' : 'bg-theme-surface text-theme-text-muted hover:text-theme-text');

type DiffRow = { k: string; eip: string; erc: string };

const Ercs: React.FC = () => {
    const { t } = useTranslation('ercs');
    const [records, setRecords] = useState<ErcRecord[]>([]);
    const [index, setIndex] = useState<ErcIndexEntry[]>([]);
    const [eipSet, setEipSet] = useState<Set<number>>(() => new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [topic, setTopic] = useState<string | null>(null);

    usePageMeta({ title: 'ERCs', description: t('description'), canonical: '/ercs' });

    useEffect(() => {
        Promise.all([loadErcs(), loadErcIndex(), loadEips().catch(() => ({ eips: [] }))])
            .then(([r, i, e]) => {
                setRecords(r.ercs);
                setIndex(i.ercs);
                setEipSet(new Set(e.eips.map((x) => x.number)));
            })
            .finally(() => setIsLoading(false));
    }, []);

    const counts = useMemo(() => statusCounts(index), [index]);
    const base = useMemo(() => baseStandards(index), [index]);
    const sorted = useMemo(() => sortErcs(records, index), [records, index]);
    const visible = useMemo(() => sorted.filter((r) => matchErc(r, { query, topic })), [sorted, query, topic]);
    const topics = useMemo(() => ERC_TOPICS.filter((tp) => records.some((r) => r.topic === tp)), [records]);
    const has = useMemo(() => ({ eips: eipSet, ercs: new Set(records.map((r) => r.number)), ercIndex: new Set(index.map((e) => e.number)) }), [eipSet, records, index]);
    const titleOf = useMemo(() => new Map(index.map((e) => [e.number, e.title])), [index]);
    const maxBase = base[0]?.count ?? 1;
    const rows = t('diff.rows', { returnObjects: true }) as DiffRow[];

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <div className="max-w-5xl mx-auto break-keep">
                <StandardTabs active="erc" />
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-14">
                    <div className="inline-block px-4 py-1.5 rounded-full border border-theme-border bg-theme-surface text-sm font-medium text-brand-primary mb-4">{t('badge')}</div>
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-brand-accent">{t('title')}</h1>
                    <p className="text-theme-text-muted max-w-3xl text-base md:text-lg font-light leading-relaxed">{t('description')}</p>
                </motion.div>

                <section aria-labelledby="erc-diff" className="border-t border-theme-border py-10">
                    <h2 id="erc-diff" className="text-2xl font-bold mb-5">
                        {t('diff.title')}
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[34rem] text-sm">
                            <thead>
                                <tr className="border-b border-theme-border text-xs text-theme-text-muted">
                                    <th scope="col" className="pb-2 text-left font-medium w-1/5" />
                                    <th scope="col" className="pb-2 px-4 text-left font-medium">
                                        {t('diff.eip')}
                                    </th>
                                    <th scope="col" className="pb-2 px-4 text-left font-medium text-brand-accent">
                                        {t('diff.erc')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.k} className="border-b border-theme-border">
                                        <th scope="row" className="py-3 text-left font-semibold">
                                            {r.k}
                                        </th>
                                        <td className="py-3 px-4 text-theme-text-muted leading-relaxed">{r.eip}</td>
                                        <td className="py-3 px-4 leading-relaxed">{r.erc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {index.length > 0 && (
                    <section aria-labelledby="erc-life" className="border-t border-theme-border py-10">
                        <h2 id="erc-life" className="text-2xl font-bold mb-2">
                            {t('life.title')}
                        </h2>
                        <p className="text-theme-text-muted mb-6">{t('life.intro', { count: index.length })}</p>
                        <ol className="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                            {ERC_STATUSES.map((s) => (
                                <li key={s} className={`rounded-xl border p-4 flex flex-col gap-1.5 ${s === 'Final' ? 'border-emerald-400/40 bg-emerald-400/5' : 'border-theme-border bg-theme-surface'}`}>
                                    <span className={`font-mono text-xs font-semibold ${ERC_STATUS_TEXT[s]}`}>{s}</span>
                                    <span className="text-2xl font-bold tabular-nums">{counts[s] ?? 0}</span>
                                    <span className="text-xs leading-relaxed text-theme-text-muted">{t(`life.${s}`)}</span>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                {base.length > 0 && (
                    <section aria-labelledby="erc-base" className="border-t border-theme-border py-10">
                        <h2 id="erc-base" className="text-2xl font-bold mb-2">
                            {t('base.title')}
                        </h2>
                        <p className="text-theme-text-muted mb-6">{t('base.intro')}</p>
                        <ul className="flex flex-col gap-3">
                            {base.map((b) => {
                                const link = standardHref(b.number, has);
                                const name = titleOf.get(b.number) ?? '';
                                const label = (
                                    <>
                                        <span className="font-mono text-brand-accent">{link.label}</span> <span className="text-theme-text-muted">{name}</span>
                                    </>
                                );
                                return (
                                    <li key={b.number} className="grid grid-cols-[minmax(0,1fr)_4rem] sm:grid-cols-[16rem_minmax(0,1fr)_4rem] gap-x-4 gap-y-1 items-center text-sm">
                                        {link.internal ? (
                                            <Link to={link.href} className="truncate hover:underline">
                                                {label}
                                            </Link>
                                        ) : (
                                            <a href={link.href} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                                                {label}
                                            </a>
                                        )}
                                        <span aria-hidden className="hidden sm:block h-2 rounded bg-theme-surface overflow-hidden">
                                            <span className="block h-full rounded bg-brand-primary" style={{ width: `${(b.count / maxBase) * 100}%` }} />
                                        </span>
                                        <span className="text-right tabular-nums">{t('base.count', { count: b.count })}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}

                <section aria-labelledby="erc-list" className="border-t border-theme-border pt-10">
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                        <div>
                            <h2 id="erc-list" className="text-2xl font-bold">
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
                        <button type="button" aria-pressed={!topic} onClick={() => setTopic(null)} className={`${CHIP} ${on(!topic)}`}>
                            {t('list.all')}
                        </button>
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
                            {visible.map((r) => {
                                const deps = dependentsOf(index, r.number).length;
                                const meta = deps
                                    ? t('list.dependents', { count: deps })
                                    : r.meta.requires.length
                                      ? t('list.requires', { list: r.meta.requires.map((n) => standardHref(n, has).label).join(', ') })
                                      : '';
                                return (
                                    <li key={r.number}>
                                        <Link to={`/ercs/${r.number}`} className="h-full rounded-xl border border-theme-border bg-theme-surface p-5 flex flex-col gap-3 hover:border-brand-primary transition-colors">
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="font-mono text-sm text-theme-text-muted">ERC-{r.number}</span>
                                                <span className={`text-xs font-semibold ${ERC_STATUS_TEXT[r.meta.status] ?? 'text-theme-text-muted'}`}>{r.meta.status}</span>
                                            </span>
                                            <span className="text-lg font-bold leading-snug">{r.titleKo}</span>
                                            <span className="text-sm leading-relaxed text-theme-text-muted">{r.summary}</span>
                                            <span className="mt-auto pt-3 border-t border-theme-border flex flex-wrap gap-x-4 gap-y-1 text-xs text-theme-text-muted">
                                                <span>{r.topic}</span>
                                                {meta && <span>{meta}</span>}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Ercs;
