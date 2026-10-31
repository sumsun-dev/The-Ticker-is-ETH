import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';
import type { StatsHistory } from '../types/adminStats';
import { periods, summarize, kstDate, type Mode, type Period, type Summary } from '../utils/adminStats';
import { bestSlot, findAiInsight, memberBreakdown, ruleInsights, timeHeat, typeBreakdown } from '../utils/adminInsights';
import { authorIndex, thumbIndex, type AuthorIndex, type ThumbIndex } from '../utils/adminMedia';
import { loadResearchIndex } from '../data/researchData';
import InsightPanel from '../components/admin/InsightPanel';
import { ChannelKpis } from '../components/admin/ui';
import AdminShell, { AdminLogin } from '../components/admin/AdminShell';
import { LinkedInPane, MembersPane, SitePane, TelegramPane, type SeriesRow } from '../components/admin/sections';

const todayKst = () => kstDate(new Date().toISOString());

type Load = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; data: StatsHistory };

async function fetchStats(password: string): Promise<StatsHistory> {
    const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    if (res.status === 401) throw new Error('비밀번호가 맞지 않습니다');
    if (res.status === 404) throw new Error('아직 쌓인 데이터가 없습니다');
    if (!res.ok) throw new Error(`불러오기 실패 (${res.status})`);
    return (await res.json()) as StatsHistory;
}

/* ── 페이지 ────────────────────────────────────────────────────── */

const btn = 'rounded-md border px-3 py-1.5 text-[13px] transition-colors';
const btnOn = 'border-zinc-300 bg-theme-bg font-semibold text-theme-text';
const btnOff = 'border-theme-border bg-theme-bg text-theme-text-secondary hover:text-theme-text';

const ModeTabs: React.FC<{ mode: Mode; onChange: (m: Mode) => void }> = ({ mode, onChange }) => (
    <div className="flex gap-1.5" role="tablist" aria-label="집계 단위">
        {(['week', 'month'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => onChange(m)} className={`${btn} ${mode === m ? btnOn : btnOff}`}>
                {m === 'week' ? '주별' : '월별'}
            </button>
        ))}
    </div>
);

const periodText = (p: Period, mode: Mode) => (mode === 'week' ? `${p.start.slice(5).replace('-', '.')} – ${p.end.slice(5).replace('-', '.')}` : p.label);

