import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Globe, Heart, Loader2, Lock, Send, Users } from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';
import type { StatsHistory } from '../types/adminStats';
import { periods, summarize, kstDate, type Mode, type Period, type Summary } from '../utils/adminStats';
import { bestSlot, findAiInsight, ruleInsights, timeHeat, typeBreakdown } from '../utils/adminInsights';
import { thumbIndex, type ThumbIndex } from '../utils/adminMedia';
import { loadResearchIndex } from '../data/researchData';
import InsightPanel from '../components/admin/InsightPanel';
import { KpiCard } from '../components/admin/ui';
import { LinkedInSection, SiteSection, TelegramSection } from '../components/admin/sections';

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

const LoginForm: React.FC<{ onSubmit: (pw: string) => void; error?: string; loading: boolean }> = ({ onSubmit, error, loading }) => {
    const [pw, setPw] = useState('');
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                if (pw) onSubmit(pw);
            }}
            className="max-w-sm mx-auto bg-theme-surface border border-theme-border rounded-2xl p-8 text-center"
        >
            <Lock className="mx-auto text-brand-primary mb-4" size={28} />
            <h1 className="text-xl font-bold text-theme-text mb-6">성과 대시보드</h1>
            <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="관리자 비밀번호"
                aria-label="관리자 비밀번호"
                autoFocus
                className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-theme-text mb-3 focus:outline-none focus:border-brand-accent/60"
            />
            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-brand-primary hover:bg-brand-primary/80 text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2">
                {loading && <Loader2 className="animate-spin" size={16} />}
                보기
            </button>
        </form>
    );
};

