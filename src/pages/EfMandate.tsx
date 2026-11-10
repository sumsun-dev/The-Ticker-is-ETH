import React, { useState } from 'react';
import { BookOpen, ChevronDown, ExternalLink, FileText, Quote } from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';
import data from '../data/ef-mandate.json';

/**
 * EF Mandate(이더리움 재단, 2026-03-13) 한국어 해설. 장마다 요지·요점·인용을 보여 주고, 「한국어 전문」을 펼치면
 * 온체인 원문을 옮긴 번역(src/data/ef-mandate-full/<장>.md)을 불러온다.
 * 그림은 재단이 배포한 디자인 PDF의 표지·장 그림과 공식 블로그 대표 이미지 (public/assets/ef-mandate/).
 */

interface Section {
    id: string;
    numeral: string;
    titleEn: string;
    titleKo: string;
    summary: string;
    points: string[];
    quote?: { en: string; ko: string } | null;
    subsections?: Array<{ titleEn: string; titleKo: string; points: string[] }>;
}

interface MandateData {
    meta: { published: string; originalUrl: string; blogUrl: string; pdfUrl?: string; onchain?: string; onchainTx?: string };
    lead: string;
    keyIdeas: Array<{ title: string; body: string }>;
    sections: Section[];
    principles: { technical: Array<{ name: string; body: string }>; social: Array<{ name: string; body: string }> };
    quandaries: Array<{ question: string; answer: string }>;
    glossary: Array<{ term: string; body: string }>;
}

const D = data as MandateData;
const IMG = '/assets/ef-mandate';
const chapterImg = (numeral: string) => `${IMG}/${numeral.toLowerCase()}.webp`;
const FULL = import.meta.glob('../data/ef-mandate-full/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

/** 번역 파일: 빈 줄로 문단, "## " 줄은 소제목, "- "·"1. " 로 시작하는 줄로 된 블록은 목록 */
const FullTextBody: React.FC<{ text: string }> = ({ text }) => (
    <div className="grid gap-4 text-[15px] leading-[1.8] text-theme-text-secondary">
        {text
            .split(/\n\s*\n/)
            .map((b) => b.trim())
            .filter(Boolean)
            .map((b, i) => {
                if (b.startsWith('## ')) return <h4 key={i} className="pt-3 text-base font-semibold text-theme-text">{b.slice(3)}</h4>;
                const lines = b.split('\n');
                if (lines.every((l) => /^(- |\d+\. )/.test(l)))
                    return (
                        <ul key={i} className="grid gap-1.5 pl-1">
                            {lines.map((l) => <li key={l}>{l.replace(/^- /, '· ')}</li>)}
                        </ul>
                    );
                return <p key={i} className="whitespace-pre-line">{b}</p>;
            })}
    </div>
);

const FullText: React.FC<{ numeral: string }> = ({ numeral }) => {
    const load = FULL[`../data/ef-mandate-full/${numeral.toLowerCase()}.md`];
    const [open, setOpen] = useState(false);
    const [text, setText] = useState<string | null>(null);
    if (!load) return null;
    const id = `full-${numeral.toLowerCase()}`;
    const toggle = () => {
        if (!open && text === null) load().then(setText).catch(() => setText('번역을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.'));
        setOpen(!open);
    };
    return (
        <div className="mt-6">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={id}
                onClick={toggle}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold ${open ? 'border-white bg-white text-black' : 'border-theme-border text-theme-text hover:bg-white/5'}`}
            >
                <BookOpen size={14} /> {open ? '한국어 전문 접기' : '한국어 전문 읽기'}
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div id={id} className="mt-4 rounded-2xl border border-theme-border-secondary bg-white/[0.02] px-5 py-5 sm:px-7">
                    {text === null ? <p className="text-sm text-theme-text-muted">불러오는 중입니다.</p> : <FullTextBody text={text} />}
                    <p className="mt-6 border-t border-theme-border-secondary pt-3 text-[12px] text-theme-text-muted">
                        재단이 이더리움에 기록한 원문을 ECK가 우리말로 옮겼습니다. 정확한 표현은 원문을 확인해 주세요.
                    </p>
                </div>
            )}
        </div>
    );
};

const SectionHead: React.FC<{ id: string; title: string }> = ({ id, title }) => (
    <div className="mb-6 flex items-center gap-4">
        <h2 id={id} className="whitespace-nowrap text-[22px] font-bold text-theme-text">
            {title}
        </h2>
        <div className="h-px flex-1 bg-white/10" />
    </div>
);

const LinkButton: React.FC<{ href: string; primary?: boolean; icon: React.ReactNode; children: React.ReactNode }> = ({ href, primary, icon, children }) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold ${primary ? 'bg-white text-black hover:bg-gray-200' : 'border border-white/20 text-white hover:bg-white/10'}`}
    >
        {icon} {children}
    </a>
);

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
    <ul className="grid gap-1.5 text-[15px] leading-relaxed text-theme-text-secondary">
        {items.map((p) => (
            <li key={p} className="relative pl-4 before:absolute before:left-0 before:top-[0.65em] before:h-1 before:w-1 before:rounded-full before:bg-brand-accent">
                {p}
            </li>
        ))}
    </ul>
);