const TABS = [
    { key: 'telegram', label: '텔레그램' },
    { key: 'site', label: '홈페이지' },
    { key: 'linkedin', label: '링크드인' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const Dashboard: React.FC<{ data: StatsHistory; updated: string }> = ({ data, updated }) => {
    const [mode, setMode] = useState<Mode>('week');
    const [tab, setTab] = useState<Tab>('telegram');
    const list = useMemo(() => periods(data, mode, todayKst()), [data, mode]);
    const [selected, setSelected] = useState<string>('');
    const [idx, setIdx] = useState<ThumbIndex>(() => new Map());
    const [authors, setAuthors] = useState<AuthorIndex>(() => new Map());
    useEffect(() => {
        let alive = true;
        loadResearchIndex()
            .then((items) => {
                if (!alive) return;
                setIdx(thumbIndex(items));
                setAuthors(authorIndex(items));
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, []);
    const sums = useMemo(() => new Map(list.map((p) => [p.key, summarize(data, p)])), [data, list]);
    const types = useMemo(() => typeBreakdown(data.tgPosts, data.updatedAt), [data]);
    const heat = useMemo(() => timeHeat(data.tgPosts, data.updatedAt), [data]);
    const slot = useMemo(() => bestSlot(heat), [heat]);

    const sel = list.find((p) => p.key === selected) ?? list[0];
    if (!sel) return <p className="text-theme-text-muted">표시할 기간이 없습니다.</p>;
    const i = list.indexOf(sel);
    const cur = sums.get(sel.key) as Summary;
    const prevPeriod = list[i + 1];
    const prev = prevPeriod ? (sums.get(prevPeriod.key) as Summary) : null;
    const trend = (f: (s: Summary) => number | null) =>
        list
            .slice(i, i + 12)
            .reverse()
            .map((p) => f(sums.get(p.key) as Summary));
    const shortLabel = (p: Period) => (mode === 'week' ? p.start.slice(5).replace('-', '.') : `${p.start.slice(2, 4)}.${p.start.slice(5, 7)}`);
    // 차트·표용: 보이는 모든 기간, 오래된 것부터
    const series: SeriesRow[] = [...list].reverse().map((p) => ({ key: p.key, label: shortLabel(p), partial: p.end >= todayKst(), sum: sums.get(p.key) as Summary }));
    const membersOf = (p: Period) =>
        memberBreakdown(
            data.tgPosts.filter((x) => {
                const d = kstDate(x.date);
                return d >= p.start && d <= p.end;
            }),
            (id) => authors.get(id),
            data.updatedAt,
        );
    const members = membersOf(sel);
    const memberSeries = list
        .slice(0, 12)
        .reverse()
        .map((p) => ({ key: p.key, label: shortLabel(p), members: membersOf(p) }));
    const rules = ruleInsights({ cur, prev, types, slot });
    const ai = findAiInsight(data, sel.key);
    const ongoing = sel.end >= todayKst();
    const aiCount = (s: Summary) => (s.site ? s.site.bots.ai.reduce((a, [, v]) => a + v, 0) : null);
    const searchPct = (s: Summary) => {
        const total = s.site?.sources.reduce((a, [, v]) => a + v, 0);
        return s.site && total ? Math.round(((s.site.sources.find(([k]) => k === '검색')?.[1] ?? 0) / total) * 1000) / 10 : null;
    };
    const liPerPost = (s: Summary) => (s.liImpressions !== null && s.liPosts ? Math.round(s.liImpressions / s.liPosts) : null);
    const go = (step: number) => {
        const next = list[i + step];
        if (next) setSelected(next.key);
    };

    return (
        <>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold text-theme-text">성과</h1>
                    <p className="text-xs text-theme-text-muted md:hidden">마지막 수집 {updated}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <ModeTabs
                        mode={mode}
                        onChange={(m) => {
                            setMode(m);
                            setSelected('');
                        }}
                    />
                    <span className="w-1.5" />
                    <button onClick={() => go(1)} disabled={!prevPeriod} aria-label="이전 기간" className={`${btn} ${btnOff} px-2 disabled:opacity-40`}>
                        <ChevronLeft size={15} />
                    </button>
                    <select value={sel.key} onChange={(e) => setSelected(e.target.value)} aria-label="기간 선택" className={`${btn} ${btnOn} tabular-nums focus:outline-none`}>
                        {list.map((p) => (
                            <option key={p.key} value={p.key}>
                                {periodText(p, mode)}
                            </option>
                        ))}
                    </select>
                    <button onClick={() => go(-1)} disabled={i === 0} aria-label="다음 기간" className={`${btn} ${btnOff} px-2 disabled:opacity-40`}>
                        <ChevronRight size={15} />
                    </button>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <ChannelKpis
                    ongoing={ongoing}
                    channel="telegram"
                    metrics={[
                        { label: '구독자', value: cur.subscribers, prev: prev?.subscribers ?? null, unit: '명', trend: trend((s) => s.subscribers), emptyReason: '기록 전' },
                        { label: '평균 조회수', value: cur.tgAvgViews, prev: prev?.tgAvgViews ?? null, unit: '회', trend: trend((s) => s.tgAvgViews), emptyReason: '조회 쌓인 글 부족', note: `글당 평균${cur.tgFresh ? `, 최근 ${cur.tgFresh}개 글은 조회가 쌓이는 중이라 제외` : ''}` },
                        { cumulative: true, label: '올린 글', value: cur.tgPosts, prev: prev?.tgPosts ?? null, unit: '개', trend: trend((s) => s.tgPosts) },
                    ]}
                />
                <ChannelKpis
                    ongoing={ongoing}
                    channel="site"
                    metrics={[
                        { cumulative: true, label: '방문자', value: cur.visitors, prev: prev?.visitors ?? null, unit: '명', trend: trend((s) => s.visitors), emptyReason: '기간 전체 로그 없음', note: mode === 'month' && cur.visitors !== null ? `일별 방문자 합, ${cur.siteDays}일치` : undefined },
                        { cumulative: true, label: 'AI 크롤러', value: aiCount(cur), prev: prev ? aiCount(prev) : null, unit: '회', trend: trend(aiCount), emptyReason: '상세 기록 없음', note: 'AI 답변 엔진이 사이트를 읽어 간 요청 수' },
                        { label: '검색 유입', value: searchPct(cur), prev: prev ? searchPct(prev) : null, unit: '%', deltaSuffix: '%p', trend: trend(searchPct), emptyReason: '상세 기록 없음', note: '첫 진입 중 검색엔진에서 온 비중' },
                    ]}
                />
                <ChannelKpis
                    ongoing={ongoing}
                    channel="linkedin"
                    metrics={[
                        { label: '팔로워', value: cur.followers, prev: prev?.followers ?? null, unit: '명', trend: trend((s) => s.followers), emptyReason: '기록 전' },
                        { cumulative: true, label: '노출', value: cur.liImpressions, prev: prev?.liImpressions ?? null, unit: '회', trend: trend((s) => s.liImpressions), emptyReason: '기록 시작 전' },
                        { label: '글당 노출', value: liPerPost(cur), prev: prev ? liPerPost(prev) : null, unit: '회', trend: trend(liPerPost), emptyReason: '기록 시작 전' },
                    ]}
                />
            </div>

            {/* 숫자 인사이트는 탭마다 있다. 여기는 AI 분석이 있는 기간에만 */}
            {ai && (
                <div className="mt-5">
                    <InsightPanel ai={ai} rules={rules} periodLabel={`${periodText(sel, mode)}${prevPeriod ? ` · 비교 ${periodText(prevPeriod, mode)}` : ''}`} />
                </div>
            )}

            <section className="mt-10" aria-label="기여자">
                <h2 className="mb-4 text-base font-bold text-theme-text">기여자</h2>
                <MembersPane data={data} cur={cur} members={members} memberSeries={memberSeries} period={sel} />
            </section>

            <h2 className="mt-14 text-base font-bold text-theme-text">채널 상세</h2>
            <div className="mb-6 mt-2 flex gap-6 border-b border-theme-border" role="tablist" aria-label="채널">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        role="tab"
                        aria-selected={tab === t.key}
                        onClick={() => setTab(t.key)}
                        className={`-mb-px whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors ${tab === t.key ? 'border-theme-text font-semibold text-theme-text' : 'border-transparent text-theme-text-muted hover:text-theme-text'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div role="tabpanel" aria-label={TABS.find((t) => t.key === tab)?.label}>
                {tab === 'telegram' && <TelegramPane data={data} cur={cur} prev={prev} period={sel} series={series} idx={idx} types={types} heat={heat} slot={slot} />}
                {tab === 'site' && <SitePane data={data} cur={cur} prev={prev} period={sel} series={series} idx={idx} />}
                {tab === 'linkedin' && <LinkedInPane data={data} cur={cur} prev={prev} period={sel} series={series} idx={idx} />}
            </div>
        </>
    );
};

const AdminStats: React.FC = () => {
    usePageMeta({ title: 'Stats', description: 'ECK 성과 대시보드', noindex: true });
    // /admin에서 로그인한 세션이면 비밀번호를 다시 묻지 않고 바로 연다
    const [load, setLoad] = useState<Load>(() => (sessionStorage.getItem('publishKey') ? { state: 'loading' } : { state: 'idle' }));

    const open = (pw: string) =>
        fetchStats(pw).then((data) => {
            sessionStorage.setItem('publishKey', pw);
            setLoad({ state: 'ok', data });
        });

    useEffect(() => {
        const saved = sessionStorage.getItem('publishKey');
        if (saved)
            open(saved).catch((e: unknown) => {
                if (e instanceof Error && e.message.includes('비밀번호')) sessionStorage.removeItem('publishKey');
                setLoad({ state: 'error', message: e instanceof Error ? e.message : '불러오기 실패' });
            });
    }, []);

    const updated =
        load.state === 'ok' && load.data.updatedAt
            ? new Date(load.data.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : null;

    return (
        <AdminShell
            active="stats"
            footnote={
                updated && (
                    <>
                        마지막 수집 {updated}
                        <br />
                        매주 월요일 09:00 갱신
                    </>
                )
            }
        >
            {load.state === 'ok' ? (
                <Dashboard data={load.data} updated={updated ?? '-'} />
            ) : load.state === 'loading' ? (
                <p className="mt-[14vh] flex items-center justify-center gap-2 text-theme-text-muted">
                    <Loader2 className="animate-spin" size={16} /> 불러오는 중
                </p>
            ) : (
                <>
                    {load.state === 'error' && <p className="mx-auto mt-6 max-w-xs text-sm text-red-600">{load.message}</p>}
                    <AdminLogin title="성과 대시보드" check={open} />
                </>
            )}
        </AdminShell>
    );
};

export default AdminStats;
