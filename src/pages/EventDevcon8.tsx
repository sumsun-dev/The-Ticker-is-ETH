import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ExternalLink, FileText, ListOrdered, PlayCircle } from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';
import {
    DEVCON8_IMAGES,
    DEVCON8_LINKS,
    DEVCON8_MORE,
    DEVCON8_NEWS,
    DEVCON8_TALKS,
    TOPIC_LABEL,
    type Devcon8Talk,
    type Devcon8Topic,
    ytThumb,
} from '../data/devcon8Data';

// 한국어 스크립트: src/data/devcon8-transcripts/<발표 id>.md 가 있으면 버튼이 생긴다 (누를 때 불러옴). 넣는 방법은 docs/devcon8-transcripts.md
const TRANSCRIPTS = import.meta.glob('../data/devcon8-transcripts/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const transcriptLoader = (id: string) => TRANSCRIPTS[`../data/devcon8-transcripts/${id}.md`];

const TOPICS = [...new Set(DEVCON8_TALKS.map((t) => t.topic))];

const HIGHLIGHTS = [
    { label: '다음 Devcon', value: '2027 리스본', note: '10월 11일~13일, 2년 연속 개최' },
    { label: '포스트퀀텀 전환', value: 'Mission 2028', note: '2028년 12월 완료를 목표로 제안' },
    { label: '글램스테르담', value: '추가 연기', note: '가스 재가격 EIP 문제로 새 날짜 미정' },
    { label: '슬롯 시간', value: '12초 → 8초', note: '2027년 10초부터 단계적으로' },
];

const SectionHead: React.FC<{ id: string; title: string }> = ({ id, title }) => (
    <div className="mb-5 flex items-center gap-4">
        <h2 id={id} className="whitespace-nowrap text-[22px] font-bold text-theme-text">
            {title}
        </h2>
        <div className="h-px flex-1 bg-white/10" />
    </div>
);

const TalkRow: React.FC<{ talk: Devcon8Talk }> = ({ talk }) => {
    const [panel, setPanel] = useState<'flow' | 'script' | null>(null);
    const [script, setScript] = useState<string | null>(null);
    const loadScript = transcriptLoader(talk.id);

    const toggle = (next: 'flow' | 'script') => {
        setPanel((cur) => (cur === next ? null : next));
        if (next === 'script' && script === null && loadScript) {
            loadScript()
                .then(setScript)
                .catch(() => setScript(''));
        }
    };

    return (
    <li className="grid gap-4 border-b border-theme-border-secondary py-6 sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-6">
        <a
            href={talk.videos[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block self-start overflow-hidden rounded-xl border border-theme-border-secondary bg-white/5"
            aria-label={`${talk.title} 영상 보기`}
        >
            <img src={ytThumb(talk.youtubeId)} alt="" loading="lazy" className="block aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-90 transition-opacity group-hover:bg-black/10">
                <PlayCircle size={40} className="text-white drop-shadow-lg" />
            </span>
        </a>
        <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-brand-accent/40 px-2 text-[11px] font-semibold tracking-wide text-brand-accent">{TOPIC_LABEL[talk.topic]}</span>
                <span className="text-[12px] tabular-nums text-theme-text-muted">
                    {talk.date} 발표{talk.duration && ` · ${talk.duration}`}
                </span>
            </div>
            <h3 className="text-[17px] font-semibold leading-snug text-theme-text">{talk.title}</h3>
            <div className="mt-0.5 text-[13px] text-theme-text-muted">{talk.titleEn}</div>
            <div className="mt-1.5 text-[13px] text-theme-text-secondary">{talk.speakers}</div>
            <p className="mt-3 text-sm leading-relaxed text-theme-text-secondary">{talk.summary}</p>
            {talk.points.length > 0 && (
                <ul className="mt-3 grid gap-1.5 text-sm text-theme-text-secondary">
                    {talk.points.map((p) => (
                        <li key={p} className="relative pl-4 before:absolute before:left-0 before:top-[0.6em] before:h-1 before:w-1 before:rounded-full before:bg-theme-text-muted">
                            {p}
                        </li>
                    ))}
                </ul>
            )}
            <div className="mt-3.5 flex flex-wrap gap-2">
                {talk.videos.map((v) => (
                    <a
                        key={v.url}
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-theme-border px-3.5 py-1.5 text-[13px] font-semibold text-theme-text hover:bg-white/5"
                    >
                        <PlayCircle size={14} /> {v.label}
                    </a>
                ))}
                {talk.flow && talk.flow.length > 0 && (
                    <PanelButton id={`flow-${talk.id}`} open={panel === 'flow'} onClick={() => toggle('flow')} icon={<ListOrdered size={14} />} label="한국어 정리" />
                )}
                {loadScript && (
                    <PanelButton id={`script-${talk.id}`} open={panel === 'script'} onClick={() => toggle('script')} icon={<FileText size={14} />} label="한국어 스크립트" />
                )}
            </div>
            {panel === 'flow' && talk.flow && (
                <div id={`flow-${talk.id}`} className="mt-4 rounded-xl border border-theme-border-secondary bg-white/[0.02]">
                    <ol className="grid gap-4 px-4 py-4">
                        {talk.flow.map((f, i) => (
                            <li key={f.heading} className="grid grid-cols-[24px_1fr] gap-2">
                                <span className="pt-0.5 text-[12px] font-bold tabular-nums text-brand-accent">{String(i + 1).padStart(2, '0')}</span>
                                <div>
                                    <b className="text-sm text-theme-text">{f.heading}</b>
                                    <p className="mt-1 text-sm leading-relaxed text-theme-text-secondary">{f.body}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                    <p className="border-t border-theme-border-secondary px-4 py-2.5 text-[12px] text-theme-text-muted">
                        대본을 바탕으로 ECK가 발표 흐름을 우리말로 정리한 것입니다. 원문 전체는 영상 페이지에서 볼 수 있습니다.
                    </p>
                </div>
            )}
            {panel === 'script' && (
                <div id={`script-${talk.id}`} className="mt-4 max-h-[60vh] overflow-y-auto rounded-xl border border-theme-border-secondary bg-white/[0.02] px-4 py-4">
                    {script === null ? (
                        <p className="text-sm text-theme-text-muted">불러오는 중입니다.</p>
                    ) : (
                        <ScriptBody text={script} />
                    )}
                </div>
            )}
        </div>
    </li>
    );
};

const PanelButton: React.FC<{ id: string; open: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ id, open, onClick, icon, label }) => (
    <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${open ? 'border-white bg-white text-black' : 'border-theme-border text-theme-text hover:bg-white/5'}`}
    >
        {icon} {label}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
);

/** 스크립트 파일: 빈 줄로 문단을 나누고, "## " 로 시작하는 줄은 소제목 */
const ScriptBody: React.FC<{ text: string }> = ({ text }) => (
    <div className="grid gap-3 text-sm leading-relaxed text-theme-text-secondary">
        {text
            .split(/\n\s*\n/)
            .map((block) => block.trim())
            .filter(Boolean)
            .map((block, i) =>
                block.startsWith('## ') ? (
                    <h4 key={i} className="pt-2 text-[15px] font-semibold text-theme-text">
                        {block.slice(3)}
                    </h4>
                ) : (
                    <p key={i} className="whitespace-pre-line">
                        {block}
                    </p>
                ),
            )}
    </div>
);

const EventDevcon8: React.FC = () => {
    usePageMeta({
        title: 'Devcon 8 India 현장 리포트',
        description: '뭄바이에서 열린 Devcon 8의 주요 발표와 소식, 다음 Devcon 리스본 개최 소식을 정리했습니다.',
        image: DEVCON8_IMAGES.keyVisual,
    });
    const [topic, setTopic] = useState<Devcon8Topic | 'all'>('all');
    const talks = topic === 'all' ? DEVCON8_TALKS : DEVCON8_TALKS.filter((t) => t.topic === topic);

    return (
        <div className="min-h-screen pt-20 pb-20">
            <header className="relative overflow-hidden border-b border-theme-border-secondary">
                <img src={DEVCON8_IMAGES.keyVisual} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-45" />
                <div className="absolute inset-0 bg-gradient-to-r from-theme-bg via-theme-bg/80 to-theme-bg/30" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-theme-bg" />
                <div className="container relative mx-auto grid max-w-5xl items-center gap-10 px-6 pt-10 pb-12 md:grid-cols-[1.15fr_0.85fr]">
                    <div>
                        <Link to="/events?type=global" className="mb-8 inline-flex items-center gap-1.5 text-sm text-theme-text-muted hover:text-theme-text">
                            <ArrowLeft size={14} /> Events
                        </Link>
                        <div className="text-xs font-semibold uppercase tracking-widest text-brand-accent">외부 행사 리포트 · Ethereum Foundation</div>
                        <h1 className="mt-2 text-4xl font-bold tracking-tight text-theme-text sm:text-6xl">Devcon 8 India</h1>
                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums text-theme-text-secondary">
                            <span>2026.11.03 ~ 11.06</span>
                            <span>뭄바이 Jio World Centre</span>
                        </div>
                        <p className="mt-6 max-w-xl text-base leading-relaxed text-theme-text-secondary">
                            이더리움 재단이 여는 개발자 행사 Devcon이 인도 뭄바이에서 나흘 동안 열렸습니다. 올해 무대의 중심에는 AI 시대의 보안과 프라이버시, 그리고
                            양자컴퓨터에 대비한 암호 전환이 있었습니다. 238개 세션 가운데 주요 발표와 행사 기간에 나온 소식을 정리했습니다.
                        </p>
                    </div>
                    <figure className="relative order-first mx-auto w-full max-w-sm overflow-hidden md:order-none rounded-3xl border border-white/10 shadow-2xl shadow-black/50">
                        <img src={DEVCON8_IMAGES.vitalik} alt="망토와 웃는 얼굴 가면을 쓰고 Devcon 8 무대에 선 비탈릭 부테린" className="block aspect-[4/5] max-h-[60vh] w-full object-cover object-top md:max-h-none" />
                        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-5 pt-12 pb-4">
                            <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-accent">개막 키노트</span>
                            <b className="mt-1 block text-lg leading-snug text-white">가면을 쓰고 무대에 오른 비탈릭</b>
                        </figcaption>
                    </figure>
                </div>
            </header>

            <div className="container mx-auto max-w-5xl px-6">
                <section className="py-11">
                    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-theme-border-secondary bg-theme-border-secondary md:grid-cols-4">
                        {HIGHLIGHTS.map((h) => (
                            <div key={h.label} className="bg-brand-surface px-4 py-4">
                                <span className="text-xs text-theme-text-muted">{h.label}</span>
                                <b className="mt-1 block text-xl font-bold text-theme-text">{h.value}</b>
                                <span className="mt-1 block text-xs text-theme-text-muted">{h.note}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="pt-4" aria-labelledby="devcon8-talks">
                    <SectionHead id="devcon8-talks" title="주요 발표" />
                    <div className="mb-4 flex flex-wrap gap-1.5">
                        {(['all', ...TOPICS] as const).map((k) => (
                            <button
                                key={k}
                                type="button"
                                aria-pressed={topic === k}
                                onClick={() => setTopic(k)}
                                className={`rounded-full border px-3 py-1.5 text-[13px] ${topic === k ? 'border-white bg-white font-semibold text-black' : 'border-theme-border-secondary bg-brand-surface text-theme-text-secondary'}`}
                            >
                                {k === 'all' ? '전체' : TOPIC_LABEL[k]}
                            </button>
                        ))}
                    </div>
                    <ol className="border-t border-theme-border-secondary">
                        {talks.map((t) => (
                            <TalkRow key={t.id} talk={t} />
                        ))}
                    </ol>
                    <div className="mt-6 rounded-2xl border border-theme-border-secondary bg-white/[0.02] px-5 py-4">
                        <b className="text-sm text-theme-text">더 볼 만한 세션</b>
                        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                            {DEVCON8_MORE.map((m) => (
                                <li key={m.url}>
                                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-brand-accent hover:underline">
                                        {m.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                <section className="pt-16" aria-labelledby="devcon8-news">
                    <SectionHead id="devcon8-news" title="행사 기간에 나온 소식" />
                    <div className="grid gap-4 md:grid-cols-2">
                        {DEVCON8_NEWS.map((n) => (
                            <article key={n.title} className="rounded-2xl border border-theme-border-secondary bg-brand-surface p-5">
                                <h3 className="font-semibold text-theme-text">{n.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-theme-text-secondary">{n.body}</p>
                                <a href={n.source.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[13px] text-brand-accent hover:underline">
                                    {n.source.label}
                                </a>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="pt-16" aria-labelledby="devcon8-next">
                    <SectionHead id="devcon8-next" title="다음 Devcon" />
                    <div className="grid overflow-hidden rounded-2xl border border-brand-accent/30 bg-brand-surface md:grid-cols-[1fr_1.1fr]">
                        <img src={DEVCON8_IMAGES.lisbon} alt="Devcon IX 리스본 2027년 10월 11~13일 안내 이미지" loading="lazy" className="block h-full w-full object-cover" />
                        <div className="p-6">
                            <div className="text-xs font-semibold uppercase tracking-widest text-brand-accent">Devcon IX</div>
                            <h3 className="mt-1 text-2xl font-bold text-theme-text">2027년 10월 11일~13일, 포르투갈 리스본</h3>
                            <p className="mt-3 text-sm leading-relaxed text-theme-text-secondary">
                                이번이 마지막 Devcon이라는 이야기도 돌았지만, 폐막 무대에서 다음 행사를 리스본 CCL(Lisbon Congress Centre)에서 연다고 발표했습니다. 그동안 Devcon과
                                Devconnect가 해마다 번갈아 열렸는데, 2027년에는 2019년 이후 처음으로 Devcon이 2년 연속 열립니다. 2027년 Devconnect 개최 여부는 아직 공식 언급이
                                없습니다.
                            </p>
                            <a
                                href={DEVCON8_LINKS.lisbon}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent hover:underline"
                            >
                                <ExternalLink size={14} /> Devcon IX 안내
                            </a>
                        </div>
                    </div>
                </section>

                <div className="mt-12 flex flex-wrap gap-2.5">
                    <a
                        href={DEVCON8_LINKS.allVideos}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-gray-200"
                    >
                        <PlayCircle size={15} /> 전체 영상 238개 (이더리움 TV)
                    </a>
                    <a
                        href={DEVCON8_LINKS.official}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-theme-border px-5 py-2.5 text-sm font-semibold text-theme-text hover:bg-white/5"
                    >
                        <ExternalLink size={14} /> Devcon 공식 사이트
                    </a>
                    <Link to="/events" className="inline-flex items-center rounded-full border border-theme-border px-5 py-2.5 text-sm font-semibold text-theme-text hover:bg-white/5">
                        다른 행사 보기
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default EventDevcon8;
