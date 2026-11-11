import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import { eipUrl, loadEips, type EipRecord } from '../data/eipsData';
import { loadErcIndex, loadErcList } from '../data/ercsData';
import { standardHref } from '../utils/ercs';
import { loadEthCalls, type CallRecord } from '../data/ethCallsData';
import { loadEthDebateList, type Debate } from '../data/ethDebatesData';
import { debatesFor, inclusionLabel, inclusionOf, journeyOf } from '../utils/eips';
import { dotDate, STATUS_DOT, STATUS_TEXT } from '../utils/calls';
import { participantCount } from '../utils/debates';

const H2 = 'text-xl md:text-2xl font-bold';
const SIDE_H = 'text-sm font-bold mb-3';

const EipDetail: React.FC = () => {
    const { number } = useParams();
    const n = Number(number);
    const { t } = useTranslation('eips');
    const [records, setRecords] = useState<EipRecord[] | null>(null);
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [debates, setDebates] = useState<Debate[]>([]);
    const [ercSets, setErcSets] = useState<{ ercs: Set<number>; ercIndex: Set<number> }>(() => ({ ercs: new Set(), ercIndex: new Set() }));

    useEffect(() => {
        loadEips().then((f) => setRecords(f.eips));
        loadEthCalls().then((f) => setCalls(f.calls));
        loadEthDebateList().then(setDebates);
        Promise.all([loadErcList(), loadErcIndex()])
            .then(([r, i]) => setErcSets({ ercs: new Set(r.ercs.map((x) => x.number)), ercIndex: new Set(i.ercs.map((x) => x.number)) }))
            .catch(() => undefined);
    }, []);

    const r = records?.find((x) => x.number === n) ?? null;
    const known = useMemo(() => new Set((records ?? []).map((x) => x.number)), [records]);
    const inc = useMemo(() => inclusionOf(calls, n), [calls, n]);
    const journey = useMemo(() => journeyOf(calls, n), [calls, n]);
    const related = useMemo(() => debatesFor(debates, n), [debates, n]);
    const callCount = new Set(journey.map((j) => j.callId)).size;

    usePageMeta({
        title: r ? `EIP-${n} ${r.titleKo}` : `EIP-${number ?? ''}`,
        description: r?.summary ?? t('description'),
        canonical: `/eips/${number ?? ''}`,
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
                    <a href={eipUrl(n)} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                        {t('detail.original')}
                    </a>
                    <p className="mt-6">
                        <Link to="/eips" className="text-brand-accent hover:underline">
                            ← {t('detail.backToList')}
                        </Link>
                    </p>
                </div>
            </div>
        );
    }

    const authors = r.meta.authors.length > 4 ? t('detail.authorsMore', { names: r.meta.authors.slice(0, 4).join(', '), count: r.meta.authors.length - 4 }) : r.meta.authors.join(', ');
    const relatedEips = r.related.length ? r.related : r.meta.requires.slice(0, 5).map((x) => ({ number: x, note: '' }));

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <article className="max-w-5xl mx-auto break-keep">
                <header className="pb-8 flex flex-col gap-4">
                    <Link to="/eips" className="text-sm text-theme-text-muted hover:text-theme-text w-fit">
                        ← {t('detail.backToList')}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono text-sm text-theme-text-muted">EIP-{r.number}</span>
                        <span className={`px-2.5 py-1 rounded-full border border-theme-border font-semibold ${inc ? STATUS_TEXT[inc.status] : 'text-theme-text-muted'}`}>
                            {inclusionLabel(inc, r.meta.status)}
                        </span>
                        {inc?.headliner && <span className="px-2.5 py-1 rounded-full bg-brand-primary text-white font-semibold">{t('detail.headliner', { fork: inc.fork ?? '' })}</span>}
                        <span className="px-2.5 py-1 rounded-full border border-theme-border text-theme-text-muted">{r.topic}</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                        {r.titleKo} <span className="block md:inline text-xl md:text-3xl font-medium text-theme-text-muted">{r.meta.title}</span>
                    </h1>
                    <p className="max-w-3xl text-lg md:text-xl leading-relaxed text-theme-text">{r.summary}</p>
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
                            {r.example && (
                                <div>
                                    <p className="text-sm font-semibold text-theme-text-muted mb-2">{r.example.title}</p>
                                    <ol className="flex flex-col gap-2">
                                        {r.example.steps.map((s) => (
                                            <li key={s.title} className="rounded-lg border border-theme-border bg-theme-bg p-4 grid gap-x-4 gap-y-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
                                                <span className="font-mono text-xs font-bold text-brand-accent sm:pt-0.5">{s.label}</span>
                                                <span className="flex flex-col gap-1">
                                                    <span className="text-sm font-bold">{s.title}</span>
                                                    <span className="text-[13px] leading-relaxed text-theme-text-muted">{s.body}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}
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

                        {journey.length > 0 && (
                            <section aria-labelledby="journey">
                                <h2 id="journey" className={H2}>
                                    {t('detail.journey')}
                                </h2>
                                <p className="mt-1 mb-5 text-sm text-theme-text-muted">{t('detail.journeyIntro', { count: callCount })}</p>
                                <ol>
                                    {journey.map((j, i) => (
                                        <li key={`${j.callId}-${i}`} className="grid grid-cols-[3.5rem_1rem_minmax(0,1fr)] gap-x-3">
                                            <span className="font-mono text-sm tabular-nums text-theme-text-muted pt-0.5">{dotDate(j.date).slice(5)}</span>
                                            <span aria-hidden className="flex flex-col items-center">
                                                <span className={`mt-1.5 w-2.5 h-2.5 rounded-full ${j.status ? STATUS_DOT[j.status] : 'bg-theme-border'}`} />
                                                {i < journey.length - 1 && <span className="flex-1 w-px bg-theme-border" />}
                                            </span>
                                            <div className="pb-6 flex flex-col gap-1">
                                                <span className="text-sm">
                                                    <Link to={`/calls/${j.callId}`} className="font-semibold text-brand-accent hover:underline">
                                                        {j.call}
                                                    </Link>
                                                    {j.status && <span className={`ml-2 text-xs font-semibold ${STATUS_TEXT[j.status]}`}>{j.status}</span>}
                                                </span>
                                                <span className="text-[15px] leading-relaxed">{j.text ?? t('detail.discussed')}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
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
                                            <Link to={`/debates/${d.id}`} className="block rounded-xl border border-theme-border p-4 hover:border-brand-primary transition-colors">
                                                <span className="block font-bold leading-snug">{d.title}</span>
                                                <span className="block mt-1 text-xs text-theme-text-muted">
                                                    {participantCount(d)}명 · {dotDate(d.lastActivity)}
                                                </span>
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
                                <dt className="text-theme-text-muted">{t('detail.type')}</dt>
                                <dd>{[r.meta.type, r.meta.category].filter(Boolean).join(' · ')}</dd>
                                <dt className="text-theme-text-muted">{t('detail.status')}</dt>
                                <dd>{r.meta.status}</dd>
                                <dt className="text-theme-text-muted">{t('detail.created')}</dt>
                                <dd className="tabular-nums">{dotDate(r.meta.created)}</dd>
                                {inc?.fork && (
                                    <>
                                        <dt className="text-theme-text-muted">{t('detail.fork')}</dt>
                                        <dd>
                                            {inc.fork} ({inc.status}, {dotDate(inc.date).slice(5)})
                                        </dd>
                                    </>
                                )}
                                <dt className="text-theme-text-muted">{t('detail.authors')}</dt>
                                <dd>{authors}</dd>
                                {r.meta.requires.length > 0 && (
                                    <>
                                        <dt className="text-theme-text-muted">{t('detail.requires')}</dt>
                                        <dd className="font-mono text-xs leading-6">{r.meta.requires.map((x) => `EIP-${x}`).join(', ')}</dd>
                                    </>
                                )}
                            </dl>
                            <div className="mt-3 flex flex-col">
                                <a href={eipUrl(r.number)} target="_blank" rel="noopener noreferrer" className="min-h-[44px] flex items-center text-sm font-semibold text-brand-accent hover:underline">
                                    {t('detail.original')} →
                                </a>
                                {r.meta.discussionsTo && (
                                    <a href={r.meta.discussionsTo} target="_blank" rel="noopener noreferrer" className="min-h-[44px] flex items-center text-sm text-brand-accent hover:underline">
                                        {t('detail.discussion')} →
                                    </a>
                                )}
                            </div>
                        </section>

                        {relatedEips.length > 0 && (
                            <section>
                                <h2 className={SIDE_H}>{t('detail.related')}</h2>
                                <ul className="flex flex-col gap-2.5 text-sm">
                                    {relatedEips.map((x) => (
                                        <li key={x.number}>
                                            {(() => {
                                                const link = standardHref(x.number, { eips: known, ...ercSets });
                                                return link.internal ? (
                                                    <Link to={link.href} className="font-mono text-brand-accent hover:underline">
                                                        {link.label}
                                                    </Link>
                                                ) : (
                                                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="font-mono text-brand-accent hover:underline">
                                                        {link.label}
                                                    </a>
                                                );
                                            })()}
                                            {x.note && <span className="ml-2 text-theme-text-muted">{x.note}</span>}
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

export default EipDetail;
