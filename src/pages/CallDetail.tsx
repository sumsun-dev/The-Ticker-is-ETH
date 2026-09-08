import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import { loadEthCalls, type CallRecord, type CallSpeaker } from '../data/ethCallsData';
import { loadEthDebates, type Debate } from '../data/ethDebatesData';
import Avatar from '../components/debates/Avatar';
import RemarkModal from '../components/calls/RemarkModal';
import { STATUS_DOT as DEBATE_STATUS_DOT, participantCount } from '../utils/debates';
import { STATUS_DOT, STATUS_TEXT, callLabel, dotDate, holderOfSpeaker, laterTargetUpdates, nextCallEstimate, remarksOf, seriesInfo, speakerOf, splitDuration, videoAt, type Remark } from '../utils/calls';

interface ModalState {
    entries: Remark[];
    index: number;
    title?: string;
}

const KICKER = 'text-[11px] font-mono uppercase tracking-widest text-theme-text-muted';
const CARD = 'rounded-2xl border border-theme-border bg-theme-surface p-5 flex flex-col gap-3';
const TAG = 'px-1.5 py-0.5 rounded border border-theme-border text-[10px] font-bold tracking-wider whitespace-nowrap';
const BTN = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-theme-border text-xs text-theme-text-secondary hover:border-brand-primary/60 hover:text-theme-text transition-colors whitespace-nowrap';

const TimeLink: React.FC<{ videoUrl?: string; timestamp?: string; className?: string }> = ({ videoUrl, timestamp, className = '' }) => {
    if (!timestamp) return null;
    const href = videoAt(videoUrl, timestamp);
    const cls = `font-mono text-[11px] tabular-nums ${href ? 'text-brand-accent hover:underline' : 'text-theme-text-muted'} ${className}`;
    return href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
            {timestamp}
        </a>
    ) : (
        <span className={cls}>{timestamp}</span>
    );
};

