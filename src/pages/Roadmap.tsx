import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import EipRef from '../components/eips/EipRef';
import { loadEips } from '../data/eipsData';
import { loadRoadmapExplainers } from '../data/roadmapExplainers';
import { HISTORY_ERAS, HISTORY_KIND, ITEM_PILLAR, PILLARS, ROADMAP_HISTORY, type HistoryKind } from '../data/roadmapHistory';
import { LAYERS, NORTH_STARS, ROADMAP_ITEMS, STRAWMAP_FORKS, STRAWMAP_UPDATED, STRAWMAP_URL, THROUGHLINES, itemSlug, roadmapGrid, type RoadmapItem } from '../data/roadmap';
import { dotDate } from '../utils/calls';

const H2 = 'text-2xl font-bold';
const LAYER_TEXT: Record<string, string> = { cl: 'text-orange-300', dl: 'text-emerald-300', el: 'text-sky-300' };
const ITEM_STYLE: Record<RoadmapItem['kind'], string> = {
    headliner: 'bg-brand-primary text-white font-semibold border-brand-primary',
    onchain: 'bg-theme-surface text-theme-text border-theme-border',
    offchain: 'border-dashed border-theme-border text-theme-text-muted',
};
const KIND_STYLE: Record<HistoryKind, string> = {
    vitalik: 'bg-eth-purple/15 text-eth-purple',
    drake: 'bg-emerald-400/10 text-emerald-300',
    ef: 'bg-brand-primary/15 text-brand-accent',
    fork: 'bg-amber-400/10 text-amber-300',
};
/** 연대표는 앞 다섯 줄만 펼쳐 두고 나머지는 접는다 */
const HISTORY_OPEN = 5;
const isInternal = (url: string) => url.startsWith('/');

const DESCRIPTION = '이더리움 재단 프로토콜 팀의 Strawmap을 한국어로 옮긴 로드맵. 2029년까지 하드포크마다 들어갈 업그레이드와 다섯 가지 목표를 한눈에 봅니다.';

const Item: React.FC<{ it: RoadmapItem; known: ReadonlySet<number>; topics: ReadonlySet<string> }> = ({ it, known, topics }) => {
    const cls = `block rounded-lg border px-2.5 py-2 text-xs leading-snug ${ITEM_STYLE[it.kind]}`;
    const body = (
        <>
            {it.name}
            {it.uncertain && <span className="ml-1 font-bold text-amber-400" aria-label="실현 여부 불확실">?</span>}
        </>
    );
    if (topics.has(itemSlug(it)))
        return (
            <Link to={`/roadmap/${itemSlug(it)}`} className={`${cls} hover:border-brand-accent`}>
                {body}
            </Link>
        );
    return it.eips?.length ? (
        <EipRef n={it.eips[0]} known={known} className={`${cls} hover:border-brand-accent`}>
            {body}
        </EipRef>
    ) : (
        <span className={cls} title={it.en}>
            {body}
        </span>
    );
};

