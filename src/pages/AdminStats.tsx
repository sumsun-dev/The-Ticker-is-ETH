import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Loader2, Globe, Send, Briefcase, Bot } from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';
import type { Ranked, StatsHistory } from '../types/adminStats';
import { periods, summarize, kstDate, type Mode, type Period, type Summary } from '../utils/adminStats';

const SITE = 'https://ethcollective.xyz';
const n = (x: number) => x.toLocaleString('en-US');
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

/* ── 작은 구성 요소 ─────────────────────────────────────────────── */

const Card: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, children, className = '' }) => (
    <section className={`min-w-0 bg-theme-surface border border-theme-border rounded-2xl p-5 md:p-6 ${className}`}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-theme-text-muted uppercase tracking-wide mb-5">
            {icon}
            {title}
        </h2>
        {children}
    </section>
);

const Delta: React.FC<{ cur: number | null; prev: number | null }> = ({ cur, prev }) => {
    if (cur === null || prev === null || prev === 0) return <span className="text-theme-text-muted text-xs">비교 없음</span>;
    const pct = Math.round(((cur - prev) / prev) * 100);
    const cls = pct > 0 ? 'text-green-500' : pct < 0 ? 'text-red-400' : 'text-theme-text-muted';
    return <span className={`text-xs font-medium ${cls}`}>{pct > 0 ? '▲' : pct < 0 ? '▼' : ''}{Math.abs(pct)}% <span className="text-theme-text-muted font-normal">이전 대비</span></span>;
};

const Kpi: React.FC<{ label: string; value: number | null; prev: number | null; note?: string }> = ({ label, value, prev, note }) => (
    <div className="min-w-0 bg-theme-surface border border-theme-border rounded-2xl p-5">
        <div className="text-sm text-theme-text-muted mb-2">{label}</div>
        <div className="text-3xl font-bold text-theme-text tabular-nums mb-1">{value === null ? '-' : n(value)}</div>
        <Delta cur={value} prev={prev} />
        {note && <div className="text-[11px] text-theme-text-muted mt-2">{note}</div>}
    </div>
);

/** 기간별 막대 추이. 막대를 누르면 그 기간을 고른다 */
const Trend: React.FC<{ title: string; points: Array<{ key: string; label: string; value: number | null }>; selected: string; onSelect: (k: string) => void }> = ({ title, points, selected, onSelect }) => {
    const max = Math.max(1, ...points.map((p) => p.value ?? 0));
    return (
        <div>
            <div className="text-sm text-theme-text-muted mb-3">{title}</div>
            <div className="flex items-end gap-1.5 h-32">
                {points.map((p) => (
                    <button
                        key={p.key}
                        onClick={() => onSelect(p.key)}
                        title={`${p.label}: ${p.value === null ? '데이터 없음' : n(p.value)}`}
                        aria-label={`${p.label} ${p.value ?? '데이터 없음'}`}
                        className="flex-1 h-full flex flex-col justify-end group"
                    >
                        <div
                            className={`w-full rounded-t-md transition-colors ${p.key === selected ? 'bg-brand-accent' : p.value === null ? 'bg-theme-border/40' : 'bg-brand-primary/40 group-hover:bg-brand-primary/70'}`}
                            style={{ height: `${p.value === null ? 4 : Math.max(4, ((p.value ?? 0) / max) * 100)}%` }}
                        />
                    </button>
                ))}
            </div>
            <div className="flex justify-between text-[11px] text-theme-text-muted mt-2">
                <span>{points[0]?.label}</span>
                <span>{points.at(-1)?.label}</span>
            </div>
        </div>
    );
};

const Bars: React.FC<{ rows: Ranked; total?: number }> = ({ rows, total }) => {
    const max = Math.max(1, ...rows.map(([, v]) => v));
    return (
        <ul className="space-y-2">
            {rows.map(([label, v]) => (
                <li key={label} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] md:grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                    <span className="truncate text-theme-text">{label}</span>
                    <span className="h-2 rounded-full bg-theme-border/40 overflow-hidden">
                        <span className="block h-full rounded-full bg-brand-accent" style={{ width: `${(v / max) * 100}%` }} />
                    </span>
                    <span className="tabular-nums text-theme-text-muted">
                        {n(v)}
                        {total ? ` (${Math.round((v / total) * 100)}%)` : ''}
                    </span>
                </li>
            ))}
        </ul>
    );
};

