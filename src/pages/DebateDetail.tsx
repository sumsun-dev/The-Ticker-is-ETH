import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import usePageMeta from '../hooks/usePageMeta';
import { loadEthDebates, type Debate, type DebateHolder, type DebatePosition, type DebateTimelineEntry } from '../data/ethDebatesData';
import Avatar from '../components/debates/Avatar';
import RelationGraph from '../components/debates/RelationGraph';
import TweetModal from '../components/debates/TweetModal';
import { STANCE_DOT, STANCE_TEXT, STATUS_DOT, entriesOf, relatedDigestDates, shortDate } from '../utils/debates';

interface ModalState {
    entries: DebateTimelineEntry[];
    index: number;
    title?: string;
}

const CLAMP3: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
const KICKER = 'text-[11px] font-mono uppercase tracking-widest text-theme-text-muted';
const CARD = 'rounded-2xl border border-theme-border bg-theme-surface p-5 flex flex-col gap-3';

const DebateDetail: React.FC = () => {
    const { id } = useParams();
    const { t } = useTranslation('debates');
    const [debates, setDebates] = useState<Debate[] | null>(null);
    const [modal, setModal] = useState<ModalState | null>(null);

    useEffect(() => {
        loadEthDebates().then(setDebates);
    }, []);

    const debate = debates?.find((d) => d.id === id) ?? null;

    usePageMeta({
        title: debate ? debate.title : 'Ethereum Debates',
        description: debate?.summary ?? t('description'),
        canonical: `/debates/${id ?? ''}`,
        type: 'article',
        publishedTime: debate?.firstSeen,
    });

    // 인용의 발화자 프로필: 입장 목록에서 핸들 또는 이름으로 찾는다
    const holderOf = useCallback(
        (by: string): DebateHolder => {
            const key = by.replace(/^@/, '').toLowerCase();
            for (const p of debate?.positions ?? []) {
                const hit = p.holders.find((h) => h.handle?.toLowerCase() === key || h.name.toLowerCase() === key);
                if (hit) return hit;
            }
            return { name: by, handle: /^[A-Za-z0-9_]+$/.test(by) ? by : undefined };
        },
        [debate],
    );

    const participants = useMemo(() => {
        if (!debate) return [];
        return debate.positions.flatMap((p) => p.holders.map((h) => ({ holder: h, stance: p.stance, count: entriesOf(debate, h).length })));
    }, [debate]);

    const openEntry = (entry: DebateTimelineEntry) => setModal({ entries: [entry], index: 0 });
    const openHolder = (holder: DebateHolder) => {
        if (!debate) return;
        const entries = entriesOf(debate, holder);
        if (entries.length > 0) setModal({ entries, index: 0, title: holder.name });
    };
    const openStance = (position: DebatePosition) => {
        if (!debate) return;
        const keys = new Set(position.holders.map((h) => (h.handle ?? h.name).toLowerCase()));
        const entries = debate.timeline.filter((e) => e.stance === position.stance || keys.has(e.by.replace(/^@/, '').toLowerCase()));
        if (entries.length > 0) setModal({ entries, index: 0, title: position.label });
    };
    const closeModal = useCallback(() => setModal(null), []);
    const setIndex = useCallback((i: number) => setModal((m) => (m ? { ...m, index: i } : m)), []);

    if (debates && !debate) {
        return (
            <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
                <p className="text-theme-text-muted mb-4">{t('notFound')}</p>
                <Link to="/debates" className="text-brand-primary hover:underline">
                    {t('backToList')}
                </Link>
            </div>
        );
    }

    if (!debate) {
        return (
            <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto" aria-busy>
                <div className="max-w-6xl mx-auto space-y-4">
                    <div className="h-8 w-2/3 rounded bg-theme-surface animate-pulse" />
                    <div className="h-64 rounded-2xl bg-theme-surface animate-pulse" />
                </div>
            </div>
        );
    }

    const digestDates = relatedDigestDates(debate);

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <article className="max-w-6xl mx-auto flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                    <Link to="/debates" className="group inline-flex items-center gap-2 text-xs text-brand-accent">
                        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" aria-hidden />
                        {t('backToList')} / {debate.category}
                    </Link>
                    <h1 className="text-3xl md:text-4xl font-bold leading-tight">{debate.title}</h1>
                    <p className="text-sm md:text-base text-theme-text-secondary leading-relaxed">{debate.summary}</p>
                    <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm mt-1">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <dt className={KICKER}>{t('status.label')}</dt>
                            <dd className="font-semibold inline-flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[debate.status]}`} aria-hidden />
                                {t(`status.${debate.status}`)}
                            </dd>
                        </div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <dt className={KICKER}>{t('period')}</dt>
                            <dd className="font-semibold font-mono tabular-nums">
                                {shortDate(debate.firstSeen)}
                                {debate.lastActivity !== debate.firstSeen && ` ~ ${shortDate(debate.lastActivity)}`}
                            </dd>
                        </div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <dt className={KICKER}>{t('participants')}</dt>
                            <dd className="font-semibold">{t('participantsCount', { people: participants.length, quotes: debate.timeline.length })}</dd>
                        </div>
                        {debate.engagement && (
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <dt className={KICKER}>{t('rootTweet')}</dt>
                                <dd className="font-semibold">{t('engagement', debate.engagement)}</dd>
                            </div>
                        )}
                    </dl>
                </div>

                <div className="grid lg:grid-cols-[300px_minmax(0,1fr)_320px] gap-5 items-start">
                    <div className="flex flex-col gap-4 order-2 lg:order-1">
                        {debate.background && (
                            <div className={CARD}>
                                <span className={KICKER}>{t('background')}</span>
                                <p className="text-sm leading-relaxed text-theme-text-secondary">{debate.background}</p>
                            </div>
                        )}
                        {debate.whyItMatters && (
                            <div className={CARD}>
                                <span className={KICKER}>{t('whyItMatters')}</span>
                                <p className="text-sm leading-relaxed text-theme-text-secondary">{debate.whyItMatters}</p>
                            </div>
                        )}
                        {debate.sources && debate.sources.length > 0 && (
                            <div className={CARD}>
                                <span className={KICKER}>{t('sources')}</span>
                                <ul className="flex flex-col gap-1">
                                    {debate.sources.map((s) => (
                                        <li key={s.url}>
                                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-accent hover:underline">
                                                {s.title}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {digestDates.length > 0 && (
                            <div className={CARD}>
                                <span className={KICKER}>{t('relatedDigests')}</span>
                                <div className="flex flex-wrap gap-2">
                                    {digestDates.map((date) => (
                                        <Link key={date} to={`/news?date=${date}`} className="font-mono text-xs text-brand-accent hover:underline">
                                            {shortDate(date)}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-theme-border bg-theme-surface px-5 order-1 lg:order-2">
                        <div className="flex flex-col gap-2 py-5">
                            <span className={KICKER}>{t('keyPoints')}</span>
                            <ol className="list-decimal pl-5 space-y-1 text-sm leading-relaxed">
                                {debate.keyPoints.map((k) => (
                                    <li key={k}>{k}</li>
                                ))}
                            </ol>
                        </div>
                        {debate.positions.map((p) => (
                            <section key={`${p.stance}-${p.label}`} className="border-t border-theme-border py-5 flex flex-col gap-3">
                                <button type="button" onClick={() => openStance(p)} className="group flex flex-wrap items-center gap-x-3 gap-y-1 text-left" title={t('clickHint')}>
                                    <span className={`w-2 h-2 rounded-full ${STANCE_DOT[p.stance]}`} aria-hidden />
                                    <span className={`text-[11px] font-mono uppercase tracking-widest ${STANCE_TEXT[p.stance]}`}>
                                        {t(`stance.${p.stance}`)} {p.holders.length}
                                    </span>
                                    <span className="text-base font-bold group-hover:text-brand-accent transition-colors">{p.label}</span>
                                </button>
                                <div className="flex flex-wrap gap-1.5">
                                    {p.holders.map((h) => (
                                        <button
                                            key={h.handle ?? h.name}
                                            type="button"
                                            onClick={() => openHolder(h)}
                                            className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-theme-border text-xs hover:border-brand-primary/60 hover:bg-theme-surface-hover transition-colors"
                                        >
                                            <Avatar holder={h} size="sm" />
                                            <span className="font-semibold">{h.name}</span>
                                            {h.role && <span className="text-theme-text-muted">{h.role}</span>}
                                            {!h.handle && h.watchlist === false && <span className="text-theme-text-muted">{t('cited')}</span>}
                                        </button>
                                    ))}
                                </div>
                                <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed text-theme-text/90">
                                    {p.points.map((pt) => (
                                        <li key={pt}>{pt}</li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>

                    <div className="flex flex-col gap-4 order-3">
                        <RelationGraph debate={debate} onSelect={openHolder} compact />
                        <div className={CARD}>
                            <span className={KICKER}>
                                {t('participants')} {participants.length}
                            </span>
                            <ul className="flex flex-col gap-1">
                                {participants.map(({ holder, stance, count }) => (
                                    <li key={holder.handle ?? holder.name}>
                                        <button
                                            type="button"
                                            onClick={() => openHolder(holder)}
                                            disabled={count === 0}
                                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-theme-surface-hover transition-colors disabled:opacity-60 disabled:cursor-default"
                                        >
                                            <span className={`w-2 h-2 rounded-full ${STANCE_DOT[stance]}`} aria-hidden />
                                            <Avatar holder={holder} size="md" />
                                            <span className="min-w-0 flex flex-col">
                                                <span className="text-sm font-semibold truncate">{holder.name}</span>
                                                <span className="text-xs text-theme-text-muted truncate">
                                                    {[holder.role, count > 0 ? t('remarksCount', { count }) : null].filter(Boolean).join(' · ')}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-3">
                        <span className={KICKER}>
                            {t('timeline')} · {debate.timeline.length}
                        </span>
                        <span className="text-xs text-theme-text-muted">{t('timelineHint')}</span>
                    </div>
                    <div className="rounded-2xl border border-theme-border bg-theme-surface overflow-hidden">
                        <div className="hidden md:grid grid-cols-[56px_200px_64px_minmax(0,1fr)_110px] gap-4 px-4 py-2.5">
                            <span className={KICKER}>{t('col.date')}</span>
                            <span className={KICKER}>{t('col.person')}</span>
                            <span className={KICKER}>{t('col.stance')}</span>
                            <span className={KICKER}>{t('col.summary')}</span>
                            <span className={KICKER}>{t('col.replyTo')}</span>
                        </div>
                        {debate.timeline.map((entry, i) => {
                            const holder = holderOf(entry.by);
                            const target = entry.replyTo && (entry.relation === 'reply' || entry.relation === 'quote') ? holderOf(entry.replyTo) : null;
                            return (
                                <button
                                    key={`${entry.url}-${i}`}
                                    type="button"
                                    onClick={() => openEntry(entry)}
                                    data-testid="timeline-row"
                                    className="w-full text-left grid grid-cols-[56px_minmax(0,1fr)] md:grid-cols-[56px_200px_64px_minmax(0,1fr)_110px] gap-x-4 gap-y-1 px-4 py-3.5 border-t border-theme-border hover:bg-theme-surface-hover transition-colors items-start"
                                >
                                    <span className="font-mono text-xs text-theme-text-muted tabular-nums pt-1">{shortDate(entry.date)}</span>
                                    <span className="flex items-center gap-2 min-w-0">
                                        <Avatar holder={holder} size="sm" />
                                        <span className="min-w-0 flex flex-col">
                                            <span className="text-sm font-semibold truncate">{holder.name}</span>
                                            {holder.role && <span className="text-xs text-theme-text-muted truncate">{holder.role}</span>}
                                        </span>
                                        {entry.stance && <span className={`md:hidden ml-auto text-xs ${STANCE_TEXT[entry.stance]}`}>{t(`stance.${entry.stance}`)}</span>}
                                    </span>
                                    <span className={`hidden md:block text-xs pt-1 ${entry.stance ? STANCE_TEXT[entry.stance] : 'text-theme-text-muted'}`}>
                                        {entry.stance ? t(`stance.${entry.stance}`) : ''}
                                    </span>
                                    <span className="col-span-2 md:col-span-1 text-sm leading-relaxed text-theme-text-secondary" style={CLAMP3}>
                                        {entry.quote}
                                    </span>
                                    <span className="hidden md:block text-xs text-theme-text-muted pt-1 truncate">{target ? target.name : ''}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </article>

            {modal && <TweetModal entries={modal.entries} index={modal.index} title={modal.title} holderOf={holderOf} onIndex={setIndex} onClose={closeModal} />}
        </div>
    );
};

export default DebateDetail;
