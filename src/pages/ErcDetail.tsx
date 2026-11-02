import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import { ercUrl, loadErcIndex, loadErcs, type ErcIndexEntry, type ErcRecord } from '../data/ercsData';
import { loadEips } from '../data/eipsData';
import { loadEthDigests, type EthDigest } from '../data/ethNewsData';
import { loadEthDebates, type Debate } from '../data/ethDebatesData';
import { ERC_STATUS_TEXT, dependentsOf, digestMentions, standardHref } from '../utils/ercs';
import { debatesFor } from '../utils/eips';
import { dotDate } from '../utils/calls';

const H2 = 'text-xl md:text-2xl font-bold';
const SIDE_H = 'text-sm font-bold mb-3';

const StdLink: React.FC<{ link: ReturnType<typeof standardHref>; children: React.ReactNode }> = ({ link, children }) =>
    link.internal ? (
        <Link to={link.href} className="hover:underline">
            {children}
        </Link>
    ) : (
        <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {children}
        </a>
    );

const ErcDetail: React.FC = () => {
    const { number } = useParams();
    const n = Number(number);
    const { t } = useTranslation('ercs');
    const [records, setRecords] = useState<ErcRecord[] | null>(null);
    const [index, setIndex] = useState<ErcIndexEntry[]>([]);
    const [eipSet, setEipSet] = useState<Set<number>>(() => new Set());
    const [digests, setDigests] = useState<EthDigest[]>([]);
    const [debates, setDebates] = useState<Debate[]>([]);

    useEffect(() => {
        loadErcs().then((f) => setRecords(f.ercs));
        loadErcIndex().then((f) => setIndex(f.ercs));
        loadEips()
            .then((f) => setEipSet(new Set(f.eips.map((x) => x.number))))
            .catch(() => undefined);
        loadEthDigests().then(setDigests).catch(() => undefined);
        loadEthDebates().then(setDebates).catch(() => undefined);
    }, []);

    const r = records?.find((x) => x.number === n) ?? null;
    const has = useMemo(() => ({ eips: eipSet, ercs: new Set((records ?? []).map((x) => x.number)), ercIndex: new Set(index.map((e) => e.number)) }), [eipSet, records, index]);
    const titleOf = useMemo(() => new Map(index.map((e) => [e.number, e.title])), [index]);
    const dependents = useMemo(() => dependentsOf(index, n), [index, n]);
    const mentions = useMemo(() => digestMentions(digests, n), [digests, n]);
    const related = useMemo(() => debatesFor(debates, n), [debates, n]);

    usePageMeta({
        title: r ? `ERC-${n} ${r.titleKo}` : `ERC-${number ?? ''}`,
        description: r?.summary ?? t('description'),
        canonical: `/ercs/${number ?? ''}`,
        type: 'article',
        publishedTime: r?.generatedAt.slice(0, 10),
    });

    if (records === null) {
        return (
            <div className="min-h-screen pt-28 px-6 container mx-auto" aria-busy>
                <div className="max-w-5xl mx-auto h-64 rounded-xl bg-theme-surface animate-pulse" />
            </div>
        );
    }
    if (!r) {
        return (
            <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
                <div className="max-w-5xl mx-auto">
                    <p className="text-theme-text-muted mb-4">{t('detail.notFound')}</p>
                    <a href={ercUrl(n)} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                        {t('detail.original')}
                    </a>
                    <p className="mt-6">
                        <Link to="/ercs" className="text-brand-accent hover:underline">
                            ← {t('detail.backToList')}
                        </Link>
                    </p>
                </div>
            </div>
        );
    }

    const authors = r.meta.authors.length > 4 ? t('detail.authorsMore', { names: r.meta.authors.slice(0, 4).join(', '), count: r.meta.authors.length - 4 }) : r.meta.authors.join(', ');

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <article className="max-w-5xl mx-auto break-keep">
                <header className="pb-8 flex flex-col gap-4">
                    <Link to="/ercs" className="text-sm text-theme-text-muted hover:text-theme-text w-fit">
                        ← {t('detail.backToList')}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono text-sm text-theme-text-muted">ERC-{r.number}</span>
                        <span className={`px-2.5 py-1 rounded-full border border-theme-border font-semibold ${ERC_STATUS_TEXT[r.meta.status] ?? 'text-theme-text-muted'}`}>
                            {r.meta.status === 'Final' ? t('detail.finalBadge') : r.meta.status}
                        </span>
                        <span className="px-2.5 py-1 rounded-full border border-theme-border text-theme-text-muted">{r.topic}</span>
                        {r.meta.requires.slice(0, 2).map((x) => (
                            <span key={x} className="px-2.5 py-1 rounded-full border border-theme-border text-theme-text-muted">
                                {t('list.requires', { list: standardHref(x, has).label })}
                            </span>
                        ))}
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                        {r.titleKo} <span className="block md:inline text-xl md:text-3xl font-medium text-theme-text-muted">{r.meta.title}</span>
                    </h1>
                    <p className="max-w-3xl text-lg md:text-xl leading-relaxed">{r.summary}</p>
                </header>

                <div className="flex flex-wrap gap-12 items-start border-t border-theme-border pt-10">
                    <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-12">
                        <section aria-labelledby="why">
                            <h2 id="why" className={`${H2} mb-3`}>
                                {t('detail.why')}
                            </h2>
                            <p className="text-base leading-8 text-theme-text-muted whitespace-pre-line">{r.why}</p>
                        </section>

                        <section aria-labelledby="change">
                            <h2 id="change" className={`${H2} mb-4`}>
                                {t('detail.change')}
                            </h2>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-theme-border p-5">
                                    <p className={`${SIDE_H} text-theme-text-muted`}>{t('detail.before')}</p>
                                    <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed text-theme-text-muted">
                                        {r.before.map((x) => (
                                            <li key={x}>{x}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="rounded-xl border border-brand-primary/50 bg-brand-primary/10 p-5">
                                    <p className={`${SIDE_H} text-brand-accent`}>{t('detail.after', { n: r.number })}</p>
                                    <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
                                        {r.after.map((x) => (
                                            <li key={x}>{x}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <section aria-labelledby="impact">
                            <h2 id="impact" className={`${H2} mb-3`}>
                                {t('detail.impact')}
                            </h2>
                            <dl className="grid gap-x-8 sm:grid-cols-2">
                                {r.impact.map((x) => (
                                    <div key={x.who} className="py-3 border-b border-theme-border">
                                        <dt className="font-bold text-sm">{x.who}</dt>
                                        <dd className="mt-1 text-sm leading-relaxed text-theme-text-muted">{x.text}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>

                        {r.iface.length > 0 && (
                            <section aria-labelledby="iface">
                                <h2 id="iface" className={H2}>
                                    {t('detail.iface')}
                                </h2>
                                <p className="mt-1 mb-4 text-sm text-theme-text-muted">{t('detail.ifaceIntro')}</p>
                                <div className="rounded-xl border border-theme-border overflow-hidden">
                                    {r.iface.map((f) => (
                                        <div key={f.sig} className="grid md:grid-cols-2 border-b border-theme-border last:border-b-0">
                                            <pre className="m-0 p-4 bg-theme-surface font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">{f.sig}</pre>
                                            <p className="p-4 text-sm leading-relaxed text-theme-text-muted">{f.ko}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {r.flow && (
                            <section aria-labelledby="flow">
                                <h2 id="flow" className={`${H2} mb-1`}>
                                    {t('detail.flow')}
                                </h2>
                                <p className="mb-4 text-sm text-theme-text-muted">{r.flow.title}</p>
                                <ol className="flex flex-col gap-2">
                                    {r.flow.steps.map((s) => (
                                        <li key={s.title} className="rounded-lg border border-theme-border p-4 grid gap-x-4 gap-y-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
                                            <span className="font-mono text-xs font-bold text-brand-accent sm:pt-0.5">{s.label}</span>
                                            <span className="flex flex-col gap-1">
                                                <span className="text-sm font-bold">{s.title}</span>
                                                <span className="text-[13px] leading-relaxed text-theme-text-muted">{s.body}</span>
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        )}

                        <section aria-labelledby="deep" className="rounded-2xl border border-theme-border bg-theme-surface p-5 md:p-7 flex flex-col gap-5">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 id="deep" className={H2}>
                                        {t('detail.deep')}
                                    </h2>
                                    <span className="text-xs px-2.5 py-0.5 rounded-full border border-theme-border text-theme-text-muted">{t('detail.deepTag')}</span>
                                </div>
                                <p className="mt-1.5 text-sm text-theme-text-muted">{t('detail.deepIntro', { status: r.meta.status, created: dotDate(r.meta.created) })}</p>
                            </div>
                            <div className="border-t border-theme-border">
                                {r.deep.map((d, i) => (
                                    <details key={d.title} className="group border-b border-theme-border">
                                        <summary className="cursor-pointer min-h-[48px] flex items-center gap-3 font-bold list-none [&::-webkit-details-marker]:hidden">
                                            <span aria-hidden className="font-mono text-xs text-theme-text-muted w-6">
                                                {String(i + 1).padStart(2, '0')}
                                            </span>
                                            <span className="flex-1">{d.title}</span>
                                            <span aria-hidden className="text-theme-text-muted transition-transform group-open:rotate-45">
                                                +
                                            </span>
                                        </summary>
                                        <div className="pb-5 pl-9 flex flex-col gap-2">
                                            <p className="text-sm md:text-[15px] leading-7 text-theme-text-muted whitespace-pre-line">{d.body}</p>
                                            {d.ref && <p className="font-mono text-xs text-theme-text-muted/80">{d.ref}</p>}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </section>

                        {r.safety.length > 0 && (
                            <section aria-labelledby="safety">
                                <h2 id="safety" className={`${H2} mb-4`}>
                                    {t('detail.safety')}
                                </h2>
                                <ul className="flex flex-col gap-2.5">
                                    {r.safety.map((w) => (
                                        <li key={w.title} className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
                                            <p className="font-bold text-amber-300">{w.title}</p>
                                            <p className="mt-1 text-sm leading-relaxed text-theme-text-muted">{w.body}</p>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {related.length > 0 && (
                            <section aria-labelledby="debates">
                                <h2 id="debates" className={`${H2} mb-4`}>
                                    {t('detail.debates')}
                                </h2>
                                <ul className="flex flex-col gap-3">
                                    {related.map((d) => (
                                        <li key={d.id}>
                                            <Link to={`/debates/${d.id}`} className="block rounded-xl border border-theme-border p-4 hover:border-brand-primary transition-colors font-bold leading-snug">
                                                {d.title}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        <p className="text-xs leading-relaxed text-theme-text-muted border-t border-theme-border pt-4">{t('detail.disclaimer', { date: dotDate(r.generatedAt.slice(0, 10)) })}</p>
                    </div>

                    <aside aria-label={t('detail.facts')} className="flex-[1_1_260px] min-w-0 flex flex-col gap-8">
                        <section>
                            <h2 className={SIDE_H}>{t('detail.facts')}</h2>
                            <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
                                <dt className="text-theme-text-muted">{t('detail.status')}</dt>
                                <dd>{r.meta.status}</dd>
                                <dt className="text-theme-text-muted">{t('detail.created')}</dt>
                                <dd className="tabular-nums">{dotDate(r.meta.created)}</dd>
                                <dt className="text-theme-text-muted">{t('detail.authors')}</dt>
                                <dd>{authors}</dd>
                                <dt className="text-theme-text-muted">{t('detail.topic')}</dt>
                                <dd>{r.topic}</dd>
                            </dl>
                            <div className="mt-3 flex flex-col">
                                <a href={ercUrl(r.number)} target="_blank" rel="noopener noreferrer" className="min-h-[44px] flex items-center text-sm font-semibold text-brand-accent hover:underline">
                                    {t('detail.original')} →
                                </a>
                                {r.meta.discussionsTo && (
                                    <a href={r.meta.discussionsTo} target="_blank" rel="noopener noreferrer" className="min-h-[44px] flex items-center text-sm text-brand-accent hover:underline">
                                        {t('detail.discussion')} →
                                    </a>
                                )}
                            </div>
                        </section>

                        {(r.meta.requires.length > 0 || dependents.length > 0) && (
                            <section>
                                <h2 className={SIDE_H}>{t('detail.family')}</h2>
                                {r.meta.requires.length > 0 && (
                                    <div className="flex flex-col gap-1.5 text-sm">
                                        <span className="text-xs text-theme-text-muted">{t('detail.requires')}</span>
                                        {r.meta.requires.map((x) => {
                                            const link = standardHref(x, has);
                                            return (
                                                <StdLink key={x} link={link}>
                                                    <span className="font-mono text-brand-accent">{link.label}</span> <span className="text-theme-text-muted">{titleOf.get(x) ?? ''}</span>
                                                </StdLink>
                                            );
                                        })}
                                    </div>
                                )}
                                {dependents.length > 0 && (
                                    <div className="flex flex-col gap-1.5 text-sm mt-4 pt-4 border-t border-theme-border">
                                        <span className="text-xs text-theme-text-muted">{t('detail.dependents', { count: dependents.length })}</span>
                                        <p className="font-mono text-xs leading-6 flex flex-wrap gap-x-2">
                                            {dependents.slice(0, 24).map((d) => {
                                                const link = standardHref(d.number, has);
                                                return (
                                                    <StdLink key={d.number} link={link}>
                                                        <span className="text-brand-accent">{link.label}</span>
                                                    </StdLink>
                                                );
                                            })}
                                            {dependents.length > 24 && <span className="text-theme-text-muted">+{dependents.length - 24}</span>}
                                        </p>
                                    </div>
                                )}
                            </section>
                        )}

                        {mentions.length > 0 && (
                            <section>
                                <h2 className={SIDE_H}>{t('detail.mentions')}</h2>
                                <ul className="flex flex-col gap-2.5 text-sm">
                                    {mentions.map((m) => (
                                        <li key={`${m.date}-${m.title}`}>
                                            <Link to={`/news?date=${m.date}`} className="hover:underline">
                                                <span className="font-mono text-xs text-theme-text-muted mr-2">{dotDate(m.date).slice(5)}</span>
                                                {m.title}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {r.glossary.length > 0 && (
                            <section>
                                <h2 className={SIDE_H}>{t('detail.glossary')}</h2>
                                <dl className="flex flex-col gap-2.5 text-[13px] leading-relaxed">
                                    {r.glossary.map((g) => (
                                        <div key={g.term}>
                                            <dt className="font-bold">{g.term}</dt>
                                            <dd className="text-theme-text-muted">{g.def}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>
                        )}
                    </aside>
                </div>
            </article>
        </div>
    );
};

export default ErcDetail;