const CallDetail: React.FC = () => {
    const { id } = useParams();
    const { t } = useTranslation('calls');
    const [calls, setCalls] = useState<CallRecord[] | null>(null);
    const [debates, setDebates] = useState<Debate[]>([]);
    const [modal, setModal] = useState<ModalState | null>(null);
    const [showAll, setShowAll] = useState(false);
    const [openQuotes, setOpenQuotes] = useState<Set<number>>(new Set());

    useEffect(() => {
        loadEthCalls().then((file) => setCalls(file.calls));
        loadEthDebates().then(setDebates);
    }, []);

    const call = calls?.find((c) => c.id === id) ?? null;

    usePageMeta({
        title: call ? `${callLabel(call)} · ${call.headline?.replace(/\n/g, ' ') ?? call.title}` : 'Core Dev Calls',
        description: call?.summary ?? t('description'),
        canonical: `/calls/${id ?? ''}`,
        type: 'article',
        publishedTime: call?.date,
    });

    const updates = useMemo(() => (call && calls ? laterTargetUpdates(call, calls) : {}), [call, calls]);
    const related = useMemo(() => (call ? debates.filter((d) => call.relatedDebates.includes(d.id)) : []), [call, debates]);
    const nextCall = useMemo(() => {
        if (!call || !calls) return undefined;
        const later = calls.filter((c) => c.series === call.series && c.date > call.date).sort((a, b) => a.date.localeCompare(b.date))[0];
        return later ? { label: callLabel(later), date: later.date, id: later.id } : nextCallEstimate([call], call.date);
    }, [call, calls]);
    const host = useMemo(() => call?.speakers.find((s) => s.role?.includes('진행')) ?? call?.speakers[0], [call]);
    const forks = useMemo(() => [...new Set((call?.decisions ?? []).map((d) => d.fork).filter((f): f is string => Boolean(f)))], [call]);
    const eipStatus = useMemo(() => {
        const map = new Map<number, string>();
        for (const d of call?.decisions ?? []) for (const n of d.eips) if (!map.has(n)) map.set(n, d.status);
        return map;
    }, [call]);
    const speakersSorted = useMemo(() => [...(call?.speakers ?? [])].sort((a, b) => b.share - a.share), [call]);
    const maxShare = speakersSorted[0]?.share || 1;

    const openSpeaker = useCallback(
        (speaker: CallSpeaker, at?: Remark) => {
            if (!call) return;
            const entries = remarksOf(call, speaker.label);
            if (entries.length === 0) return;
            const index = at ? Math.max(0, entries.findIndex((e) => e.position === at.position)) : 0;
            setModal({ entries, index, title: speaker.name });
        },
        [call],
    );
    const closeModal = useCallback(() => setModal(null), []);
    const setIndex = useCallback((i: number) => setModal((m) => (m ? { ...m, index: i } : m)), []);
    const toggleQuote = (i: number) => setOpenQuotes((s) => (s.has(i) ? new Set([...s].filter((x) => x !== i)) : new Set([...s, i])));

    if (calls && !call) {
        return (
            <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
                <p className="text-theme-text-muted mb-4">{t('notFound')}</p>
                <Link to="/calls" className="text-brand-primary hover:underline">
                    {t('backToList')}
                </Link>
            </div>
        );
    }
    if (!call) {
        return (
            <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto" aria-busy>
                <div className="max-w-6xl mx-auto space-y-4">
                    <div className="h-8 w-2/3 rounded bg-theme-surface animate-pulse" />
                    <div className="h-64 rounded-2xl bg-theme-surface animate-pulse" />
                </div>
            </div>
        );
    }

    const info = seriesInfo(call.series);
    const duration = call.durationMin ? (splitDuration(call.durationMin).h > 0 ? t('duration.hm', splitDuration(call.durationMin)) : t('duration.m', splitDuration(call.durationMin))) : null;
    const speakingCount = call.speakers.filter((s) => s.share > 0).length;
    const visibleSpeakers = showAll ? speakersSorted : speakersSorted.slice(0, 10);

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <article className="max-w-6xl mx-auto flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                    <Link to="/calls" className="group inline-flex items-center gap-2 text-xs text-brand-accent">
                        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" aria-hidden />
                        {t('backToList')} / {info.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider text-white ${info.className}`}>{info.label}</span>
                        <span className="font-mono text-2xl font-bold tabular-nums">#{call.number}</span>
                        <span className="font-mono text-sm text-theme-text-muted tabular-nums">{dotDate(call.date)}</span>
                        <span className="flex flex-wrap gap-2 md:ml-auto">
                            {call.videoUrl && (
                                <a href={call.videoUrl} target="_blank" rel="noopener noreferrer" className={BTN}>
                                    {t('detail.video')} <ExternalLink size={11} aria-hidden />
                                </a>
                            )}
                            <a href={call.forkcastUrl} target="_blank" rel="noopener noreferrer" className={BTN}>
                                {t('detail.forkcast')} <ExternalLink size={11} aria-hidden />
                            </a>
                            {call.issueUrl && (
                                <a href={call.issueUrl} target="_blank" rel="noopener noreferrer" className={BTN}>
                                    {t('detail.issue')} <ExternalLink size={11} aria-hidden />
                                </a>
                            )}
                        </span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold leading-tight">{call.headline?.replace(/\n/g, ' ') ?? call.title}</h1>
                    {call.summary && <p className="text-sm md:text-base text-theme-text-secondary leading-relaxed max-w-4xl">{call.summary}</p>}
                    {call.kind === 'record' && <p className="text-sm text-theme-text-muted">{t('detail.recordOnly')}</p>}
                    {call.kind === 'full' && (
                        <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm mt-1">
                            {forks.length > 0 && (
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <dt className={KICKER}>{t('detail.fork')}</dt>
                                    <dd className="font-semibold">{forks.join(' → ')}</dd>
                                </div>
                            )}
                            {host && (
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <dt className={KICKER}>{t('detail.host')}</dt>
                                    <dd className="font-semibold">{[host.name, host.org].filter(Boolean).join(' · ')}</dd>
                                </div>
                            )}
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <dt className={KICKER}>{t('detail.speakers')}</dt>
                                <dd className="font-semibold">{t('detail.speakersCount', { count: speakingCount })}</dd>
                            </div>
                            {duration && (
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <dt className={KICKER}>{t('detail.duration')}</dt>
                                    <dd className="font-semibold font-mono tabular-nums">{duration}</dd>
                                </div>
                            )}
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <dt className={KICKER}>{t('detail.decisions')}</dt>
                                <dd className="font-semibold">{t('detail.decisionsCount', { decisions: call.decisions.length, topics: call.topics.length })}</dd>
                            </div>
                            {nextCall && (
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <dt className={KICKER}>{t('detail.nextCall')}</dt>
                                    <dd className="font-semibold">
                                        {'id' in nextCall ? (
                                            <Link to={`/calls/${nextCall.id}`} className="hover:text-brand-accent">
                                                {nextCall.label} · {dotDate(nextCall.date)}
                                            </Link>
                                        ) : (
                                            `${nextCall.label} · ${dotDate(nextCall.date)}`
                                        )}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    )}
                </div>

                {call.kind === 'full' && (
                    <div className="grid lg:grid-cols-[300px_minmax(0,1fr)_320px] gap-5 items-start">
                        <div className="flex flex-col gap-4 order-2 lg:order-1">
                            {call.decisions.length > 0 && (
                                <div className={CARD}>
                                    <span className={KICKER}>{t('detail.decisionsCard', { count: call.decisions.length })}</span>
                                    <ul className="flex flex-col">
                                        {call.decisions.map((d, i) => (
                                            <li key={`${d.label}-${i}`} className="flex flex-col gap-1 py-2.5 border-t first:border-t-0 first:pt-0 border-theme-border/70">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[d.status]}`} aria-hidden />
                                                    <span className="text-sm font-semibold">{d.label}</span>
                                                    <span className={`${TAG} ${STATUS_TEXT[d.status]}`}>{d.status}</span>
                                                    <TimeLink videoUrl={call.videoUrl} timestamp={d.timestamp} className="ml-auto" />
                                                </div>
                                                <span className="text-xs text-theme-text-muted leading-relaxed pl-4" title={d.original}>
                                                    {d.text}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    {call.videoUrl && <span className="text-xs text-theme-text-muted">{t('detail.timestampHint')}</span>}
                                </div>
                            )}
                            {call.targets.length > 0 && (
                                <div className={CARD}>
                                    <span className={KICKER}>{t('detail.targets')}</span>
                                    <ul className="flex flex-col gap-2.5 text-sm">
                                        {call.targets.map((tg) => (
                                            <li key={tg.key} className="flex flex-col gap-0.5">
                                                <span className="font-semibold leading-snug">{tg.text}</span>
                                                {updates[tg.key] && (
                                                    <span className="text-xs text-theme-text-muted">
                                                        →{' '}
                                                        <Link to={`/calls/${updates[tg.key].callId}`} className="text-teal-300 hover:underline">
                                                            {t('detail.updatedIn', { label: updates[tg.key].label })} {updates[tg.key].text}
                                                        </Link>
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                    <span className="text-xs text-theme-text-muted">{t('detail.targetsHint')}</span>
                                </div>
                            )}
                            {call.actions.length > 0 && (
                                <div className={CARD}>
                                    <span className={KICKER}>{t('detail.actions', { count: call.actions.length })}</span>
                                    <ul className="flex flex-col gap-2.5 text-sm">
                                        {call.actions.map((a, i) => (
                                            <li key={`${a.owner}-${i}`} className="flex flex-col gap-0.5">
                                                <span className="font-semibold">{a.owner}</span>
                                                <span className="text-xs text-theme-text-muted leading-relaxed">{a.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border border-theme-border bg-theme-surface px-5 order-1 lg:order-2">
                            {call.whyItMatters && (
                                <div className="flex flex-col gap-2 py-5">
                                    <span className={KICKER}>{t('detail.whyItMatters')}</span>
                                    <p className="text-sm leading-relaxed">{call.whyItMatters}</p>
                                </div>
                            )}
                            {call.agenda.length > 0 && (
                                <div className="flex flex-col gap-1.5 py-4 border-t border-theme-border">
                                    <div className="flex flex-wrap items-baseline gap-3">
                                        <span className={KICKER}>{t('detail.agenda', { count: call.agenda.length })}</span>
                                        <span className="text-xs text-theme-text-muted">{t('detail.agendaHint')}</span>
                                    </div>
                                    <ol className="flex flex-col">
                                        {call.agenda.map((a) => (
                                            <li key={a.timestamp} className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-3 items-center py-1.5 text-sm">
                                                <TimeLink videoUrl={call.videoUrl} timestamp={a.timestamp} />
                                                <span>{a.heading}</span>
                                                <span className="flex gap-1">
                                                    {a.discussion && (
                                                        <a href="#topics" className={`${TAG} text-brand-accent`}>
                                                            {t('detail.discussion')}
                                                        </a>
                                                    )}
                                                    {a.decision && <span className={`${TAG} text-emerald-400`}>{t('detail.decision')}</span>}
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                        </div>

                        <div className="flex flex-col gap-4 order-3">
                            {call.speakers.length > 0 && (
                                <div className={CARD}>
                                    <span className={KICKER}>{t('detail.participants', { count: call.speakers.length })}</span>
                                    <ul className="flex flex-col gap-0.5">
                                        {visibleSpeakers.map((s) => {
                                            const remarks = remarksOf(call, s.label).length;
                                            const holder = holderOfSpeaker(s);
                                            return (
                                                <li key={s.label}>
                                                    <button
                                                        type="button"
                                                        onClick={() => openSpeaker(s)}
                                                        disabled={remarks === 0}
                                                        className="w-full grid grid-cols-[32px_minmax(0,1fr)_64px] items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-theme-surface-hover transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                                                    >
                                                        <Avatar holder={holder} size="md" />
                                                        <span className="min-w-0 flex flex-col">
                                                            <span className="text-sm font-semibold truncate">{s.name}</span>
                                                            <span className="text-xs text-theme-text-muted truncate">{holder.role ?? t('detail.unknownOrg')}</span>
                                                        </span>
                                                        <span className="h-1 rounded-full bg-brand-primary justify-self-end" style={{ width: `${Math.max(4, (s.share / maxShare) * 64)}px` }} aria-hidden />
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {speakersSorted.length > 10 && (
                                        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs text-brand-accent self-start hover:underline">
                                            {showAll ? t('detail.less') : t('detail.more', { count: speakersSorted.length - 10 })}
                                        </button>
                                    )}
                                    <span className="text-xs text-theme-text-muted">{t('detail.participantsHint')}</span>
                                </div>
                            )}
                            {related.length > 0 && (
                                <div className={CARD}>
                                    <span className={KICKER}>{t('detail.relatedDebates')}</span>
                                    <ul className="flex flex-col gap-3">
                                        {related.map((d) => (
                                            <li key={d.id}>
                                                <Link to={`/debates/${d.id}`} className="group flex flex-col gap-1">
                                                    <span className="text-sm font-semibold leading-snug group-hover:text-brand-accent transition-colors">{d.title}</span>
                                                    <span className="text-xs text-theme-text-muted inline-flex items-center gap-1.5">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${DEBATE_STATUS_DOT[d.status]}`} aria-hidden />
                                                        {d.category} · {participantCount(d)}
                                                    </span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                    <span className="text-xs text-theme-text-muted">{t('detail.relatedDebatesHint')}</span>
                                </div>
                            )}
                            {call.eips.length > 0 && (
                                <div className={CARD}>
                                    <span className={KICKER}>{t('detail.eips', { count: call.eips.length })}</span>
                                    <ul className="flex flex-col gap-1.5 text-sm">
                                        {call.eips.map((n) => (
                                            <li key={n} className="flex items-center gap-2">
                                                <a href={`https://eips.ethereum.org/EIPS/eip-${n}`} target="_blank" rel="noopener noreferrer" className="font-mono text-brand-accent hover:underline">
                                                    EIP-{n}
                                                </a>
                                                <span className="text-theme-text-secondary truncate">{call.decisions.find((d) => d.eips.includes(n))?.label.replace(/^(EIP-)?\d{3,5}\s*/, '') ?? ''}</span>
                                                {eipStatus.has(n) && <span className={`${TAG} ml-auto ${STATUS_TEXT[eipStatus.get(n) as keyof typeof STATUS_TEXT]}`}>{eipStatus.get(n)}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {call.chat.length > 0 && (
                                <div className={CARD}>
                                    <span className={KICKER}>{t('detail.chat')}</span>
                                    <ul className="flex flex-col gap-3 text-sm">
                                        {call.chat.map((c, i) => (
                                            <li key={`${c.speaker}-${i}`} className="flex flex-col gap-0.5">
                                                <span className="text-theme-text-secondary leading-relaxed">"{c.text}"</span>
                                                <span className="text-xs text-theme-text-muted">
                                                    {speakerOf(call, c.speaker).name} · {c.timestamp}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {call.kind === 'full' && call.topics.length > 0 && (
                    <section id="topics" className="rounded-2xl border border-theme-border bg-theme-surface px-5">
                                {call.topics.map((topic, ti) => (
                                    <section key={topic.title} className="border-b last:border-b-0 border-theme-border py-6 flex flex-col gap-3">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span className="text-[11px] font-mono uppercase tracking-widest text-brand-accent">{t('detail.topic', { n: ti + 1, count: topic.positions.length })}</span>
                                            <span className="text-base font-bold">{topic.title}</span>
                                            <span className={`${TAG} ${topic.decision ? 'text-emerald-400' : 'text-theme-text-muted'}`}>{topic.decision ?? t('detail.noDecision')}</span>
                                            <span className="text-xs text-theme-text-muted md:ml-auto">{t('detail.clickHint')}</span>
                                        </div>
                                        <p className="text-sm leading-relaxed text-theme-text-secondary max-w-4xl">{topic.intro}</p>
                                        <ul className="flex flex-col">
                                            {topic.positions.map((p, pi) => {
                                                const speaker = speakerOf(call, p.speaker);
                                                const holder = holderOfSpeaker(speaker);
                                                return (
                                                    <li key={`${p.speaker}-${pi}`}>
                                                        <button
                                                            type="button"
                                                            onClick={() => openSpeaker(speaker, { topic, position: p })}
                                                            className="w-full text-left grid grid-cols-[32px_minmax(0,1fr)] md:grid-cols-[32px_220px_minmax(0,1fr)] gap-x-4 gap-y-1 px-2 py-3 rounded-xl hover:bg-theme-surface-hover transition-colors items-start"
                                                        >
                                                            <Avatar holder={holder} size="md" />
                                                            <span className="min-w-0 flex flex-col">
                                                                <span className="text-sm font-semibold truncate">{speaker.name}</span>
                                                                <span className="text-xs text-theme-text-muted truncate">
                                                                    {holder.role ?? t('detail.unknownOrg')}
                                                                    {p.viaChat ? ` · ${t('detail.viaChat')}` : ''}
                                                                </span>
                                                            </span>
                                                            <span className="col-span-2 md:col-span-1 text-sm md:text-[15px] leading-relaxed text-theme-text/90 max-w-4xl">{p.text}</span>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        {topic.quote && (
                                            <div className="border-l-2 border-brand-accent pl-4 py-1 flex flex-col gap-1">
                                                <p className="text-sm leading-relaxed text-theme-text-secondary italic max-w-4xl">"{topic.quote.text}"</p>
                                                <span className="text-xs text-theme-text-muted flex flex-wrap items-center gap-2">
                                                    {speakerOf(call, topic.quote.speaker).name} · <TimeLink videoUrl={call.videoUrl} timestamp={topic.quote.timestamp} />
                                                    <button type="button" onClick={() => toggleQuote(ti)} className="text-brand-accent hover:underline" aria-expanded={openQuotes.has(ti)}>
                                                        {t('detail.quoteOriginal')}
                                                    </button>
                                                </span>
                                                {openQuotes.has(ti) && <p className="text-xs leading-relaxed text-theme-text-muted">{topic.quote.original}</p>}
                                            </div>
                                        )}
                                    </section>
                                ))}
                    </section>
                )}

                {call.glossary.length > 0 && (
                    <div className="rounded-2xl border border-theme-border bg-theme-surface p-5 flex flex-col md:flex-row gap-4 md:gap-8">
                        <span className={`${KICKER} shrink-0 pt-0.5`}>{t('detail.glossary')}</span>
                        <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 flex-1">
                            {call.glossary.map((g) => (
                                <div key={g.term} className="flex flex-col gap-0.5">
                                    <dt className="text-xs font-bold">{g.term}</dt>
                                    <dd className="text-xs text-theme-text-muted leading-relaxed">{g.def}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                )}
            </article>

            {modal && <RemarkModal call={call} entries={modal.entries} index={modal.index} title={modal.title} onIndex={setIndex} onClose={closeModal} />}
        </div>
    );
};

export default CallDetail;