const ModeTabs: React.FC<{ mode: Mode; onChange: (m: Mode) => void }> = ({ mode, onChange }) => (
    <div className="inline-flex rounded-full border border-theme-border bg-theme-surface p-1" role="tablist" aria-label="집계 단위">
        {(['week', 'month'] as const).map((m) => (
            <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => onChange(m)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${mode === m ? 'bg-brand-primary text-white' : 'text-theme-text-muted hover:text-theme-text'}`}
            >
                {m === 'week' ? '주별' : '월별'}
            </button>
        ))}
    </div>
);

const periodText = (p: Period, mode: Mode) => (mode === 'week' ? `${p.start.slice(5).replace('-', '.')} ~ ${p.end.slice(5).replace('-', '.')}` : p.label);

const Dashboard: React.FC<{ data: StatsHistory }> = ({ data }) => {
    const [mode, setMode] = useState<Mode>('week');
    const list = useMemo(() => periods(data, mode, todayKst()), [data, mode]);
    const [selected, setSelected] = useState<string>('');
    const [idx, setIdx] = useState<ThumbIndex>(() => new Map());
    useEffect(() => {
        let alive = true;
        loadResearchIndex()
            .then((items) => {
                if (alive) setIdx(thumbIndex(items));
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
    if (!sel) return <p className="text-center text-theme-text-muted">표시할 기간이 없습니다.</p>;
    const i = list.indexOf(sel);
    const cur = sums.get(sel.key) as Summary;
    const prevPeriod = list[i + 1];
    const prev = prevPeriod ? (sums.get(prevPeriod.key) as Summary) : null;
    const trend = (f: (s: Summary) => number | null) =>
        list
            .slice(i, i + 12)
            .reverse()
            .map((p) => f(sums.get(p.key) as Summary));
    const rules = ruleInsights({ cur, prev, types, slot });
    const ai = findAiInsight(data, sel.key);
    const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-';
    const go = (step: number) => {
        const next = list[i + step];
        if (next) setSelected(next.key);
    };

    return (
        <div className="space-y-6">
            <header className="relative overflow-hidden rounded-[2rem] border border-theme-border bg-gradient-to-br from-brand-primary/25 via-theme-surface to-eth-purple/15 p-6 md:p-8">
                <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-brand-accent/20 blur-3xl" />
                <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">ECK Performance</p>
                        <h1 className="mt-2 text-3xl font-bold text-theme-text md:text-4xl">성과 대시보드</h1>
                        <p className="mt-2 text-sm text-theme-text-muted">홈페이지 · 텔레그램 · 링크드인 · 마지막 수집 {updated} · 매주 월요일 09:00 갱신</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <ModeTabs
                            mode={mode}
                            onChange={(m) => {
                                setMode(m);
                                setSelected('');
                            }}
                        />
                        <div className="inline-flex items-center rounded-full border border-theme-border bg-theme-surface">
                            <button onClick={() => go(1)} disabled={!prevPeriod} aria-label="이전 기간" className="rounded-l-full px-2.5 py-2 text-theme-text-muted hover:text-theme-text disabled:opacity-30">
                                <ChevronLeft size={16} />
                            </button>
                            <select value={sel.key} onChange={(e) => setSelected(e.target.value)} aria-label="기간 선택" className="bg-transparent px-1 py-2 text-sm font-medium text-theme-text focus:outline-none">
                                {list.map((p) => (
                                    <option key={p.key} value={p.key} className="bg-theme-bg">
                                        {periodText(p, mode)}
                                    </option>
                                ))}
                            </select>
                            <button onClick={() => go(-1)} disabled={i === 0} aria-label="다음 기간" className="rounded-r-full px-2.5 py-2 text-theme-text-muted hover:text-theme-text disabled:opacity-30">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <InsightPanel ai={ai} rules={rules} periodLabel={`${periodText(sel, mode)}${prevPeriod ? ` · 비교: ${periodText(prevPeriod, mode)}` : ''}`} />

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <KpiCard
                    label="홈페이지 방문자"
                    channel="site"
                    icon={<Globe size={14} />}
                    value={cur.visitors}
                    prev={prev?.visitors ?? null}
                    unit="명"
                    trend={trend((s) => s.visitors)}
                    emptyReason="기간 전체 로그 없음"
                    note={mode === 'month' && cur.visitors !== null ? `일별 방문자 합, ${cur.siteDays}일치` : undefined}
                />
                <KpiCard
                    label="텔레그램 글당 조회"
                    channel="telegram"
                    icon={<Send size={14} />}
                    value={cur.tgAvgViews}
                    prev={prev?.tgAvgViews ?? null}
                    unit="회"
                    trend={trend((s) => s.tgAvgViews)}
                    emptyReason="조회 쌓인 글 3개 미만"
                    note={`글 ${cur.tgPosts}개${cur.tgFresh ? ` · 최근 ${cur.tgFresh}개 제외` : ''}`}
                />
                <KpiCard label="텔레그램 구독자" channel="telegram" icon={<Users size={14} />} value={cur.subscribers} prev={prev?.subscribers ?? null} unit="명" trend={trend((s) => s.subscribers)} emptyReason="구독자 기록 전" />
                <KpiCard
                    label="링크드인 노출"
                    channel="linkedin"
                    icon={<Eye size={14} />}
                    value={cur.liImpressions}
                    prev={prev?.liImpressions ?? null}
                    unit="회"
                    trend={trend((s) => s.liImpressions)}
                    emptyReason="기록 시작 전"
                    note={`글 ${cur.liPosts}개`}
                />
                <KpiCard
                    label="링크드인 참여율"
                    channel="linkedin"
                    icon={<Heart size={14} />}
                    value={cur.liEngagement}
                    prev={prev?.liEngagement ?? null}
                    unit="%"
                    deltaSuffix="%p"
                    trend={trend((s) => s.liEngagement)}
                    emptyReason="노출 기록 없음"
                    note="(반응+댓글) ÷ 노출"
                />
            </div>

            <TelegramSection data={data} cur={cur} period={sel} idx={idx} types={types} heat={heat} slot={slot} />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <SiteSection data={data} cur={cur} period={sel} idx={idx} />
                <LinkedInSection data={data} cur={cur} idx={idx} />
            </div>
        </div>
    );
};

const AdminStats: React.FC = () => {
    usePageMeta({ title: 'Stats', description: 'ECK 성과 대시보드', noindex: true });
    // /admin에서 로그인한 세션이면 비밀번호를 다시 묻지 않고 바로 연다
    const [load, setLoad] = useState<Load>(() => (sessionStorage.getItem('publishKey') ? { state: 'loading' } : { state: 'idle' }));

    const fetchInto = (pw: string) =>
        fetchStats(pw).then(
            (data) => {
                sessionStorage.setItem('publishKey', pw);
                setLoad({ state: 'ok', data });
            },
            (e: unknown) => {
                if (e instanceof Error && e.message.includes('비밀번호')) sessionStorage.removeItem('publishKey');
                setLoad({ state: 'error', message: e instanceof Error ? e.message : '불러오기 실패' });
            },
        );

    useEffect(() => {
        const saved = sessionStorage.getItem('publishKey');
        if (saved) void fetchInto(saved);
    }, []);

    const open = (pw: string) => {
        setLoad({ state: 'loading' });
        void fetchInto(pw);
    };

    return (
        <div className="min-h-screen pt-28 pb-20 px-4 md:px-6 container mx-auto">
            {load.state === 'ok' ? (
                <Dashboard data={load.data} />
            ) : (
                <LoginForm onSubmit={open} loading={load.state === 'loading'} error={load.state === 'error' ? load.message : undefined} />
            )}
        </div>
    );
};

export default AdminStats;
