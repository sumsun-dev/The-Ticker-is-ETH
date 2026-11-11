import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import EipRef from '../components/eips/EipRef';
import NotFound from './NotFound';
import { loadEipList } from '../data/eipsData';
import { loadRoadmapExplainers, type RoadmapTopic as Topic } from '../data/roadmapExplainers';
import { pillarOf } from '../data/roadmapHistory';
import { LAYERS, ROADMAP_ITEMS, STRAWMAP_FORKS, STRAWMAP_URL, itemBySlug, itemSlug } from '../data/roadmap';
import { T } from '../utils/lang';

const H2 = 'text-xl md:text-2xl font-bold mb-4';
const KIND: Record<string, string> = { headliner: T('헤드라이너', 'Headliner'), onchain: T('프로토콜 변경', 'Protocol change'), offchain: T('프로토콜 밖 작업', 'Off-protocol work') };

const RoadmapTopic: React.FC = () => {
    const { slug = '' } = useParams();
    const it = itemBySlug(slug);
    const [topics, setTopics] = useState<Record<string, Topic> | null>(null);
    const [titles, setTitles] = useState<Map<number, string>>(new Map());
    const topic = topics ? (topics[slug] ?? null) : undefined;
    usePageMeta({ title: topic?.title ?? it?.name ?? T('로드맵', 'Roadmap'), description: topic?.summary ?? '', canonical: `/roadmap/${slug}` });

    useEffect(() => {
        loadRoadmapExplainers().then((f) => setTopics(f.topics));
        loadEipList().then((x) => setTitles(new Map(x.eips.map((e) => [e.number, e.titleKo]))));
    }, [slug]);

    if (!it || topic === null) return <NotFound />;
    if (!topic) return <div className="min-h-screen" />;

    const fork = STRAWMAP_FORKS[it.fork];
    const layer = it.layer === 'cross' ? T('여러 층', 'Cross-layer') : LAYERS.find((l) => l.key === it.layer)?.name;
    const known = new Set(titles.keys());
    const neighbors = ROADMAP_ITEMS.filter((x) => x !== it && x.fork === it.fork && topics?.[itemSlug(x)]);

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <article className="max-w-3xl mx-auto break-keep">
                <nav aria-label={T('위치', 'Breadcrumb')} className="text-sm text-theme-text-muted flex gap-2 mb-6">
                    <Link to="/roadmap" className="hover:text-theme-text">
                        {T('로드맵', 'Roadmap')}
                    </Link>
                    <span aria-hidden>/</span>
                    <span>{layer}{T(' 층', ' layer')}</span>
                </nav>

                <header className="mb-10 flex flex-col gap-4">
                    <p className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-theme-surface px-3 py-1 text-theme-text-muted">{layer}{T(' 층', ' layer')}</span>
                        {'slug' in fork ? (
                            <Link to={`/forks/${fork.slug}`} className="rounded-full bg-brand-primary px-3 py-1 text-white hover:opacity-90">
                                {fork.name} {KIND[it.kind]}
                            </Link>
                        ) : (
                            <span className="rounded-full bg-theme-surface px-3 py-1 text-theme-text-muted">
                                {fork.name} ({fork.when}) {KIND[it.kind]}
                            </span>
                        )}
                        {pillarOf(slug) && (
                            <a href={pillarOf(slug)!.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-eth-purple/15 px-3 py-1 text-eth-purple hover:opacity-80" title={T('비탈릭 로드맵의 갈래 (ECK 분류)', "Track in Vitalik's roadmap (ECK's grouping)")}>
                                The {pillarOf(slug)!.name}
                            </a>
                        )}
                        {it.uncertain && <span className="rounded-full bg-amber-400/10 px-3 py-1 text-amber-400">{T('실현 여부 불확실', 'Uncertain')}</span>}
                    </p>
                    <h1 className="text-3xl md:text-4xl font-bold leading-tight">{topic.title}</h1>
                    <p className="text-lg leading-relaxed text-theme-text-secondary">{topic.summary}</p>
                </header>

                <section aria-labelledby="rt-why" className="border-t border-theme-border py-8">
                    <h2 id="rt-why" className={H2}>
                        {T('왜 필요한가', 'Why it is needed')}
                    </h2>
                    <p className="leading-relaxed text-theme-text-secondary whitespace-pre-line">{topic.why}</p>
                </section>

                {topic.steps.length > 0 && (
                    <section aria-labelledby="rt-how" className="border-t border-theme-border py-8">
                        <h2 id="rt-how" className={H2}>
                            {T('어떻게 동작하나', 'How it works')}
                        </h2>
                        <ol className="flex flex-col gap-4">
                            {topic.steps.map((s, i) => (
                                <li key={s.title} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
                                    <span className="w-9 h-9 rounded-full bg-theme-surface text-brand-accent font-bold flex items-center justify-center">{i + 1}</span>
                                    <span className="flex flex-col gap-1">
                                        <span className="font-bold">{s.title}</span>
                                        <span className="text-sm leading-relaxed text-theme-text-muted">{s.body}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                {it.eips?.length ? (
                    <section aria-labelledby="rt-eips" className="border-t border-theme-border py-8">
                        <h2 id="rt-eips" className={H2}>
                            {T('관련 EIP', 'Related EIPs')}
                        </h2>
                        <ul className="flex flex-col gap-2">
                            {it.eips.map((n) => (
                                <li key={n}>
                                    <EipRef n={n} known={known} className="hover:underline">
                                        <span className="font-mono text-brand-accent">EIP-{n}</span> {titles.get(n) ?? ''}
                                    </EipRef>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}

                {neighbors.length > 0 && (
                    <section aria-labelledby="rt-near" className="border-t border-theme-border py-8">
                        <h2 id="rt-near" className={H2}>
                            {T(`${fork.name} 칸의 다른 항목`, `Other items in ${fork.name}`)}
                        </h2>
                        <p className="flex flex-wrap gap-2">
                            {neighbors.map((x) => (
                                <Link key={x.en} to={`/roadmap/${itemSlug(x)}`} className="rounded-full bg-theme-surface px-3 py-1 text-sm text-theme-text-muted hover:text-theme-text">
                                    {x.name}
                                </Link>
                            ))}
                        </p>
                    </section>
                )}

                <footer className="border-t border-theme-border pt-8 text-sm text-theme-text-muted flex flex-col gap-2">
                    <p>
                        {topic.basis === 'eip' ? T('연결된 EIP 원문과 코어 개발자 콜 기록을 바탕으로 썼습니다.', 'Written from the linked EIPs and core dev call records.') : T('연결된 EIP가 아직 없어, Strawmap의 위치와 공개된 연구 내용을 바탕으로 썼습니다.', 'No EIP is linked yet, so this is written from its place on the Strawmap and published research.')} {T('들어갈 포크는 Strawmap의 예상이며 바뀔 수 있습니다.', 'The target fork is the Strawmap estimate and may change.')}
                    </p>
                    <p className="flex flex-wrap gap-x-5">
                        <Link to="/roadmap" className="text-brand-accent hover:underline">
                            {T('로드맵 전체 보기', 'See the full roadmap')}
                        </Link>
                        <a href={STRAWMAP_URL} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                            {T('strawmap.org 원본', 'Original at strawmap.org')}
                        </a>
                    </p>
                </footer>
            </article>
        </div>
    );
};

export default RoadmapTopic;