const Roadmap: React.FC = () => {
    const [known, setKnown] = useState<ReadonlySet<number>>(new Set());
    const [topics, setTopics] = useState<ReadonlySet<string>>(new Set());
    usePageMeta({ title: '로드맵', description: DESCRIPTION, canonical: '/roadmap' });
    useEffect(() => {
        loadEips().then((f) => setKnown(new Set(f.eips.map((e) => e.number))));
        loadRoadmapExplainers().then((f) => setTopics(new Set(Object.keys(f.topics))));
    }, []);
    const grid = useMemo(() => roadmapGrid(), []);
    const linked = ROADMAP_ITEMS.filter((it) => it.eips?.length);

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <div className="max-w-6xl mx-auto break-keep">
                <header className="mb-12 max-w-3xl">
                    <p className="text-sm font-semibold text-brand-accent mb-3">이더리움 로드맵</p>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">2029년까지, 이더리움은 어디로 가나</h1>
                    <p className="text-theme-text-muted text-base md:text-lg leading-relaxed text-balance">
                        이더리움 재단 프로토콜 팀이 그린 Strawmap을 한국어로 옮겼습니다. 앞으로 일곱 번 남짓의 하드포크에 어떤 업그레이드가 들어갈지, 그 끝에 무엇을 노리는지를 한 장에 담은 지도입니다.
                    </p>
                    <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-theme-text-muted">
                        <span>원본 갱신 {dotDate(STRAWMAP_UPDATED)}</span>
                        <a href={STRAWMAP_URL} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                            strawmap.org 원본
                        </a>
                        <Link to="/forks" className="text-brand-accent hover:underline">
                            지난 하드포크 보기
                        </Link>
                    </p>
                    <p className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-3 text-sm leading-relaxed text-amber-100 text-balance">
                        <span className="block">Strawmap은 공식 계획이 아니라 토론용 초안입니다(strawman + roadmap).</span>
                        <span className="block">연구자들 사이에서도 의견이 갈리고, 시점은 크게 앞당겨지거나 늦어질 수 있습니다.</span>
                    </p>
                </header>

                <section aria-labelledby="rm-stars" className="border-t border-theme-border py-10">
                    <h2 id="rm-stars" className={`${H2} mb-2`}>
                        다섯 가지 목표
                    </h2>
                    <p className="text-theme-text-muted mb-6">모든 업그레이드는 결국 이 다섯 가지 중 하나를 향합니다.</p>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {NORTH_STARS.map((s) => (
                            <li key={s.name} className="rounded-xl border border-theme-border bg-theme-surface p-5 flex flex-col gap-2">
                                <span className="text-xs font-semibold text-theme-text-muted">{s.layer}</span>
                                <span className="text-lg font-bold">{s.name}</span>
                                <span className="text-xl font-bold text-brand-accent">{s.metric}</span>
                                <span className="text-sm leading-relaxed text-theme-text-muted">{s.body}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section aria-labelledby="rm-map" className="border-t border-theme-border py-10">
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                        <div>
                            <h2 id="rm-map" className={H2}>
                                포크별 지도
                            </h2>
                            <p className="mt-1 text-theme-text-muted">왼쪽에서 오른쪽으로 시간이 흐릅니다. 파란 칸이 그 포크의 대표 업그레이드(헤드라이너)입니다.</p>
                        </div>
                        <ul className="flex flex-wrap gap-3 text-xs text-theme-text-muted" aria-label="범례">
                            <li className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-primary" aria-hidden />헤드라이너</li>
                            <li className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-theme-border bg-theme-surface" aria-hidden />프로토콜 변경</li>
                            <li className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-dashed border-theme-border" aria-hidden />프로토콜 밖 작업</li>
                            <li className="flex items-center gap-1.5"><span className="font-bold text-amber-400" aria-hidden>?</span>실현 여부 불확실</li>
                        </ul>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-theme-border">
                        <table className="w-full min-w-[1040px] table-fixed border-collapse text-sm">
                            <thead>
                                <tr className="bg-theme-surface">
                                    <th scope="col" className="w-20 p-3 text-left text-xs font-medium text-theme-text-muted">층</th>
                                    {STRAWMAP_FORKS.map((f) => (
                                        <th key={f.name} scope="col" className="p-3 text-left align-bottom">
                                            {'slug' in f ? (
                                                <Link to={`/forks/${f.slug}`} className="block font-bold hover:text-brand-accent">
                                                    {f.name}
                                                </Link>
                                            ) : (
                                                <span className="block font-bold">{f.name}</span>
                                            )}
                                            <span className="text-xs font-normal text-theme-text-muted">{f.when}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {LAYERS.map((l) => (
                                    <tr key={l.key} className="border-t border-theme-border">
                                        <th scope="row" className={`p-3 text-left align-top text-xs font-bold ${LAYER_TEXT[l.key]}`}>
                                            {l.name}
                                        </th>
                                        {grid[l.key as 'cl' | 'dl' | 'el'].map((cell, i) => (
                                            <td key={i} className="p-1.5 align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    {cell.map((it) => (
                                                        <Item key={it.en} it={it} known={known} topics={topics} />
                                                    ))}
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-3 text-xs text-theme-text-muted">
                        포크를 넘어 이어지는 흐름: {THROUGHLINES.map((t) => `${t.name}(${STRAWMAP_FORKS[t.from].name}~${STRAWMAP_FORKS[t.to].name})`).join(', ')}. 시점은 Strawmap 상단 표기 기준입니다.
                    </p>
                </section>

                <section aria-labelledby="rm-history" className="border-t border-theme-border py-10">
                    <h2 id="rm-history" className={`${H2} mb-2`}>
                        로드맵이 걸어온 길
                    </h2>
                    <p className="text-theme-text-muted mb-6 max-w-3xl text-balance">
                        Strawmap은 갑자기 나온 지도가 아닙니다. 비탈릭이 2021년부터 그려 온 갈래 그림, 저스틴 드레이크의 <span className="whitespace-nowrap">Beam Chain</span>과 <span className="whitespace-nowrap">Lean Ethereum</span>을 거쳐 지금 모양이 됐습니다.
                    </p>
                    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-10">
                        {HISTORY_ERAS.map((e, i) => (
                            <li key={e.name} className="rounded-xl border border-theme-border bg-theme-surface p-5 flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-theme-text-muted">
                                    {i + 1}. {e.years}
                                </span>
                                <span className="font-bold">{e.name}</span>
                                <span className="text-sm leading-relaxed text-theme-text-muted">{e.body}</span>
                            </li>
                        ))}
                    </ol>
                    {(() => {
                        const row = (h: (typeof ROADMAP_HISTORY)[number]) => (
                            <li key={`${h.date}-${h.title}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[7rem_minmax(0,1fr)] gap-4 py-5 border-b border-theme-border">
                                <span className="text-sm text-theme-text-muted tabular-nums">{dotDate(h.date)}</span>
                                <div className="flex flex-col gap-2">
                                    <p className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${KIND_STYLE[h.kind]}`}>{HISTORY_KIND[h.kind]}</span>
                                        {isInternal(h.url) ? (
                                            <Link to={h.url} className="font-bold hover:text-brand-accent">
                                                {h.title}
                                            </Link>
                                        ) : (
                                            <a href={h.url} target="_blank" rel="noopener noreferrer" className="font-bold hover:text-brand-accent">
                                                {h.title}
                                            </a>
                                        )}
                                    </p>
                                    <ul className="flex flex-col gap-1 text-sm leading-relaxed text-theme-text-secondary">
                                        {h.changes.map((c) => (
                                            <li key={c}>{c}</li>
                                        ))}
                                    </ul>
                                </div>
                            </li>
                        );
                        const rest = ROADMAP_HISTORY.slice(HISTORY_OPEN);
                        return (
                            <>
                                <ol className="flex flex-col">{ROADMAP_HISTORY.slice(0, HISTORY_OPEN).map(row)}</ol>
                                {rest.length > 0 && (
                                    <details className="group">
                                        <summary className="cursor-pointer list-none py-4 text-sm font-semibold text-brand-accent hover:underline">
                                            <span className="group-open:hidden">나머지 {rest.length}개 펼치기 ({dotDate(rest[0].date)}부터 지금까지)</span>
                                            <span className="hidden group-open:inline">접기</span>
                                        </summary>
                                        <ol className="flex flex-col">{rest.map(row)}</ol>
                                    </details>
                                )}
                            </>
                        );
                    })()}
                </section>

                <section aria-labelledby="rm-pillars" className="border-t border-theme-border py-10">
                    <h2 id="rm-pillars" className={`${H2} mb-2`}>
                        비탈릭의 여섯 갈래로 다시 보기
                    </h2>
                    <p className="text-theme-text-muted mb-2 max-w-3xl text-balance">
                        Strawmap 항목을 비탈릭의 2024년 연재 기준 여섯 갈래로 나눴습니다. 같은 일이 예전에 어떤 이름으로 불렸는지 이어 볼 수 있습니다. 갈래 분류는 Strawmap 원본에 없는 것으로 ECK가 붙였습니다.
                    </p>
                    <p className="text-xs text-theme-text-muted mb-6">
                        그림: 비탈릭 부테린, 2023년판 로드맵 (Possible futures 연재 수록, WTFPL). 누르면 크게 봅니다.
                    </p>
                    <ul className="grid gap-4">
                        {PILLARS.map((p) => {
                            const items = ROADMAP_ITEMS.filter((it) => ITEM_PILLAR[itemSlug(it)] === p.key);
                            return (
                                <li key={p.key} className="rounded-xl border border-theme-border bg-theme-surface p-5 flex flex-col gap-3">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="text-xl font-bold">The {p.name}</span>
                                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-accent hover:underline">
                                            원문
                                        </a>
                                    </div>
                                    <a href={`/images/roadmap/pillar-${p.key}.png`} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-white p-2 overflow-x-auto">
                                        <img
                                            src={`/images/roadmap/pillar-${p.key}.png`}
                                            alt={`The ${p.name} 로드맵 그림. 비탈릭 부테린이 그린 2023년판으로, 이 갈래의 목표와 단계별 항목을 화살표로 잇습니다.`}
                                            loading="lazy"
                                            className="block w-full min-w-[36rem] h-auto"
                                        />
                                    </a>
                                    <p className="text-sm leading-relaxed">{p.goal}</p>
                                    <p className="text-sm leading-relaxed text-theme-text-muted">{p.shift}</p>
                                    <p className="flex flex-wrap gap-1.5">
                                        {items.map((it) =>
                                            topics.has(itemSlug(it)) ? (
                                                <Link key={it.en} to={`/roadmap/${itemSlug(it)}`} className="rounded-full bg-theme-bg px-2.5 py-1 text-xs hover:text-brand-accent">
                                                    {it.name}
                                                </Link>
                                            ) : (
                                                <span key={it.en} className="rounded-full bg-theme-bg px-2.5 py-1 text-xs text-theme-text-muted">
                                                    {it.name}
                                                </span>
                                            ),
                                        )}
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <section aria-labelledby="rm-eips" className="border-t border-theme-border pt-10">
                    <h2 id="rm-eips" className={`${H2} mb-2`}>
                        EIP로 이어지는 업그레이드
                    </h2>
                    <p className="text-theme-text-muted mb-6">지도 칸 가운데 EIP가 있는 것입니다. 해설이 있으면 해설로, 없으면 원문으로 이어집니다.</p>
                    <ul className="grid gap-x-8 sm:grid-cols-2">
                        {linked.map((it) => (
                            <li key={it.en} className="py-3 border-b border-theme-border flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                <span className="font-semibold">
                                    {topics.has(itemSlug(it)) ? (
                                        <Link to={`/roadmap/${itemSlug(it)}`} className="hover:text-brand-accent">
                                            {it.name}
                                        </Link>
                                    ) : (
                                        it.name
                                    )}
                                    <span className="ml-2 text-xs font-normal text-theme-text-muted">{STRAWMAP_FORKS[it.fork].name}</span>
                                </span>
                                <span className="flex flex-wrap gap-x-3 text-sm">
                                    {it.eips!.map((n) => (
                                        <EipRef key={n} n={n} known={known} className="font-mono text-brand-accent hover:underline" />
                                    ))}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
};

export default Roadmap;
