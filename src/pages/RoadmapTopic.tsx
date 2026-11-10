import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import EipRef from '../components/eips/EipRef';
import NotFound from './NotFound';
import { loadEipList } from '../data/eipsData';
import { loadRoadmapExplainers, type RoadmapTopic as Topic } from '../data/roadmapExplainers';
import { pillarOf } from '../data/roadmapHistory';
import { LAYERS, ROADMAP_ITEMS, STRAWMAP_FORKS, STRAWMAP_URL, itemBySlug, itemSlug } from '../data/roadmap';

const H2 = 'text-xl md:text-2xl font-bold mb-4';
const KIND: Record<string, string> = { headliner: '헤드라이너', onchain: '프로토콜 변경', offchain: '프로토콜 밖 작업' };

const RoadmapTopic: React.FC = () => {
    const { slug = '' } = useParams();
    const it = itemBySlug(slug);
    const [topics, setTopics] = useState<Record<string, Topic> | null>(null);
    const [titles, setTitles] = useState<Map<number, string>>(new Map());
    const topic = topics ? (topics[slug] ?? null) : undefined;
    usePageMeta({ title: topic?.title ?? it?.name ?? '로드맵', description: topic?.summary ?? '', canonical: `/roadmap/${slug}` });

    useEffect(() => {
        loadRoadmapExplainers().then((f) => setTopics(f.topics));
        loadEipList().then((x) => setTitles(new Map(x.eips.map((e) => [e.number, e.titleKo]))));
    }, [slug]);

    if (!it || topic === null) return <NotFound />;
    if (!topic) return <div className="min-h-screen" />;

    const fork = STRAWMAP_FORKS[it.fork];
    const layer = it.layer === 'cross' ? '여러 층' : LAYERS.find((l) => l.key === it.layer)?.name;
    const known = new Set(titles.keys());
    const neighbors = ROADMAP_ITEMS.filter((x) => x !== it && x.fork === it.fork && topics?.[itemSlug(x)]);

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <article className="max-w-3xl mx-auto break-keep">
                <nav aria-label="위치" className="text-sm text-theme-text-muted flex gap-2 mb-6">
                    <Link to="/roadmap" className="hover:text-theme-text">
                        로드맵
                    </Link>
                    <span aria-hidden>/</span>
                    <span>{layer} 층</span>
                </nav>

                <header className="mb-10 flex flex-col gap-4">
                    <p className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-theme-surface px-3 py-1 text-theme-text-muted">{layer} 층</span>
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
                            <a href={pillarOf(slug)!.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-eth-purple/15 px-3 py-1 text-eth-purple hover:opacity-80" title="비탈릭 로드맵의 갈래 (ECK 분류)">
                                The {pillarOf(slug)!.name}
                            </a>
                        )}
                        {it.uncertain && <span className="rounded-full bg-amber-400/10 px-3 py-1 text-amber-400">실현 여부 불확실</span>}
                    </p>
                    <h1 className="text-3xl md:text-4xl font-bold leading-tight">{topic.title}</h1>
                    <p className="text-lg leading-relaxed text-theme-text-secondary">{topic.summary}</p>
                </header>

                <section aria-labelledby="rt-why" className="border-t border-theme-border py-8">
                    <h2 id="rt-why" className={H2}>
                        왜 필요한가
                    </h2>
                    <p className="leading-relaxed text-theme-text-secondary whitespace-pre-line">{topic.why}</p>
                </section>

                {topic.steps.length > 0 && (
                    <section aria-labelledby="rt-how" className="border-t border-theme-border py-8">
                        <h2 id="rt-how" className={H2}>
                            어떻게 동작하나
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
                            관련 EIP
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
                            {fork.name} 칸의 다른 항목
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
                        {topic.basis === 'eip' ? '연결된 EIP 원문과 코어 개발자 콜 기록을 바탕으로 썼습니다.' : '연결된 EIP가 아직 없어, Strawmap의 위치와 공개된 연구 내용을 바탕으로 썼습니다.'} 들어갈 포크는 Strawmap의 예상이며 바뀔 수 있습니다.
                    </p>
                    <p className="flex flex-wrap gap-x-5">
                        <Link to="/roadmap" className="text-brand-accent hover:underline">
                            로드맵 전체 보기
                        </Link>
                        <a href={STRAWMAP_URL} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                            strawmap.org 원본
                        </a>
                    </p>
                </footer>
            </article>
        </div>
    );
};

export default RoadmapTopic;
