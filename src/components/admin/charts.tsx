/**
 * 성과 대시보드용 가벼운 SVG 차트 (외부 라이브러리 없이). 색은 호출하는 쪽이 채널 색을 넘긴다.
 * 각 점·막대에 <title>을 달아 마우스를 올리면 값이 보인다.
 */
import React, { useId } from 'react';
import type { Ranked } from '../../types/adminStats';
import { DAY_LABELS, HOUR_BLOCKS, blockLabel, type Heat } from '../../utils/adminInsights';

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
  if (known.length < 3) return <div className="h-7" aria-hidden="true" />;
  const max = Math.max(1, ...known);
  const line = linePath(values, w, h, max);
  const firstIdx = values.findIndex((v) => v !== null);
  const lastIdx = values.length - 1 - [...values].reverse().findIndex((v) => v !== null);
  const step = (w - 4) / (values.length - 1);
  const area = `${line}L${(2 + lastIdx * step).toFixed(1)},${h}L${(2 + firstIdx * step).toFixed(1)},${h}Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none" role="img" aria-label={label}>
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

export interface TrendRow {
  key: string;
  label: string;
  bar: number | null;
  line: number | null;
  /** 진행 중이라 아직 다 차지 않은 기간 */
  partial?: boolean;
}

const tick = (count: number, every: number) => (i: number) => i === 0 || i === count - 1 || i % every === 0;

/** 기간별 추이: 막대(양, 왼쪽 축)와 선(질, 오른쪽 축). 선택한 기간을 진하게 */
export const TrendChart: React.FC<{ rows: TrendRow[]; color: string; barLabel: string; lineLabel: string; lineUnit?: string; selected?: string }> = ({
  rows,
  color,
  barLabel,
  lineLabel,
  lineUnit = '',
  selected,
}) => {
  if (!rows.length) return null;
  const w = 600;
  const h = 190;
  const top = 10;
  const bottom = h - 2;
  const maxBar = Math.max(1, ...rows.map((r) => r.bar ?? 0));
  const maxLine = Math.max(1, ...rows.map((r) => r.line ?? 0));
  const slot = w / rows.length;
  const bw = Math.min(28, slot * 0.6);
  const cx = (i: number) => slot * i + slot / 2;
  const ly = (v: number) => bottom - (v / maxLine) * (bottom - top);
  let d = '';
  let pen = false;
  rows.forEach((r, i) => {
    if (r.line === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${cx(i).toFixed(1)},${ly(r.line).toFixed(1)}`;
    pen = true;
  });
  const show = tick(rows.length, Math.ceil(rows.length / 6));
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-theme-text-muted">
        <span>
          {barLabel} 최고 {n(maxBar)}
        </span>
        <span>
          {lineLabel} 최고 {n(maxLine)}
          {lineUnit}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full" preserveAspectRatio="none" role="img" aria-label={`기간별 ${barLabel}와 ${lineLabel}`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={w} y1={top + (bottom - top) * f} y2={top + (bottom - top) * f} stroke="var(--border-primary)" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1="0" x2={w} y1={bottom} y2={bottom} stroke="var(--text-muted)" strokeOpacity="0.4" vectorEffect="non-scaling-stroke" />
        {rows.map((r, i) => {
          const bh = ((r.bar ?? 0) / maxBar) * (bottom - top) * 0.7;
          const on = selected === r.key;
          return (
            <g key={r.key}>
              <rect x={cx(i) - bw / 2} y={bottom - bh} width={bw} height={bh} rx="1.5" fill={color} opacity={on ? 0.55 : r.partial ? 0.12 : 0.22} />
              <rect x={slot * i} y="0" width={slot} height={h} fill="transparent">
                <title>{`${r.label}: ${barLabel} ${r.bar === null ? '–' : n(r.bar)} · ${lineLabel} ${r.line === null ? '–' : `${n(r.line)}${lineUnit}`}${r.partial ? ' (진행 중)' : ''}`}</title>
              </rect>
            </g>
          );
        })}
        <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative mt-1 h-4 text-[11px] text-theme-text-muted">
        {rows.map((r, i) =>
          show(i) ? (
            <span key={r.key} className={`absolute -translate-x-1/2 whitespace-nowrap ${selected === r.key ? 'font-semibold text-theme-text' : ''}`} style={{ left: `${(cx(i) / w) * 100}%` }}>
              {r.label}
            </span>
          ) : null,
        )}
      </div>
      <div className="mt-2 flex gap-4 text-[11px] text-theme-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color, opacity: 0.3 }} />
          {barLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded" style={{ background: color }} />
          {lineLabel}
        </span>
      </div>
    </div>
  );
};

export interface ScatterPoint {
  key: string;
  date: string;
  value: number;
  color: string;
  title: string;
}