const ChapterBlock: React.FC<{ s: Section }> = ({ s }) => (
    <article id={`ch-${s.numeral.toLowerCase()}`} className="grid scroll-mt-24 gap-6 border-t border-theme-border-secondary py-12 md:grid-cols-[280px_minmax(0,1fr)] md:gap-10">
        <figure className="md:sticky md:top-24 md:self-start">
            <img
                src={chapterImg(s.numeral)}
                alt={`EF Mandate ${s.numeral}장 ${s.titleEn} 그림`}
                loading="lazy"
                className="mx-auto block aspect-[3/4] w-full max-w-[280px] rounded-2xl border border-white/10 object-cover shadow-xl shadow-black/40"
            />
        </figure>
        <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-accent">
                {s.numeral}. {s.titleEn}
            </div>
            <h3 className="mt-1.5 text-2xl font-bold text-theme-text sm:text-3xl">{s.titleKo}</h3>
            <p className="mt-4 text-base leading-relaxed text-theme-text-secondary">{s.summary}</p>
            {s.points.length > 0 && (
                <div className="mt-5">
                    <Bullets items={s.points} />
                </div>
            )}
            {s.subsections?.map((sub) => (
                <div key={sub.titleEn} className="mt-6 rounded-xl border border-theme-border-secondary bg-white/[0.02] p-4">
                    <b className="text-sm text-theme-text">
                        {sub.titleKo} <span className="font-normal text-theme-text-muted">{sub.titleEn}</span>
                    </b>
                    <div className="mt-2.5">
                        <Bullets items={sub.points} />
                    </div>
                </div>
            ))}
            {s.quote && (
                <blockquote className="mt-6 rounded-xl bg-brand-accent/[0.06] px-5 py-4">
                    <Quote size={16} className="mb-2 text-brand-accent" aria-hidden />
                    <p className="text-[15px] font-medium leading-relaxed text-theme-text">{s.quote.ko}</p>
                    <p className="mt-1.5 text-[13px] italic text-theme-text-muted">“{s.quote.en}”</p>
                </blockquote>
            )}
            <FullText numeral={s.numeral} />
        </div>
    </article>
);

