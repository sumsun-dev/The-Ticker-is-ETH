import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import { LT, T } from '../utils/lang';
import EipRef from '../components/eips/EipRef';
import NotFound from './NotFound';
import { FORKS, forkBySlug } from '../data/forks';
import { loadEipList } from '../data/eipsData';
import { loadRoadmapExplainers, type ForkImpact } from '../data/roadmapExplainers';
import { loadEthCalls, type CallRecord } from '../data/ethCallsData';
import { ROADMAP_ITEMS, STRAWMAP_FORKS, itemSlug } from '../data/roadmap';
import { FORK_STATUS_LABEL, forkEipStatuses, type ForkStatus } from '../utils/forks';
import { dotDate } from '../utils/calls';

const H2 = 'text-xl md:text-2xl font-bold mb-4';
// 포크 데이터의 stage 와 같은 용어 사전(_seed.json)으로 옮겨야 영어판에서도 단계가 맞는다
const STAGES = LT(['범위 논의', '구현·테스트', '메인넷 일정 확정', '메인넷 적용'] as const);
const STATUS_COLOR: Record<ForkStatus, string> = { SFI: 'text-emerald-400', CFI: 'text-brand-accent', PFI: 'text-eth-purple', DFI: 'text-theme-text-muted' };

const ForkDetail: React.FC = () => {
    const { slug = '' } = useParams();
    const f = forkBySlug(slug);
    const [titles, setTitles] = useState<Map<number, string>>(new Map());
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [impact, setImpact] = useState<ForkImpact | null>(null);
    const [topics, setTopics] = useState<ReadonlySet<string>>(new Set());
    usePageMeta({ title: f ? T(`${f.name} 하드포크`, `${f.name} hard fork`) : T('하드포크', 'Hard Forks'), description: f?.summary ?? '', canonical: `/forks/${slug}` });

    useEffect(() => {
        loadEipList().then((x) => setTitles(new Map(x.eips.map((e) => [e.number, e.titleKo]))));
        loadEthCalls().then((x) => setCalls(x.calls));
    }, []);
    useEffect(() => {
        loadRoadmapExplainers().then((x) => {
            setImpact(x.forks[slug] ?? null);
            setTopics(new Set(Object.keys(x.topics)));
        });
    }, [slug]);

    const statuses = useMemo(() => (f && !f.date ? forkEipStatuses(calls, f) : []), [calls, f]);
    if (!f) return <NotFound />;

    const known = new Set(titles.keys());
    const idx = FORKS.indexOf(f);
    const [newer, older] = [FORKS[idx - 1], FORKS[idx + 1]];
    const mapCol = STRAWMAP_FORKS.findIndex((x) => 'slug' in x && x.slug === f.slug);
    const roadmap = mapCol < 0 ? [] : ROADMAP_ITEMS.filter((it) => it.fork === mapCol);
    const stage = f.date ? STAGES.length - 1 : Math.max(0, (STAGES as readonly string[]).indexOf(f.stage ?? STAGES[0]));
    const note = new Map(f.eips.map((x) => [x.number, x.note]));
    const rows = f.date ? f.eips.map((x) => ({ number: x.number, status: null as ForkStatus | null, callId: '' })) : statuses;

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <div className="max-w-4xl mx-auto break-keep">
                <nav aria-label={T('위치', 'Breadcrumb')} className="text-sm text-theme-text-muted flex gap-2 mb-6">
                    <Link to="/forks" className="hover:text-theme-text">
                        {T('하드포크', 'Hard Forks')}
                    </Link>
                    <span aria-hidden>/</span>
                    <span>{f.name}</span>
                </nav>

                <header className="mb-10 flex flex-col gap-4">
                    <p className="text-sm text-theme-text-muted">
                        {[f.alias, f.date ? `${T('메인넷', 'Mainnet')} ${dotDate(f.date)}` : f.target].filter(Boolean).join(' · ')}
                        {f.meta && (
                            <>
                                {' · '}
                                <EipRef n={f.meta} known={known} className="text-brand-accent hover:underline">
                                    {T('메타', 'Meta')} EIP-{f.meta}
                                </EipRef>
                            </>
                        )}
                    </p>
                    <h1 className="text-4xl md:text-5xl font-bold">{f.name}</h1>
                    <p className="text-lg leading-relaxed text-theme-text-secondary">{f.summary}</p>
                    {!f.date && (
                        <ol aria-label={T('진행 단계', 'Progress')} className="mt-2 grid grid-cols-4 gap-1.5">
                            {STAGES.map((s, i) => (
                                <li key={s} aria-current={i === stage ? 'step' : undefined} className="flex flex-col gap-1.5">
                                    <span className={`h-1.5 rounded-full ${i <= stage ? 'bg-brand-primary' : 'bg-theme-border'}`} />
                                    <span className={`text-xs ${i === stage ? 'font-bold text-theme-text' : 'text-theme-text-muted'}`}>{s}</span>
                                </li>
                            ))}
                        </ol>
                    )}
                </header>

                {f.headliners && (
                    <section aria-labelledby="fd-head" className="border-t border-theme-border py-8">
                        <h2 id="fd-head" className={H2}>
                            {T('헤드라이너', 'Headliners')}
                        </h2>
                        <ul className="grid gap-3 sm:grid-cols-2">
                            {f.headliners.map((h) => (
                                <li key={h.number} className="rounded-xl border border-brand-primary bg-brand-primary/10 p-5 flex flex-col gap-2">
                                    <span className="font-bold">{titles.get(h.number) ?? `EIP-${h.number}`}</span>
                                    <span className="text-sm leading-relaxed text-theme-text-muted">{h.note}</span>
                                    <EipRef n={h.number} known={known} className="text-sm text-brand-accent hover:underline">
                                        EIP-{h.number} {known.has(h.number) ? T('해설 보기', 'explainer') : T('원문', 'original')}
                                    </EipRef>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {impact && (
                    <section aria-labelledby="fd-you" className="border-t border-theme-border py-8">
                        <h2 id="fd-you" className={H2}>
                            {f.date ? T('무엇이 달라졌나', 'What changed') : T('나에게 달라지는 것', 'What changes for you')}
                        </h2>
                        <dl className="flex flex-col">
                            {impact.impact.map((x) => (
                                <div key={x.who} className="grid sm:grid-cols-[8rem_minmax(0,1fr)] gap-1 sm:gap-4 py-3 border-b border-theme-border">
                                    <dt className="font-bold text-sm">{x.who}</dt>
                                    <dd className="text-sm leading-relaxed text-theme-text-secondary">{x.text}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                )}

                {rows.length > 0 && (
                    <section aria-labelledby="fd-eips" className="border-t border-theme-border py-8">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                            <h2 id="fd-eips" className="text-xl md:text-2xl font-bold">
                                {f.date ? T('주요 EIP', 'Key EIPs') : T('들어가는 EIP', 'EIPs included')}
                            </h2>
                            {!f.date && <span className="text-xs text-theme-text-muted">{T('메타 EIP와 코어 개발자 콜 결정 기준', 'Per the meta EIP and core dev call decisions')}</span>}
                        </div>
                        <ul>
                            {rows.map((r) => (
                                <li key={r.number} className="py-3 border-b border-theme-border grid grid-cols-[6.5rem_minmax(0,1fr)_auto] gap-3 items-baseline">
                                    <EipRef n={r.number} known={known} className="font-mono text-sm text-brand-accent hover:underline" />
                                    <span className="text-sm">{titles.get(r.number) ?? note.get(r.number) ?? ''}</span>
                                    {r.status ? (
                                        r.callId ? (
                                            <Link to={`/calls/${r.callId}`} className={`text-xs font-semibold hover:underline ${STATUS_COLOR[r.status]}`}>
                                                {FORK_STATUS_LABEL[r.status]}
                                            </Link>
                                        ) : (
                                            <span className={`text-xs font-semibold ${STATUS_COLOR[r.status]}`}>{FORK_STATUS_LABEL[r.status]}</span>
                                        )
                                    ) : (
                                        <span />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {roadmap.length > 0 && (
                    <section aria-labelledby="fd-map" className="border-t border-theme-border py-8">
                        <h2 id="fd-map" className={H2}>
                            {T('Strawmap에서 이 포크 칸', 'This fork on the Strawmap')}
                        </h2>
                        <p className="flex flex-wrap gap-2">
                            {roadmap.map((it) => {
                                const cls = `rounded-full px-3 py-1 text-sm ${it.kind === 'headliner' ? 'bg-brand-primary text-white' : 'bg-theme-surface text-theme-text-muted'}`;
                                return topics.has(itemSlug(it)) ? (
                                    <Link key={it.en} to={`/roadmap/${itemSlug(it)}`} className={`${cls} hover:opacity-80`}>
                                        {it.name}
                                    </Link>
                                ) : (
                                    <span key={it.en} className={cls}>
                                        {it.name}
                                    </span>
                                );
                            })}
                        </p>
                        <Link to="/roadmap" className="mt-4 inline-block text-sm text-brand-accent hover:underline">
                            {T('로드맵 전체 보기', 'See the full roadmap')}
                        </Link>
                    </section>
                )}

                <nav aria-label={T('앞뒤 포크', 'Adjacent forks')} className="border-t border-theme-border pt-8 grid grid-cols-2 gap-3">
                    {older ? (
                        <Link to={`/forks/${older.slug}`} className="rounded-xl border border-theme-border bg-theme-surface p-4 hover:border-brand-accent">
                            <span className="block text-xs text-theme-text-muted">{T('이전', 'Previous')}</span>
                            <span className="font-bold">{older.name}</span>
                        </Link>
                    ) : (
                        <span />
                    )}
                    {newer && (
                        <Link to={`/forks/${newer.slug}`} className="rounded-xl border border-theme-border bg-theme-surface p-4 text-right hover:border-brand-accent">
                            <span className="block text-xs text-theme-text-muted">{T('다음', 'Next')}</span>
                            <span className="font-bold">{newer.name}</span>
                        </Link>
                    )}
                </nav>
            </div>
        </div>
    );
};

export default ForkDetail;