/** 글 하나 = 점 하나. x는 날짜, y는 성과. 가운데 점선은 중앙값 */
export const Scatter: React.FC<{ points: ScatterPoint[]; unit: string; legend?: Array<[string, string]>; wide?: boolean }> = ({ points, unit, legend, wide }) => {
  if (points.length < 2) return <p className="text-sm text-theme-text-muted">점이 너무 적습니다</p>;
  // 넓은 자리는 가로로 길게 그려 높이가 과하게 커지지 않게 한다
  const w = wide ? 1200 : 600;
  const h = 240;
  const pad = 8;
  const ts = points.map((p) => Date.parse(p.date));
  const [t0, t1] = [Math.min(...ts), Math.max(...ts)];
  const vs = points.map((p) => p.value).sort((a, b) => a - b);
  const max = Math.max(2, vs.at(-1)!);
  // 갓 올라온 글(조회 몇 회)이 축을 끌어내리지 않게 아래 5%는 바닥에 붙인다
  const min = Math.max(1, vs[Math.floor(vs.length * 0.05)]);
  const median = vs[Math.floor(vs.length / 2)];
  // 한두 글이 크게 튀므로 로그 축으로 나머지 글의 차이도 보이게 한다
  const span = Math.log(max) - Math.log(min) || 1;
  const y = (v: number) => h - pad - ((Math.log(Math.max(v, min)) - Math.log(min)) / span) * (h - pad * 2);
  const x = (t: number) => pad + ((t - t0) / Math.max(1, t1 - t0)) * (w - pad * 2);
  const day = (t: number) => new Date(t + 9 * 3600e3).toISOString().slice(5, 10).replace('-', '.');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`글별 ${unit} 분포, 중앙값 ${n(median)}`}>
        <line x1="0" x2={w} y1={y(median)} y2={y(median)} stroke="var(--text-muted)" strokeDasharray="4 4" />
        <text x={2} y={y(median) - 5} fontSize="11" fill="var(--text-muted)">
          중앙값 {n(median)}
        </text>
        <text x={2} y={14} fontSize="11" fill="var(--text-muted)">
          {n(max)}
        </text>
        <text x={2} y={h - 4} fontSize="11" fill="var(--text-muted)">
          {n(min)}
        </text>
        {points.map((p, i) => (
          <circle key={p.key} cx={x(ts[i])} cy={y(p.value)} r="4" fill={p.color} fillOpacity="0.7" stroke="#fff" strokeWidth="1">
            <title>{`${p.title} · ${n(p.value)}${unit}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-theme-text-muted">
        <span>{day(t0)}</span>
        <span>{day(t1)}</span>
      </div>
      {legend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-theme-text-secondary">
          {legend.map(([label, c]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: c }} />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/** 누적 막대: 기간마다 항목별 몫 */
export const StackedBars: React.FC<{ rows: Array<{ key: string; label: string; parts: Ranked }>; colors: Record<string, string>; unit: string; selected?: string }> = ({ rows, colors, unit, selected }) => {
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((a, [, v]) => a + v, 0)));
  const names = Object.keys(colors);
  const show = tick(rows.length, Math.ceil(rows.length / 6));
  return (
    <div>
      <div className="flex h-44 items-end gap-1 border-b border-theme-border">
        {rows.map((r) => {
          const total = r.parts.reduce((a, [, v]) => a + v, 0);
          return (
            <div key={r.key} className="flex h-full flex-1 flex-col justify-end" title={`${r.label}: ${r.parts.map(([k, v]) => `${k} ${v}`).join(', ') || '없음'} (합 ${total}${unit})`}>
              <div className={`flex flex-col-reverse overflow-hidden rounded-t-sm ${selected === r.key ? '' : 'opacity-75'}`} style={{ height: `${(total / max) * 100}%` }}>
                {names.map((name) => {
                  const v = r.parts.find(([k]) => k === name)?.[1] ?? 0;
                  return v ? <div key={name} style={{ height: `${(v / total) * 100}%`, background: colors[name] }} /> : null;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1 text-[11px] text-theme-text-muted">
        {rows.map((r, i) => (
          <span key={r.key} className={`flex-1 whitespace-nowrap text-center ${selected === r.key ? 'font-semibold text-theme-text' : ''}`}>
            {show(i) ? r.label : ''}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-theme-text-secondary">
        {names.map((name) => (
          <span key={name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: colors[name] }} />
            {name}
          </span>
        ))}
      </div>
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
      <table className="w-full min-w-[18rem] border-separate border-spacing-1 text-[11px]" aria-describedby={describedBy}>
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
                    className={`h-9 rounded-md text-center tabular-nums ${isBest ? 'ring-2' : ''} ${strength > 55 ? 'text-white' : 'text-theme-text-secondary'}`}
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