const EfMandate: React.FC = () => {
    usePageMeta({
        title: 'EF Mandate 해설',
        description: '이더리움 재단이 2026년 3월 발표한 EF Mandate를 장마다 쉽게 풀었습니다. 재단의 역할, 원칙, 어려운 판단의 기준을 정리했습니다.',
        image: `${IMG}/hero.webp`,
        canonical: '/ef-mandate',
    });

    return (
        <div className="min-h-screen pt-20 pb-20">
            <header className="relative overflow-hidden border-b border-theme-border-secondary">
                <img src={`${IMG}/hero.webp`} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-50" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#050816] via-[#050816]/85 to-[#050816]/30" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-theme-bg" />
                <div className="container relative mx-auto grid max-w-5xl items-center gap-10 px-6 pt-12 pb-14 md:grid-cols-[1.25fr_0.75fr]">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-brand-accent">Ethereum Foundation · {D.meta.published.replaceAll('-', '.')}</div>
                        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-6xl">EF Mandate</h1>
                        <p className="mt-2 text-lg text-white/80">이더리움 재단은 무엇을 하고, 무엇을 하지 않는가</p>
                        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80">{D.lead}</p>
                        <div className="mt-7 flex flex-wrap gap-2.5">
                            <LinkButton href={D.meta.originalUrl} primary icon={<ExternalLink size={14} />}>
                                원문 (ethereum.org)
                            </LinkButton>
                            {D.meta.pdfUrl && (
                                <LinkButton href={D.meta.pdfUrl} icon={<FileText size={14} />}>
                                    디자인 PDF
                                </LinkButton>
                            )}
                            <LinkButton href={D.meta.blogUrl} icon={<ExternalLink size={14} />}>
                                재단 블로그
                            </LinkButton>
                        </div>
                    </div>
                    <figure className="order-first mx-auto w-full max-w-[260px] md:order-none md:max-w-[300px]">
                        <img
                            src={`${IMG}/cover.webp`}
                            alt="EF Mandate 표지 그림"
                            className="block aspect-[3/4] w-full rounded-2xl border border-white/15 object-cover shadow-2xl shadow-black/60"
                        />
                    </figure>
                </div>
            </header>

            <div className="container mx-auto max-w-5xl px-6">
                <section className="py-12" aria-labelledby="mandate-ideas">
                    <SectionHead id="mandate-ideas" title="한눈에 보기" />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {D.keyIdeas.map((k) => (
                            <div key={k.title} className="rounded-2xl border border-theme-border-secondary bg-brand-surface p-5">
                                <b className="text-[15px] text-theme-text">{k.title}</b>
                                <p className="mt-2 text-sm leading-relaxed text-theme-text-secondary">{k.body}</p>
                            </div>
                        ))}
                    </div>
                    {D.meta.onchain && (
                        <p className="mt-5 text-sm text-theme-text-muted">
                            {D.meta.onchain}{' '}
                            {D.meta.onchainTx && (
                                <a href={D.meta.onchainTx} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                                    블록 탐색기에서 보기
                                </a>
                            )}
                        </p>
                    )}
                </section>

                <nav aria-label="장 목차" className="mb-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
                    {D.sections.map((s) => (
                        <a
                            key={s.id}
                            href={`#ch-${s.numeral.toLowerCase()}`}
                            className="flex shrink-0 items-center gap-2 rounded-full border border-theme-border-secondary bg-brand-surface py-1 pl-1 pr-3.5 text-[13px] text-theme-text-secondary hover:border-brand-accent/50 hover:text-theme-text"
                        >
                            <img src={chapterImg(s.numeral)} alt="" className="h-7 w-7 rounded-full object-cover" loading="lazy" />
                            {s.numeral}. {s.titleKo}
                        </a>
                    ))}
                </nav>

                <section aria-label="장별 해설">
                    {D.sections.map((s) => (
                        <ChapterBlock key={s.id} s={s} />
                    ))}
                </section>

                {(D.principles.technical.length > 0 || D.principles.social.length > 0) && (
                    <section className="pt-12" aria-labelledby="mandate-principles">
                        <SectionHead id="mandate-principles" title="행동 원칙 한눈에" />
                        <div className="grid gap-4 md:grid-cols-2">
                            {(
                                [
                                    ['기술 원칙', 'Technical Pillar', D.principles.technical],
                                    ['사회 원칙', 'Social Pillar', D.principles.social],
                                ] as const
                            ).map(([ko, en, list]) => (
                                <div key={en} className="rounded-2xl border border-theme-border-secondary bg-brand-surface p-5">
                                    <b className="text-theme-text">
                                        {ko} <span className="text-sm font-normal text-theme-text-muted">{en}</span>
                                    </b>
                                    <dl className="mt-3 grid gap-3">
                                        {list.map((p) => (
                                            <div key={p.name}>
                                                <dt className="text-sm font-semibold text-brand-accent">{p.name}</dt>
                                                <dd className="mt-0.5 text-sm leading-relaxed text-theme-text-secondary">{p.body}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {D.quandaries.length > 0 && (
                    <section className="pt-16" aria-labelledby="mandate-quandaries">
                        <SectionHead id="mandate-quandaries" title="어려운 판단은 이렇게" />
                        <div className="grid gap-3">
                            {D.quandaries.map((q) => (
                                <div key={q.question} className="rounded-2xl border border-theme-border-secondary bg-white/[0.02] p-5">
                                    <b className="text-[15px] text-theme-text">Q. {q.question}</b>
                                    <p className="mt-2 text-sm leading-relaxed text-theme-text-secondary">{q.answer}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="pt-16">
                    {D.glossary.length > 0 && (
                        <section aria-labelledby="mandate-glossary">
                            <SectionHead id="mandate-glossary" title="용어 풀이" />
                            <dl className="grid gap-3">
                                {D.glossary.map((g) => (
                                    <div key={g.term}>
                                        <dt className="text-sm font-semibold text-theme-text">{g.term}</dt>
                                        <dd className="mt-0.5 text-sm leading-relaxed text-theme-text-secondary">{g.body}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    )}
                </div>

                <div className="relative mt-16 overflow-hidden rounded-3xl border border-white/10">
                    <img src={`${IMG}/viii.webp`} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-35" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#050816] via-[#050816]/80 to-transparent" />
                    <div className="relative p-8">
                        <b className="text-xl text-white">원문 전체 읽기</b>
                        <p className="mt-2 max-w-md text-sm text-white/75">이 페이지는 ECK가 원문을 우리말로 풀어 정리한 해설입니다. 정확한 표현은 원문을 확인해 주세요.</p>
                        <div className="mt-5 flex flex-wrap gap-2.5">
                            <LinkButton href={D.meta.originalUrl} primary icon={<ExternalLink size={14} />}>
                                원문 (ethereum.org)
                            </LinkButton>
                            {D.meta.pdfUrl && (
                                <LinkButton href={D.meta.pdfUrl} icon={<FileText size={14} />}>
                                    디자인 PDF
                                </LinkButton>
                            )}
                        </div>
                    </div>
                </div>
                <p className="mt-4 text-xs text-theme-text-muted">그림: Ethereum Foundation, EF Mandate (2026) 디자인 PDF와 재단 블로그 대표 이미지.</p>
            </div>
        </div>
    );
};

export default EfMandate;
