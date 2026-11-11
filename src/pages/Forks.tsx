import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import { FORKS } from '../data/forks';
import { loadEthCalls, type CallRecord } from '../data/ethCallsData';
import { forkEipStatuses } from '../utils/forks';
import { dotDate } from '../utils/calls';
import { T } from '../utils/lang';

const CHIP = 'min-h-[36px] px-4 py-1.5 rounded-full text-sm font-medium transition-colors';
const on = (active: boolean) => (active ? 'bg-brand-primary text-white' : 'bg-theme-surface text-theme-text-muted hover:text-theme-text');
const DESCRIPTION = T('2015년 Frontier부터 다가오는 Glamsterdam, Hegotá까지 이더리움 하드포크마다 무엇이 바뀌었는지 정리한 연대기.', 'A timeline of what changed in every Ethereum hard fork, from Frontier in 2015 to the upcoming Glamsterdam and Hegotá.');

const Forks: React.FC = () => {
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [all, setAll] = useState(false);
    usePageMeta({ title: T('하드포크', 'Hard Forks'), description: DESCRIPTION, canonical: '/forks' });
    useEffect(() => {
        loadEthCalls().then((f) => setCalls(f.calls));
    }, []);

    const upcoming = useMemo(
        () =>
            FORKS.filter((f) => !f.date)
                .reverse()
                .map((f) => {
                    const st = forkEipStatuses(calls, f);
                    return { f, sfi: st.filter((x) => x.status === 'SFI').length, cfi: st.filter((x) => x.status === 'CFI').length };
                }),
        [calls],
    );
    const past = FORKS.filter((f) => f.date && (all || f.major));

    return (
        <div className="min-h-screen pt-28 pb-20 px-6 container mx-auto text-theme-text">
            <div className="max-w-5xl mx-auto break-keep">
                <header className="mb-12 max-w-3xl">
                    <p className="text-sm font-semibold text-brand-accent mb-3">{T('하드포크', 'Hard Forks')}</p>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">{T('이더리움이 바뀌어 온 순간들', 'The moments Ethereum changed')}</h1>
                    <p className="text-theme-text-muted text-base md:text-lg leading-relaxed">
                        {T('하드포크는 모든 노드가 같은 날 새 규칙으로 갈아타는 업그레이드입니다. 2015년 출범부터 다음 포크까지, 포크마다 무엇이 바뀌었는지 정리했습니다. 더 먼 미래는', 'A hard fork is an upgrade where every node switches to new rules on the same day. This page covers what changed in each fork, from the 2015 launch to the next one. For the longer term, see the')}{' '}
                        <Link to="/roadmap" className="text-brand-accent hover:underline">
                            {T('로드맵', 'roadmap')}
                        </Link>
                        {T('에서 봅니다.', '.')}
                    </p>
                </header>

                <section aria-labelledby="fk-next" className="border-t border-theme-border py-10">
                    <h2 id="fk-next" className="text-2xl font-bold mb-6">
                        {T('다가오는 포크', 'Upcoming forks')}
                    </h2>
                    <ul className="grid gap-4 md:grid-cols-2">
                        {upcoming.map(({ f, sfi, cfi }, i) => (
                            <li key={f.slug}>
                                <Link
                                    to={`/forks/${f.slug}`}
                                    className={`h-full rounded-2xl border p-6 flex flex-col gap-3 transition-colors hover:border-brand-accent ${i === 0 ? 'border-brand-primary bg-brand-primary/10' : 'border-theme-border bg-theme-surface'}`}
                                >
                                    <span className="flex justify-between gap-2 text-xs">
                                        <span className="font-semibold text-amber-300">{f.stage}</span>
                                        <span className="text-theme-text-muted">{f.target}</span>
                                    </span>
                                    <span className="text-2xl font-bold">{f.name}</span>
                                    <span className="text-sm leading-relaxed text-theme-text-muted">{f.summary}</span>
                                    <span className="mt-auto pt-3 border-t border-theme-border text-sm">
                                        <span className="text-theme-text-muted">{T('포함 확정', 'Scheduled')}</span> <b className="text-emerald-400">{sfi}{T('개', '')}</b>
                                        <span className="mx-2 text-theme-text-muted" aria-hidden>
                                            ·
                                        </span>
                                        <span className="text-theme-text-muted">{T('검토 중', 'Considered')}</span> <b className="text-brand-accent">{cfi}{T('개', '')}</b>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>

                <section aria-labelledby="fk-past" className="border-t border-theme-border pt-10">
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                        <h2 id="fk-past" className="text-2xl font-bold">
                            {T('지난 포크', 'Past forks')}
                        </h2>
                        <div className="flex gap-2" role="group" aria-label={T('보기', 'View')}>
                            <button type="button" aria-pressed={!all} onClick={() => setAll(false)} className={`${CHIP} ${on(!all)}`}>
                                {T('주요 포크', 'Major forks')}
                            </button>
                            <button type="button" aria-pressed={all} onClick={() => setAll(true)} className={`${CHIP} ${on(all)}`}>
                                {T('전체', 'All')}
                            </button>
                        </div>
                    </div>
                    <ol>
                        {past.map((f) => (
                            <li key={f.slug} className="grid grid-cols-[5.5rem_1rem_minmax(0,1fr)] sm:grid-cols-[7rem_1.25rem_minmax(0,1fr)] gap-3 sm:gap-4">
                                <span className="py-4 text-right text-xs sm:text-sm text-theme-text-muted tabular-nums">{dotDate(f.date as string)}</span>
                                <span aria-hidden className="relative flex justify-center">
                                    <span className="absolute inset-y-0 w-0.5 bg-theme-border" />
                                    <span className={`relative mt-5 w-3 h-3 rounded-full ${f.major ? 'bg-brand-primary' : 'bg-theme-border'}`} />
                                </span>
                                <Link to={`/forks/${f.slug}`} className="py-3.5 border-b border-theme-border flex flex-col gap-1 group">
                                    <span className="text-lg font-bold group-hover:text-brand-accent">
                                        {f.name}
                                        {f.alias && <span className="ml-2 text-sm font-normal text-theme-text-muted">{f.alias}</span>}
                                    </span>
                                    <span className="text-sm leading-relaxed text-theme-text-muted">{f.summary}</span>
                                    {f.eips.length > 0 && <span className="text-xs font-mono text-brand-accent">{f.eips.slice(0, 3).map((x) => `EIP-${x.number}`).join(' · ')}{f.eips.length > 3 ? T(' 외', ' +') : ''}</span>}
                                </Link>
                            </li>
                        ))}
                    </ol>
                </section>
            </div>
        </div>
    );
};

export default Forks;
