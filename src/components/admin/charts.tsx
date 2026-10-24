/**
 * 성과 대시보드용 가벼운 SVG 차트 (외부 라이브러리 없이). 색은 호출하는 쪽이 채널 색을 넘긴다.
 * 각 점·막대에 <title>을 달아 마우스를 올리면 값이 보인다.
 */
import React, { useId } from 'react';
import type { Ranked } from '../../types/adminStats';
import { DAY_LABELS, HOUR_BLOCKS, blockLabel, type Heat, type MonthRow } from '../../utils/adminInsights';

const n = (x: number) => x.toLocaleString('en-US');

/** 0~1 범위 좌표로 바꾼 선 (null은 끊는다) */
function linePath(values: Array<number | null>, w: number, h: number, max: number, pad = 2): string {
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });
  return d;
}

/** KPI 카드 안의 작은 추이선 */
export const Sparkline: React.FC<{ values: Array<number | null>; color: string; label: string }> = ({ values, color, label }) => {
  const id = useId();
  const w = 120;
  const h = 36;
  const known = values.filter((v): v is number => v !== null);
  // 점 두 개로는 추이라 하기 어렵다
  if (known.length < 3) return <div className="h-9" aria-hidden="true" />;
  const max = Math.max(1, ...known);
  const line = linePath(values, w, h, max);
  const firstIdx = values.findIndex((v) => v !== null);
  const lastIdx = values.length - 1 - [...values].reverse().findIndex((v) => v !== null);
  const step = (w - 4) / (values.length - 1);
  const area = `${line}L${(2 + lastIdx * step).toFixed(1)},${h}L${(2 + firstIdx * step).toFixed(1)},${h}Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {!line.slice(1).includes('M') && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/** 일별 방문자 같은 시계열. key는 고유값(날짜), label은 표시용. highlight 구간(선택한 기간)을 밝게 칠한다 */
export const AreaChart: React.FC<{
  points: Array<{ key: string; label: string; value: number }>;
  color: string;
  highlight?: (key: string) => boolean;
  unit?: string;
}> = ({ points, color, highlight, unit = '' }) => {
  const id = useId();
  const w = 600;
  const h = 160;
  if (!points.length) return null;
  const max = Math.max(1, ...points.map((p) => p.value));
  const values = points.map((p) => p.value);
  const step = points.length > 1 ? (w - 4) / (points.length - 1) : 0;
  const line = linePath(values, w, h, max);
  const area = `${line}L${(2 + (points.length - 1) * step).toFixed(1)},${h}L2,${h}Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label={`${points[0].label}부터 ${points.at(-1)!.label}까지 추이`}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="currentColor" className="text-theme-border" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        ))}
        {highlight &&
          points.map((p, i) => (highlight(p.key) ? <rect key={p.key} x={Math.max(0, 2 + i * step - step / 2)} y="0" width={Math.max(step, 2)} height={h} fill={color} opacity="0.08" /> : null))}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={p.key} cx={2 + i * step} cy={h - 2 - (p.value / max) * (h - 4)} r={highlight?.(p.key) ? 3.5 : 0} fill={color}>
            <title>{`${p.label}: ${n(p.value)}${unit}`}</title>
          </circle>
        ))}
        {/* 마우스 올림 영역 */}
        {points.map((p, i) => (
          <rect key={`hit-${p.key}`} x={Math.max(0, 2 + i * step - step / 2)} y="0" width={Math.max(step, 2)} height={h} fill="transparent">
            <title>{`${p.label}: ${n(p.value)}${unit}`}</title>
          </rect>
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-theme-text-muted">
        <span>{points[0].label}</span>
        <span>최고 {n(max)}{unit}</span>
        <span>{points.at(-1)!.label}</span>
      </div>
    </div>
  );
};

/** 텔레그램 월별: 막대 = 글 수, 선 = 글당 평균 조회 */
export const ComboChart: React.FC<{ rows: MonthRow[]; barColor: string; lineColor: string; selected?: string }> = ({ rows, barColor, lineColor, selected }) => {
  const w = 600;
  const h = 180;
  if (!rows.length) return null;
  const maxPosts = Math.max(1, ...rows.map((r) => r.posts));
  const maxAvg = Math.max(1, ...rows.map((r) => r.avgViews));
  const slot = (w - 4) / rows.length;
  const bw = slot * 0.6;
  const cx = (i: number) => 2 + slot * i + slot / 2;
  const line = rows.map((r, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${(h - 4 - (r.avgViews / maxAvg) * (h - 16)).toFixed(1)}`).join('');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full" preserveAspectRatio="none" role="img" aria-label="월별 텔레그램 글 수와 글당 평균 조회">
        {rows.map((r, i) => {
          const bh = (r.posts / maxPosts) * (h * 0.55);
          return (
            <rect key={r.month} x={cx(i) - bw / 2} y={h - bh} width={bw} height={bh} rx="2" fill={barColor} opacity={selected === r.month ? 0.9 : r.partial ? 0.25 : 0.45}>
              <title>{`${r.month}: 글 ${r.posts}개 · 글당 ${n(r.avgViews)}회${r.partial ? ' (조회 쌓이는 중)' : ''}`}</title>
            </rect>
          );
        })}
        <path d={line} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {rows.map((r, i) => (
          <circle key={`p-${r.month}`} cx={cx(i)} cy={h - 4 - (r.avgViews / maxAvg) * (h - 16)} r={selected === r.month ? 4 : 2.5} fill={lineColor} opacity={r.partial ? 0.5 : 1}>
            <title>{`${r.month}: 글당 평균 ${n(r.avgViews)}회`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11px] text-theme-text-muted">
        <span>{rows[0].month.replace('-', '.')}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: barColor, opacity: 0.6 }} />글 수
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 rounded" style={{ background: lineColor }} />글당 평균 조회
          </span>
        </span>
        <span>{rows.at(-1)!.month.replace('-', '.')}</span>
      </div>
    </div>
  );
};

/** 비중 도넛과 범례 */
export const Donut: React.FC<{ rows: Ranked; colors: string[]; centerLabel: string }> = ({ rows, colors, centerLabel }) => {
  const total = rows.reduce((a, [, v]) => a + v, 0);
  if (!total) return null;
  const r = 40;
  const c = 2 * Math.PI * r;
  // 조각마다 시작 위치를 미리 계산한다 (렌더 중에 변수를 바꾸지 않게)
  const arcs = rows.map(([label, v], i) => {
    const before = rows.slice(0, i).reduce((a, [, x]) => a + x, 0);
    return { label, v, len: (v / total) * c, start: (before / total) * c };
  });
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90" role="img" aria-label={centerLabel}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" className="text-theme-border" strokeWidth="12" opacity="0.4" />
        {arcs.map(({ label, v, len, start }, i) => (
          <circle key={label} cx="50" cy="50" r={r} fill="none" stroke={colors[i % colors.length]} strokeWidth="12" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-start}>
            <title>{`${label}: ${n(v)} (${Math.round((v / total) * 100)}%)`}</title>
          </circle>
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {rows.map(([label, v], i) => (
          <li key={label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} />
            <span className="truncate text-theme-text">{label}</span>
            <span className="ml-auto tabular-nums text-theme-text-muted">{Math.round((v / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** 가로 막대 순위 */
export const HBars: React.FC<{ rows: Ranked; color: string; total?: number; labelWidth?: string }> = ({ rows, color, total, labelWidth = '6.5rem' }) => {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <ul className="space-y-2.5">
      {rows.map(([label, v]) => (
        <li key={label} className="grid items-center gap-3 text-sm" style={{ gridTemplateColumns: `${labelWidth} minmax(0,1fr) auto` }}>
          <span className="truncate text-theme-text" title={label}>
            {label}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-theme-border/40">
            <span className="block h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: color }} />
          </span>
          <span className="tabular-nums text-theme-text-muted">
            {n(v)}
            {total ? <span className="ml-1 text-[11px]">{Math.round((v / total) * 100)}%</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
};

/** 글이 이보다 적은 칸은 우연에 좌우되니 색을 칠하지 않는다 */
const HEAT_MIN_POSTS = 3;

/** 요일 × 시간대 조회 중앙값 히트맵. describedBy로 표 아래 요약 문장을 잇는다 */
export const Heatmap: React.FC<{ heat: Heat; color: string; best?: { day: number; block: number } | null; describedBy?: string }> = ({ heat, color, best, describedBy }) => {
  const max = Math.max(1, ...heat.flat().map((c) => (c.posts >= HEAT_MIN_POSTS ? (c.medianViews ?? 0) : 0)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] border-separate border-spacing-1 text-[11px]" aria-describedby={describedBy}>
        <caption className="sr-only">요일·시간대별 텔레그램 조회 중앙값 (글 {HEAT_MIN_POSTS}개 이상인 칸만 표시)</caption>
        <thead>
          <tr>
            <th className="w-6" />
            {Array.from({ length: HOUR_BLOCKS }, (_, b) => (
              <th key={b} scope="col" className="font-normal text-theme-text-muted">
                {blockLabel(b)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heat.map((row, d) => (
            <tr key={d}>
              <th scope="row" className="pr-1 text-right font-normal text-theme-text-muted">
                {DAY_LABELS[d]}
              </th>
              {row.map((c, b) => {
                const isBest = best?.day === d && best.block === b;
                const shown = c.medianViews !== null && c.posts >= HEAT_MIN_POSTS;
                const strength = shown ? Math.round(15 + 85 * ((c.medianViews as number) / max)) : 0;
                return (
                  <td
                    key={b}
                    title={`${DAY_LABELS[d]} ${blockLabel(b)}: ${c.medianViews === null ? '글 없음' : `보통 ${n(c.medianViews)}회 (글 ${c.posts}개)`}`}
                    className={`h-8 rounded-md text-center tabular-nums ${isBest ? 'ring-2' : ''} ${strength > 55 ? 'text-white' : 'text-theme-text-secondary'}`}
                    style={{
                      background: shown ? `color-mix(in srgb, ${color} ${strength}%, transparent)` : c.posts ? 'color-mix(in srgb, var(--border-primary) 40%, transparent)' : 'transparent',
                      outline: c.medianViews === null ? '1px dashed var(--border-primary)' : undefined,
                      ['--tw-ring-color' as string]: color,
                    }}
                  >
                    {shown ? n(c.medianViews as number) : ''}
                    {isBest && <span className="sr-only"> (가장 좋은 칸)</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
