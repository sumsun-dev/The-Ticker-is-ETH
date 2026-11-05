import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import EipRef from '../components/eips/EipRef';
import NotFound from './NotFound';
import { FORKS, forkBySlug } from '../data/forks';
import { loadEips } from '../data/eipsData';
import { loadEthCalls, type CallRecord } from '../data/ethCallsData';
import { ROADMAP_ITEMS, STRAWMAP_FORKS } from '../data/roadmap';
import { FORK_STATUS_LABEL, forkEipStatuses, type ForkStatus } from '../utils/forks';
import { dotDate } from '../utils/calls';

const H2 = 'text-xl md:text-2xl font-bold mb-4';
const STAGES = ['범위 논의', '구현·테스트', '메인넷 일정 확정', '메인넷 적용'] as const;
const STATUS_COLOR: Record<ForkStatus, string> = { SFI: 'text-emerald-400', CFI: 'text-brand-accent', PFI: 'text-eth-purple', DFI: 'text-theme-text-muted' };

const ForkDetail: React.FC = () => {
    const { slug = '' } = useParams();
    const f = forkBySlug(slug);
    const [titles, setTitles] = useState<Map<number, string>>(new Map());
    const [calls, setCalls] = useState<CallRecord[]>([]);
    usePageMeta({ title: f ? `${f.name} 하드포크` : '하드포크', description: f?.summary ?? '', canonical: `/forks/${slug}` });

    useEffect(() => {
        loadEips().then((x) => setTitles(new Map(x.eips.map((e) => [e.number, e.titleKo]))));
        loadEthCalls().then((x) => setCalls(x.calls));
    }, []);

    const statuses = useMemo(() => (f && !f.date ? forkEipStatuses(calls, f) : []), [calls, f]);
    if (!f) return <NotFound />;

    const known = new Set(titles.keys());
    const idx = FORKS.indexOf(f);
    const [newer, older] = [FORKS[idx - 1], FORKS[idx + 1]];
    const mapCol = STRAWMAP_FORKS.findIndex((x) => 'slug' in x && x.slug === f.slug);
    const roadmap = mapCol < 0 ? [] : ROADMAP_ITEMS.filter((it) => it.fork === mapCol);
    const stage = f.date ? STAGES.length - 1 : STAGES.indexOf(f.stage ?? '범위 논의');
    const note = new Map(f.eips.map((x) => [x.number, x.note]));
    const rows = f.date ? f.eips.map((x) => ({ number: x.number, status: null as ForkStatus | null, callId: '' })) : statuses;

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <div className="max-w-4xl mx-auto break-keep">
                <nav aria-label="위치" className="text-sm text-theme-text-muted flex gap-2 mb-6">
                    <Link to="/forks" className="hover:text-theme-text">
                        하드포크
                    </Link>
                    <span aria-hidden>/</span>
                    <span>{f.name}</span>
                </nav>

                <header className="mb-10 flex flex-col gap-4">
                    <p className="text-sm text-theme-text-muted">
                        {[f.alias, f.date ? `메인넷 ${dotDate(f.date)}` : f.target].filter(Boolean).join(' · ')}
                        {f.meta && (
                            <>
                                {' · '}
                                <EipRef n={f.meta} known={known} className="text-brand-accent hover:underline">
                                    메타 EIP-{f.meta}
                                </EipRef>
                            </>
                        )}
                    </p>
                    <h1 className="text-4xl md:text-5xl font-bold">{f.name}</h1>
                    <p className="text-lg leading-relaxed text-theme-text-secondary">{f.summary}</p>
                    {!f.date && (
                        <ol aria-label="진행 단계" className="mt-2 grid grid-cols-4 gap-1.5">
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
                            헤드라이너
                        </h2>
                        <ul className="grid gap-3 sm:grid-cols-2">
                            {f.headliners.map((h) => (
                                <li key={h.number} className="rounded-xl border border-brand-primary bg-brand-primary/10 p-5 flex flex-col gap-2">
                                    <span className="font-bold">{titles.get(h.number) ?? `EIP-${h.number}`}</span>
                                    <span className="text-sm leading-relaxed text-theme-text-muted">{h.note}</span>
                                    <EipRef n={h.number} known={known} className="text-sm text-brand-accent hover:underline">
                                        EIP-{h.number} {known.has(h.number) ? '해설 보기' : '원문'}
                                    </EipRef>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {rows.length > 0 && (
                    <section aria-labelledby="fd-eips" className="border-t border-theme-border py-8">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                            <h2 id="fd-eips" className="text-xl md:text-2xl font-bold">
                                {f.date ? '주요 EIP' : '들어가는 EIP'}
                            </h2>
                            {!f.date && <span className="text-xs text-theme-text-muted">메타 EIP와 코어 개발자 콜 결정 기준</span>}
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
                            Strawmap에서 이 포크 칸
                        </h2>
                        <p className="flex flex-wrap gap-2">
                            {roadmap.map((it) => (
                                <span key={it.en} className={`rounded-full px-3 py-1 text-sm ${it.kind === 'headliner' ? 'bg-brand-primary text-white' : 'bg-theme-surface text-theme-text-muted'}`}>
                                    {it.name}
                                </span>
                            ))}
                        </p>
                        <Link to="/roadmap" className="mt-4 inline-block text-sm text-brand-accent hover:underline">
                            로드맵 전체 보기
                        </Link>
                    </section>
                )}

                <nav aria-label="앞뒤 포크" className="border-t border-theme-border pt-8 grid grid-cols-2 gap-3">
                    {older ? (
                        <Link to={`/forks/${older.slug}`} className="rounded-xl border border-theme-border bg-theme-surface p-4 hover:border-brand-accent">
                            <span className="block text-xs text-theme-text-muted">이전</span>
                            <span className="font-bold">{older.name}</span>
                        </Link>
                    ) : (
                        <span />
                    )}
                    {newer && (
                        <Link to={`/forks/${newer.slug}`} className="rounded-xl border border-theme-border bg-theme-surface p-4 text-right hover:border-brand-accent">
                            <span className="block text-xs text-theme-text-muted">다음</span>
                            <span className="font-bold">{newer.name}</span>
                        </Link>
                    )}
                </nav>
            </div>
        </div>
    );
};

export default ForkDetail;
