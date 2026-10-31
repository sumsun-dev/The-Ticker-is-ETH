/** 성과 대시보드 공용 블록·지표·목록. 밝은 업무용 화면: 카드 대신 여백과 가는 선으로 나눈다 */
import React, { useState } from 'react';
import { Sparkline } from './charts';
import { CHANNEL, n, type ChannelKey } from './theme';
import type { Fact, MemberRow } from '../../utils/adminInsights';

/** 탭 안의 차트·목록 하나. 테두리 없이 제목 줄만 */
export const Panel: React.FC<{ title: string; hint?: string; className?: string; children: React.ReactNode }> = ({ title, hint, className = '', children }) => (
  <section className={`min-w-0 ${className}`}>
    <header className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="text-[13.5px] font-semibold text-theme-text">{title}</h3>
      {hint && <span className="truncate text-xs text-theme-text-muted">{hint}</span>}
    </header>
    {children}
  </section>
);

/** 이전 기간 대비 증감. 비교할 수 없으면 이유를 흐리게 */
export const Delta: React.FC<{ cur: number | null; prev: number | null; reason?: string; suffix?: string }> = ({ cur, prev, reason = '비교 데이터 없음', suffix = '%' }) => {
  if (cur === null || prev === null || prev === 0) return <span className="text-theme-text-muted">{reason}</span>;
  const p = suffix === '%p' ? Math.round((cur - prev) * 10) / 10 : Math.round(((cur - prev) / prev) * 100);
  const cls = p > 0 ? 'text-green-700' : p < 0 ? 'text-orange-700' : 'text-theme-text-muted';
  return (
    <span className={`font-medium tabular-nums ${cls}`}>
      {p > 0 ? '+' : ''}
      {p}
      {suffix}
      <span className="sr-only"> 이전 기간 대비</span>
    </span>
  );
};

export interface Metric {
  label: string;
  value: number | null;
  prev: number | null;
  unit?: string;
  trend: Array<number | null>;
  deltaSuffix?: string;
  emptyReason?: string;
  note?: string;
  /** 누적 지표(글 수·방문자 등)는 진행 중인 기간을 다 끝난 기간과 비교하지 않는다 */
  cumulative?: boolean;
}