const TopList: React.FC<{ items: Array<{ key: string; href: string; title: string; value: string; meta?: string }>; empty: string }> = ({ items, empty }) =>
    items.length ? (
        <ol className="space-y-3">
            {items.map((it, i) => (
                <li key={it.key} className="flex gap-3 text-sm">
                    <span className="text-theme-text-muted tabular-nums w-4">{i + 1}</span>
                    <a href={it.href} target="_blank" rel="noreferrer" className="flex-1 min-w-0 text-theme-text hover:text-brand-accent truncate">
                        {it.title}
                    </a>
                    <span className="tabular-nums font-semibold text-theme-text">{it.value}</span>
                    {it.meta && <span className="text-theme-text-muted text-xs whitespace-nowrap">{it.meta}</span>}
                </li>
            ))}
        </ol>
    ) : (
        <p className="text-sm text-theme-text-muted">{empty}</p>
    );

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

const Dashboard: React.FC<{ data: StatsHistory }> = ({ data }) => {
    const [mode, setMode] = useState<Mode>('week');
    const list = useMemo(() => periods(data, mode, todayKst()), [data, mode]);
    const [selected, setSelected] = useState<string>('');
    const sel = list.find((p) => p.key === selected) ?? list[0];
    const idx = sel ? list.indexOf(sel) : -1;
    const sums = useMemo(() => new Map(list.map((p) => [p.key, summarize(data, p)])), [data, list]);
    if (!sel) return <p className="text-center text-theme-text-muted">표시할 기간이 없습니다.</p>;
    const cur = sums.get(sel.key) as Summary;
    const prev = list[idx + 1] ? (sums.get(list[idx + 1].key) as Summary) : null;
    const trend = (f: (s: Summary) => number | null) => [...list].slice(0, 12).reverse().map((p: Period) => ({ key: p.key, label: p.label, value: f(sums.get(p.key) as Summary) }));
    const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-';
    const dow = ['월', '화', '수', '목', '금', '토', '일'];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-theme-text">성과 대시보드</h1>
                    <p className="text-sm text-theme-text-muted mt-2">마지막 수집 {updated} · 매주 월요일 09:00 갱신</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="inline-flex bg-theme-surface border border-theme-border rounded-full p-1" role="tablist">
                        {(['week', 'month'] as const).map((m) => (
                            <button
                                key={m}
                                role="tab"
                                aria-selected={mode === m}
                                onClick={() => {
                                    setMode(m);
                                    setSelected('');
                                }}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === m ? 'bg-brand-primary text-white' : 'text-theme-text-muted hover:text-theme-text'}`}
                            >
                                {m === 'week' ? '주별' : '월별'}
                            </button>
                        ))}
                    </div>
                    <select
                        value={sel.key}
                        onChange={(e) => setSelected(e.target.value)}
                        aria-label="기간 선택"
                        className="bg-theme-surface border border-theme-border rounded-full px-4 py-2 text-sm text-theme-text"
                    >
                        {list.map((p) => (
                            <option key={p.key} value={p.key} className="bg-theme-bg">
                                {mode === 'week' ? `${p.start.slice(5).replace('-', '.')} ~ ${p.end.slice(5).replace('-', '.')}` : p.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Kpi label="홈페이지 방문자" value={cur.visitors} prev={prev?.visitors ?? null} note={mode === 'month' && cur.visitors !== null ? `일별 방문자 합, ${cur.siteDays}일치 로그` : undefined} />
                <Kpi label="텔레그램 조회" value={cur.tgViews} prev={prev?.tgViews ?? null} note={`글 ${cur.tgPosts}개 누적 조회`} />
                <Kpi label="텔레그램 구독자" value={cur.subscribers} prev={prev?.subscribers ?? null} />
                <Kpi label="링크드인 노출" value={cur.liImpressions} prev={prev?.liImpressions ?? null} note={`글 ${cur.liPosts}개`} />
                <Kpi label="링크드인 팔로워" value={cur.followers} prev={prev?.followers ?? null} />
            </div>

            <Card title={mode === 'week' ? '최근 12주 추이' : '최근 12개월 추이'}>
                <div className="grid md:grid-cols-3 gap-8">
                    <Trend title="홈페이지 방문자" points={trend((s) => s.visitors)} selected={sel.key} onSelect={setSelected} />
                    <Trend title="텔레그램 조회" points={trend((s) => s.tgViews)} selected={sel.key} onSelect={setSelected} />
                    <Trend title="링크드인 노출" points={trend((s) => s.liImpressions)} selected={sel.key} onSelect={setSelected} />
                </div>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
                <Card title="홈페이지" icon={<Globe size={16} />}>
                    {cur.site ? (
                        <div className="space-y-6">
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-theme-text-muted">
                                <span>첫 진입 <b className="text-theme-text">{cur.pageLoads === null ? '-' : n(cur.pageLoads)}</b>회</span>
                                {cur.site.newVisitors !== undefined && cur.visitors !== null && (
                                    <span>신규 <b className="text-theme-text">{n(cur.site.newVisitors)}</b> · 재방문 <b className="text-theme-text">{n(cur.visitors - cur.site.newVisitors)}</b></span>
                                )}
                                {cur.site.mobilePct !== undefined && <span>모바일 <b className="text-theme-text">{cur.site.mobilePct}%</b></span>}
                            </div>
                            {cur.site.daily && (
                                <div>
                                    <h3 className="text-sm text-theme-text-muted mb-3">요일별 방문자</h3>
                                    <Bars rows={cur.site.daily.map(([, v], i) => [dow[i], v])} />
                                </div>
                            )}
                            <div>
                                <h3 className="text-sm text-theme-text-muted mb-3">유입 경로</h3>
                                <Bars rows={cur.site.sources} total={cur.site.sources.reduce((a, [, v]) => a + v, 0)} />
                                {cur.site.refHosts.length > 0 && <p className="text-xs text-theme-text-muted mt-3">외부 사이트: {cur.site.refHosts.map(([h, c]) => `${h} ${c}`).join(', ')}</p>}
                            </div>
                            <div>
                                <h3 className="text-sm text-theme-text-muted mb-3">분야별 첫 진입</h3>
                                <Bars rows={cur.site.sections.slice(0, 8)} />
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-theme-text-muted">이 기간의 홈페이지 상세 기록이 없습니다. 서버 로그는 14일만 남아 있어, 기록은 2026년 10월부터 쌓입니다.</p>
                    )}
                </Card>

                <div className="space-y-6 min-w-0">
                    <Card title="많이 들어온 페이지" icon={<Globe size={16} />}>
                        <TopList
                            items={(cur.site?.topPages ?? []).map(([p, c]) => ({ key: p, href: SITE + p, title: cur.titles[p] ?? (p === '/' ? '홈' : p), value: n(c) }))}
                            empty="기록 없음"
                        />
                    </Card>
                    <Card title="텔레그램 많이 본 글" icon={<Send size={16} />}>
                        <TopList
                            items={cur.topTg.map((x) => ({ key: String(x.id), href: `https://t.me/${data.channel}/${x.id}`, title: x.text || '미디어 글', value: n(x.views) }))}
                            empty="이 기간에 올린 글이 없습니다"
                        />
                    </Card>
                    <Card title="링크드인 노출 많은 글" icon={<Briefcase size={16} />}>
                        <TopList
                            items={cur.topLi.map((x) => ({ key: x.urn, href: `https://www.linkedin.com/feed/update/${x.urn}/`, title: x.title, value: n(x.impressions), meta: `반응 ${x.reactions} · 댓글 ${x.comments}` }))}
                            empty="이 기간의 링크드인 기록이 없습니다"
                        />
                        <p className="text-xs text-theme-text-muted mt-4">
                            반응 {n(cur.liReactions)} · 댓글 {n(cur.liComments)} (자동 게시가 다는 링크 댓글 제외)
                        </p>
                    </Card>
                </div>
            </div>

            {cur.site && (
                <Card title="크롤러" icon={<Bot size={16} />}>
                    <p className="text-sm text-theme-text-muted mb-4">
                        검색엔진 <b className="text-theme-text">{n(cur.site.bots.search)}</b>회 · AI <b className="text-theme-text">{n(cur.site.bots.ai.reduce((a, [, v]) => a + v, 0))}</b>회 요청
                    </p>
                    <Bars rows={cur.site.bots.ai} />
                </Card>
            )}
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
