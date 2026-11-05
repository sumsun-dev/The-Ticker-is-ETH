import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import EipRef from '../components/eips/EipRef';
import { loadEips } from '../data/eipsData';
import { LAYERS, NORTH_STARS, ROADMAP_ITEMS, STRAWMAP_FORKS, STRAWMAP_UPDATED, STRAWMAP_URL, THROUGHLINES, roadmapGrid, type RoadmapItem } from '../data/roadmap';
import { dotDate } from '../utils/calls';

const H2 = 'text-2xl font-bold';
const LAYER_TEXT: Record<string, string> = { cl: 'text-orange-300', dl: 'text-emerald-300', el: 'text-sky-300' };
const ITEM_STYLE: Record<RoadmapItem['kind'], string> = {
    headliner: 'bg-brand-primary text-white font-semibold border-brand-primary',
    onchain: 'bg-theme-surface text-theme-text border-theme-border',
    offchain: 'border-dashed border-theme-border text-theme-text-muted',
};
const DESCRIPTION = '이더리움 재단 프로토콜 팀의 Strawmap을 한국어로 옮긴 로드맵. 2029년까지 하드포크마다 들어갈 업그레이드와 다섯 가지 목표를 한눈에 봅니다.';

const Item: React.FC<{ it: RoadmapItem; known: ReadonlySet<number> }> = ({ it, known }) => {
    const cls = `block rounded-lg border px-2.5 py-2 text-xs leading-snug ${ITEM_STYLE[it.kind]}`;
    const body = (
        <>
            {it.name}
            {it.uncertain && <span className="ml-1 font-bold text-amber-400" aria-label="실현 여부 불확실">?</span>}
        </>
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
    usePageMeta({ title: '로드맵', description: DESCRIPTION, canonical: '/roadmap' });
    useEffect(() => {
        loadEips().then((f) => setKnown(new Set(f.eips.map((e) => e.number))));
    }, []);
    const grid = useMemo(() => roadmapGrid(), []);
    const linked = ROADMAP_ITEMS.filter((it) => it.eips?.length);

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <div className="max-w-6xl mx-auto break-keep">
                <header className="mb-12 max-w-3xl">
                    <p className="text-sm font-semibold text-brand-accent mb-3">이더리움 로드맵</p>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">2029년까지, 이더리움은 어디로 가나</h1>
                    <p className="text-theme-text-muted text-base md:text-lg leading-relaxed">
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
                    <p className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-3 text-sm leading-relaxed text-amber-100">
                        Strawmap은 공식 계획이 아니라 토론용 초안입니다(strawman + roadmap). 연구자들 사이에서도 의견이 갈리고, 시점은 크게 앞당겨지거나 늦어질 수 있습니다.
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
                                                        <Item key={it.en} it={it} known={known} />
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

                <section aria-labelledby="rm-eips" className="border-t border-theme-border pt-10">
                    <h2 id="rm-eips" className={`${H2} mb-2`}>
                        EIP로 이어지는 업그레이드
                    </h2>
                    <p className="text-theme-text-muted mb-6">지도 칸 가운데 EIP가 있는 것입니다. 해설이 있으면 해설로, 없으면 원문으로 이어집니다.</p>
                    <ul className="grid gap-x-8 sm:grid-cols-2">
                        {linked.map((it) => (
                            <li key={it.en} className="py-3 border-b border-theme-border flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                <span className="font-semibold">
                                    {it.name}
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
