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
const TAG = 'px-1.5 py-0.5 rounded border border-theme-border text-[10px] font-bold tracking-wider whitespace-nowrap';
const BTN = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-theme-border text-xs text-theme-text-secondary hover:border-brand-primary/60 hover:text-theme-text transition-colors whitespace-nowrap';
/** 본문 섹션 사이 구분: 카드 대신 윗선과 여백 */
const SECTION = 'flex flex-col gap-3 border-t border-theme-border pt-6';

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

/** 스크롤 위치에 따라 현재 섹션 id를 돌려준다 (사이드 목차 강조용) */
function useActiveSection(ids: string[]): string | null {
    const [active, setActive] = useState<string | null>(null);
    useEffect(() => {
        if (ids.length === 0 || typeof IntersectionObserver === 'undefined') return;
        const visible = new Map<string, number>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
                    else visible.delete(e.target.id);
                }
                const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
                if (top) setActive(top[0]);
            },
            { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
        );
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        }
        return () => observer.disconnect();
    }, [ids]);
    return active;
}

const CallDetail: React.FC = () => {
    const { id } = useParams();
    const { t } = useTranslation('calls');
    const [calls, setCalls] = useState<CallRecord[] | null>(null);
    const [debates, setDebates] = useState<Debate[]>([]);
    const [modal, setModal] = useState<ModalState | null>(null);
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

    // 사이드 목차 항목: 존재하는 섹션만
    const toc = useMemo(() => {
        if (!call || call.kind !== 'full') return [];
        const items: Array<{ id: string; label: string; sub?: boolean }> = [];
        if (call.speakers.length) items.push({ id: 'participants', label: t('detail.participantsShort') });
        if (call.whyItMatters) items.push({ id: 'why', label: t('detail.whyItMatters') });
        if (call.decisions.length) items.push({ id: 'decisions', label: `${t('detail.decisions')} ${call.decisions.length}` });
        if (call.targets.length) items.push({ id: 'targets', label: t('detail.targets') });
        call.topics.forEach((tp, i) => items.push({ id: `topic-${i + 1}`, label: `${t('detail.topicShort', { n: i + 1 })} · ${tp.title}`, sub: true }));
        if (call.chat.length) items.push({ id: 'chat', label: t('detail.chat') });
        if (related.length) items.push({ id: 'related', label: t('detail.relatedDebates') });
        if (call.glossary.length) items.push({ id: 'glossary', label: t('detail.glossary') });
        return items;
    }, [call, related.length, t]);
    const tocIds = useMemo(() => toc.map((x) => x.id), [toc]);
    const active = useActiveSection(tocIds);

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
    const isFull = call.kind === 'full';

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12 items-start">
                {/* 사이드: 목차, 안건 순서, 이 콜의 EIP, 액션 아이템 */}
                {isFull && (
                    <aside className="hidden lg:flex flex-col gap-7 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
                        <nav aria-label={t('detail.onThisPage')} className="flex flex-col gap-1.5">
                            <span className={KICKER}>{t('detail.onThisPage')}</span>
                            {toc.map((item) => (
                                <a
                                    key={item.id}
                                    href={`#${item.id}`}
                                    aria-current={active === item.id ? 'location' : undefined}
                                    className={`text-[13px] leading-snug transition-colors hover:text-theme-text ${item.sub ? 'pl-3' : ''} ${active === item.id ? 'text-theme-text font-semibold' : 'text-theme-text-muted'}`}
                                >
                                    {item.label}
                                </a>
                            ))}
                        </nav>
                        {call.agenda.length > 0 && (
                            <div className="flex flex-col gap-1.5 border-t border-theme-border pt-5">
                                <span className={KICKER}>{t('detail.agenda', { count: call.agenda.length })}</span>
                                <ol className="flex flex-col gap-1">
                                    {call.agenda.map((a) => (
                                        <li key={a.timestamp} className="grid grid-cols-[56px_minmax(0,1fr)] gap-2 items-start text-xs leading-relaxed">
                                            <TimeLink videoUrl={call.videoUrl} timestamp={a.timestamp} />
                                            <span className={a.discussion || a.decision ? 'text-theme-text' : 'text-theme-text-muted'}>{a.heading}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                        {call.eips.length > 0 && (
                            <div className="flex flex-col gap-1.5 border-t border-theme-border pt-5">
                                <span className={KICKER}>{t('detail.eips', { count: call.eips.length })}</span>
                                <ul className="flex flex-col gap-1.5 text-sm">
                                    {call.eips.map((n) => (
                                        <li key={n} className="flex items-center gap-2 min-w-0">
                                            <a href={`https://eips.ethereum.org/EIPS/eip-${n}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-brand-accent hover:underline shrink-0">
                                                EIP-{n}
                                            </a>
                                            <span className="text-xs text-theme-text-secondary truncate">{call.decisions.find((d) => d.eips.includes(n))?.label.replace(/^(EIP-)?\d{3,5}\s*/, '') ?? ''}</span>
                                            {eipStatus.has(n) && <span className={`${TAG} ml-auto ${STATUS_TEXT[eipStatus.get(n) as keyof typeof STATUS_TEXT]}`}>{eipStatus.get(n)}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {call.actions.length > 0 && (
                            <div className="flex flex-col gap-2.5 border-t border-theme-border pt-5">
                                <span className={KICKER}>{t('detail.actions', { count: call.actions.length })}</span>
                                <ul className="flex flex-col gap-2.5 list-disc pl-4 marker:text-theme-text-muted">
                                    {call.actions.map((a, i) => (
                                        <li key={`${a.owner}-${i}`} className="flex flex-col gap-0.5 list-item">
                                            <span className="text-sm font-semibold">{a.owner}</span>
                                            <span className="text-xs text-theme-text-muted leading-relaxed">{a.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </aside>
                )}

                <article className="flex flex-col gap-6 min-w-0">
                    {/* 머리 */}
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
                        {!isFull && <p className="text-sm text-theme-text-muted">{t('detail.recordOnly')}</p>}
                        {isFull && (
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

                    {/* 참여자: 작은 칩, 줄바꿈으로 전부. 소속은 툴팁 */}
                    {isFull && speakersSorted.length > 0 && (
                        <section id="participants" className={SECTION}>
                            <div className="flex flex-wrap items-baseline gap-3">
                                <span className={KICKER}>{t('detail.participants', { count: call.speakers.length })}</span>
                                <span className="text-xs text-theme-text-muted">{t('detail.participantsHintCompact')}</span>
                            </div>
                            <ul className="flex flex-wrap gap-1.5" role="list">
                                {speakersSorted.map((s) => {
                                    const remarks = remarksOf(call, s.label).length;
                                    const holder = holderOfSpeaker(s);
                                    return (
                                        <li key={s.label}>
                                            <button
                                                type="button"
                                                onClick={() => openSpeaker(s)}
                                                disabled={remarks === 0}
                                                title={[holder.name, holder.role ?? t('detail.unknownOrg')].join(' · ')}
                                                className={`inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-theme-border text-xs font-semibold transition-colors hover:border-brand-primary/60 hover:bg-theme-surface-hover disabled:cursor-default disabled:hover:border-theme-border disabled:hover:bg-transparent ${
                                                    s.share > 0 ? 'text-theme-text' : 'text-theme-text-muted'
                                                }`}
                                            >
                                                <Avatar holder={holder} size="xs" />
                                                {s.name}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}

                    {/* 왜 중요한가 */}
                    {isFull && call.whyItMatters && (
                        <section id="why" className={SECTION}>
                            <span className={KICKER}>{t('detail.whyItMatters')}</span>
                            <p className="text-[15px] md:text-base leading-relaxed max-w-4xl">{call.whyItMatters}</p>
                        </section>
                    )}

                    {/* 결정: 결정마다 한 줄 */}
                    {isFull && call.decisions.length > 0 && (
                        <section id="decisions" className={SECTION}>
                            <div className="flex flex-wrap items-baseline gap-3">
                                <span className={KICKER}>{t('detail.decisionsCard', { count: call.decisions.length })}</span>
                                {call.videoUrl && <span className="text-xs text-theme-text-muted">{t('detail.timestampHint')}</span>}
                            </div>
                            <ul className="flex flex-col border-b border-theme-border/70">
                                {call.decisions.map((d, i) => (
                                    <li
                                        key={`${d.label}-${i}`}
                                        className="grid grid-cols-[8px_minmax(0,1fr)] md:grid-cols-[8px_220px_minmax(0,1fr)_72px] gap-x-3 gap-y-1 items-start py-3 border-t border-theme-border/70"
                                    >
                                        <span className={`w-2 h-2 rounded-full mt-1.5 ${STATUS_DOT[d.status]}`} aria-hidden />
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold">{d.label}</span>
                                            <span className={`${TAG} ${STATUS_TEXT[d.status]}`}>{d.status}</span>
                                            {d.fork && <span className="text-xs text-theme-text-muted">{d.fork}</span>}
                                        </span>
                                        <span className="col-start-2 md:col-start-3 text-sm leading-relaxed text-theme-text-secondary" title={d.original}>
                                            {d.text}
                                        </span>
                                        <TimeLink videoUrl={call.videoUrl} timestamp={d.timestamp} className="col-start-2 md:col-start-4 md:justify-self-end pt-0.5" />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* 일정과 목표: 두 열 */}
                    {isFull && call.targets.length > 0 && (
                        <section id="targets" className={SECTION}>
                            <div className="flex flex-wrap items-baseline gap-3">
                                <span className={KICKER}>{t('detail.targets')}</span>
                                <span className="text-xs text-theme-text-muted">{t('detail.targetsHint')}</span>
                            </div>
                            <ul className="grid md:grid-cols-2 gap-x-8 gap-y-3 text-sm list-disc pl-5 marker:text-theme-text-muted">
                                {call.targets.map((tg) => (
                                    <li key={tg.key} className="flex flex-col gap-0.5 list-item">
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
                        </section>
                    )}

                    {/* 안건·EIP·액션: 사이드가 숨는 좁은 화면에서만 본문에 */}
                    {isFull && (call.agenda.length > 0 || call.actions.length > 0) && (
                        <section className={`${SECTION} lg:hidden`}>
                            {call.agenda.length > 0 && (
                                <>
                                    <span className={KICKER}>{t('detail.agenda', { count: call.agenda.length })}</span>
                                    <ol className="flex flex-col">
                                        {call.agenda.map((a) => (
                                            <li key={a.timestamp} className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-3 items-center py-1.5 text-sm">
                                                <TimeLink videoUrl={call.videoUrl} timestamp={a.timestamp} />
                                                <span>{a.heading}</span>
                                                <span className="flex gap-1">
                                                    {a.discussion && <span className={`${TAG} text-brand-accent`}>{t('detail.discussion')}</span>}
                                                    {a.decision && <span className={`${TAG} text-emerald-400`}>{t('detail.decision')}</span>}
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                </>
                            )}
                            {call.actions.length > 0 && (
                                <>
                                    <span className={`${KICKER} mt-3`}>{t('detail.actions', { count: call.actions.length })}</span>
                                    <ul className="flex flex-col gap-2.5 text-sm list-disc pl-5 marker:text-theme-text-muted">
                                        {call.actions.map((a, i) => (
                                            <li key={`${a.owner}-${i}`} className="flex flex-col gap-0.5 list-item">
                                                <span className="font-semibold">{a.owner}</span>
                                                <span className="text-xs text-theme-text-muted leading-relaxed">{a.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </section>
                    )}

                    {/* 토론과 발언 */}
                    {isFull && call.topics.length > 0 && (
                        <div className={SECTION}>
                            <div className="flex flex-wrap items-baseline gap-3">
                                <span className={KICKER}>{t('detail.topics')}</span>
                                <span className="text-xs text-theme-text-muted">{t('detail.clickHint')}</span>
                            </div>
                            {call.topics.map((topic, ti) => (
                                <section key={topic.title} id={`topic-${ti + 1}`} className={`flex flex-col gap-3 scroll-mt-24 ${ti > 0 ? 'border-t border-theme-border pt-6 mt-3' : ''}`}>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span className="text-[11px] font-mono uppercase tracking-widest text-brand-accent">{t('detail.topic', { n: ti + 1, count: topic.positions.length })}</span>
                                        <span className="text-lg font-bold">{topic.title}</span>
                                        <span className={`${TAG} ${topic.decision ? 'text-emerald-400' : 'text-theme-text-muted'}`}>{topic.decision ?? t('detail.noDecision')}</span>
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
                                                        className="w-full text-left grid grid-cols-[32px_minmax(0,1fr)] md:grid-cols-[32px_190px_minmax(0,1fr)] gap-x-4 gap-y-1 px-2 py-2.5 -mx-2 rounded-xl hover:bg-theme-surface-hover transition-colors items-start"
                                                    >
                                                        <Avatar holder={holder} size="md" />
                                                        <span className="min-w-0 flex flex-col">
                                                            <span className="text-sm font-semibold truncate">{speaker.name}</span>
                                                            <span className="text-xs text-theme-text-muted truncate">
                                                                {holder.role ?? t('detail.unknownOrg')}
                                                                {p.viaChat ? ` · ${t('detail.viaChat')}` : ''}
                                                            </span>
                                                        </span>
                                                        <span className="col-span-2 md:col-span-1 text-[15px] leading-relaxed text-theme-text/90 max-w-3xl">{p.text}</span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {topic.quote && (
                                        <div className="border-l-2 border-brand-accent pl-4 py-1 flex flex-col gap-1">
                                            <p className="text-sm leading-relaxed text-theme-text-secondary italic max-w-3xl">"{topic.quote.text}"</p>
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
                        </div>
                    )}

                    {/* 채팅에서 */}
                    {isFull && call.chat.length > 0 && (
                        <section id="chat" className={SECTION}>
                            <span className={KICKER}>{t('detail.chat')}</span>
                            <ul className="grid md:grid-cols-3 gap-6 text-sm">
                                {call.chat.map((c, i) => (
                                    <li key={`${c.speaker}-${i}`} className="flex flex-col gap-0.5">
                                        <span className="text-theme-text-secondary leading-relaxed">"{c.text}"</span>
                                        <span className="text-xs text-theme-text-muted">
                                            {speakerOf(call, c.speaker).name} · {c.timestamp}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* 관련 논쟁 */}
                    {isFull && related.length > 0 && (
                        <section id="related" className={SECTION}>
                            <div className="flex flex-wrap items-baseline gap-3">
                                <span className={KICKER}>{t('detail.relatedDebates')}</span>
                                <span className="text-xs text-theme-text-muted">{t('detail.relatedDebatesHint')}</span>
                            </div>
                            <ul className="grid md:grid-cols-2 gap-x-8 gap-y-3">
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
                        </section>
                    )}

                    {/* 이 콜의 EIP: 좁은 화면에서만 본문에 */}
                    {isFull && call.eips.length > 0 && (
                        <section className={`${SECTION} lg:hidden`}>
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
                        </section>
                    )}

                    {/* 용어 */}
                    {call.glossary.length > 0 && (
                        <section id="glossary" className={SECTION}>
                            <span className={KICKER}>{t('detail.glossary')}</span>
                            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                                {call.glossary.map((g) => (
                                    <div key={g.term} className="flex flex-col gap-0.5">
                                        <dt className="text-xs font-bold">{g.term}</dt>
                                        <dd className="text-xs text-theme-text-muted leading-relaxed">{g.def}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    )}
                </article>
            </div>

            {modal && <RemarkModal call={call} entries={modal.entries} index={modal.index} title={modal.title} onIndex={setIndex} onClose={closeModal} />}
        </div>
    );
};

export default CallDetail;