/** 채널 하나의 핵심 지표 묶음: 채널 이름 줄 아래에 지표 칸들 */
export const ChannelKpis: React.FC<{ channel: ChannelKey; metrics: Metric[]; ongoing?: boolean }> = ({ channel, metrics, ongoing }) => {
  const { color, label } = CHANNEL[channel];
  return (
    <section className="min-w-0 rounded-lg border border-theme-border" aria-label={`${label} 주요 성과`}>
      <h2 className="flex items-center gap-2 border-b border-theme-border px-[18px] py-2.5 text-[13px] font-semibold text-theme-text">
        <span className="h-2 w-2 rounded-sm" style={{ background: color }} aria-hidden="true" />
        {label}
      </h2>
      <div className="grid divide-x divide-theme-border" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
        {metrics.map((m) => (
          <div key={m.label} className="min-w-0 px-[18px] py-3.5" title={m.note}>
            <div className="truncate text-xs text-theme-text-secondary">{m.label}</div>
            <div className="mt-1 flex items-baseline gap-0.5">
              <span className="text-[22px] font-semibold tracking-tight tabular-nums text-theme-text">{m.value === null ? '–' : n(m.value)}</span>
              {m.value !== null && m.unit && <span className="text-xs text-theme-text-muted">{m.unit}</span>}
            </div>
            <div className="mt-0.5 truncate text-xs">
              {ongoing && m.cumulative && m.value !== null ? (
                <span className="text-theme-text-muted">진행 중</span>
              ) : (
                <Delta cur={m.value} prev={m.prev} suffix={m.deltaSuffix} reason={m.value === null ? (m.emptyReason ?? '데이터 없음') : '지난 기간 없음'} />
              )}
            </div>
            <div className="mt-2">
              <Sparkline values={m.trend} color={color} label={`${label} ${m.label} 최근 추이`} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

/** 작은 썸네일. 이미지가 없거나 깨지면 옅은 회색 칸 */
export const Thumb: React.FC<{ src: string | null; className?: string }> = ({ src, className = '' }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`shrink-0 overflow-hidden rounded bg-theme-bg-secondary ${className}`}>
      {src && !broken && <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-full w-full object-cover" />}
    </div>
  );
};

export interface MediaItem {
  key: string;
  href: string;
  title: string;
  image: string | null;
  value: string;
  valueLabel: string;
  meta?: string;
}

/** 썸네일 붙은 순위 목록: 한 줄 제목, 아래 메타, 오른쪽 값 */
export const MediaList: React.FC<{ items: MediaItem[]; empty: string }> = ({ items, empty }) => {
  if (!items.length) return <p className="text-sm text-theme-text-muted">{empty}</p>;
  return (
    <ol className="border-t border-theme-border">
      {items.map((it) => (
        <li key={it.key} className="border-b border-theme-border">
          <a href={it.href} target="_blank" rel="noreferrer" className="group flex items-center gap-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
            <Thumb src={it.image} className="h-[30px] w-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] text-theme-text group-hover:underline">{it.title}</p>
              {it.meta && <p className="truncate text-xs text-theme-text-muted">{it.meta}</p>}
            </div>
            <span className="text-[13.5px] tabular-nums text-theme-text">
              {it.value}
              <span className="sr-only"> {it.valueLabel}</span>
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
};

/** 기여자별 기여 표: 아바타, 글 수, 조회 합(막대), 글당 평균, 가장 많이 본 글 */
export const MemberTable: React.FC<{ rows: MemberRow[]; color: string; topHref: (id: number) => string }> = ({ rows, color, topHref }) => {
  if (!rows.length) return <p className="text-sm text-theme-text-muted">이 기간에 작성자가 확인된 글이 없습니다</p>;
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-[13.5px]">
        <thead>
          <tr className="border-b border-theme-border text-left text-xs text-theme-text-muted">
            <th scope="col" className="pb-2 font-medium">기여자</th>
            <th scope="col" className="pb-2 text-right font-medium">글</th>
            <th scope="col" className="w-[30%] pb-2 pl-8 font-medium">조회 합</th>
            <th scope="col" className="pb-2 text-right font-medium">글당 평균</th>
            <th scope="col" className="pb-2 pl-8 font-medium">가장 많이 본 글</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-theme-border">
              <td className="whitespace-nowrap py-2.5">
                <span className="flex items-center gap-2">
                  <Avatar name={r.name} src={r.avatar} />
                  <span className="text-theme-text">{r.name}</span>
                </span>
              </td>
              <td className="py-2.5 text-right tabular-nums text-theme-text">{r.posts}</td>
              <td className="py-2.5 pl-8">
                <span className="flex items-center gap-2.5">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-theme-bg-secondary" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${(r.views / max) * 100}%`, background: color }} />
                  </span>
                  <span className="w-12 text-right tabular-nums text-theme-text">{n(r.views)}</span>
                </span>
              </td>
              <td className="py-2.5 text-right tabular-nums text-theme-text">{r.avgViews === null ? '–' : n(r.avgViews)}</td>
              <td className="max-w-0 py-2.5 pl-8">
                <a href={topHref(r.top.id)} target="_blank" rel="noreferrer" className="block truncate text-theme-text-secondary hover:underline" title={r.top.text}>
                  {r.top.text.split('\n')[0] || '미디어 글'}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Avatar: React.FC<{ name: string; src: string }> = ({ name, src }) => {
  const [broken, setBroken] = useState(false);
  return src && !broken ? (
    <img src={src} alt="" onError={() => setBroken(true)} className="h-6 w-6 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-theme-bg-secondary text-[11px] font-semibold text-theme-text-secondary" aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
};

/** 탭 맨 위 수치 인사이트 칸들 */
export const FactGrid: React.FC<{ facts: Fact[] }> = ({ facts }) =>
  facts.length ? (
    <dl
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-theme-border bg-theme-border xl:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))] [&>*:last-child:nth-child(odd)]:col-span-2 xl:[&>*:last-child:nth-child(odd)]:col-span-1"
      style={{ ['--cols' as string]: facts.length }}
    >
      {facts.map((f) => (
        <div key={f.label} className="min-w-0 bg-theme-bg px-4 py-3">
          <dt className="truncate text-xs text-theme-text-muted">{f.label}</dt>
          <dd className={`mt-0.5 truncate text-lg font-semibold tabular-nums ${f.tone === 'up' ? 'text-green-700' : f.tone === 'down' ? 'text-orange-700' : 'text-theme-text'}`}>{f.value}</dd>
          <dd className="mt-0.5 text-xs leading-snug text-theme-text-secondary">{f.detail}</dd>
        </div>
      ))}
    </dl>
  ) : null;

export interface Column<T> {
  label: string;
  get: (row: T) => number | null;
  format?: (v: number) => string;
}

/** 기간별 비교 표: 행 = 기간(최신이 위), 열 = 지표. 칸 뒤에 열 최댓값 대비 옅은 막대 */
export function PeriodTable<T>({ rows, columns, color, selected }: { rows: Array<{ key: string; label: string; partial?: boolean; data: T }>; columns: Array<Column<T>>; color: string; selected?: string }) {
  const max = columns.map((c) => Math.max(1, ...rows.map((r) => c.get(r.data) ?? 0)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-[13px]">
        <thead>
          <tr className="border-b border-theme-border text-xs text-theme-text-muted">
            <th scope="col" className="pb-2 text-left font-medium">기간</th>
            {columns.map((c) => (
              <th key={c.label} scope="col" className="pb-2 pl-4 text-right font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={`border-b border-theme-border ${r.key === selected ? 'bg-theme-bg-secondary font-semibold' : ''}`}>
              <th scope="row" className="whitespace-nowrap py-1.5 text-left font-normal text-theme-text-secondary">
                {r.label}
                {r.partial && <span className="ml-1 text-[11px] text-theme-text-muted">진행 중</span>}
              </th>
              {columns.map((c, i) => {
                const v = c.get(r.data);
                return (
                  <td key={c.label} className="relative py-1.5 pl-4 text-right tabular-nums text-theme-text">
                    {v !== null && <span className="absolute inset-y-1 right-0 rounded-sm" style={{ width: `${(v / max[i]) * 70}%`, background: color, opacity: 0.1 }} aria-hidden="true" />}
                    <span className="relative">{v === null ? '–' : (c.format ?? n)(v)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
