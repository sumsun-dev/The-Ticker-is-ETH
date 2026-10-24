/** 성과 대시보드 공용 카드·지표·목록 */
import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Sparkline } from './charts';
import { CHANNEL, n, type ChannelKey } from './theme';

export const Card: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, accent, className = '', children }) => (
  <section className={`relative min-w-0 overflow-hidden rounded-3xl border border-theme-border bg-theme-surface p-5 md:p-6 ${className}`}>
    {accent && <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />}
    <header className="mb-5 flex items-start gap-3">
      {icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: accent ? `color-mix(in srgb, ${accent} 16%, transparent)` : undefined, color: accent }}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <h2 className="text-base font-bold text-theme-text">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-theme-text-muted">{subtitle}</p>}
      </div>
    </header>
    {children}
  </section>
);

/** 이전 기간 대비 증감 알약. 비교할 수 없으면 이유를 보여 준다 */
export const Delta: React.FC<{ cur: number | null; prev: number | null; reason?: string; suffix?: string }> = ({ cur, prev, reason = '비교 데이터 없음', suffix = '%' }) => {
  if (cur === null || prev === null || prev === 0) return <span className="text-[11px] text-theme-text-muted">{reason}</span>;
  const p = suffix === '%p' ? Math.round((cur - prev) * 10) / 10 : Math.round(((cur - prev) / prev) * 100);
  const Icon = p > 0 ? ArrowUpRight : p < 0 ? ArrowDownRight : Minus;
  const cls = p > 0 ? 'bg-emerald-500/15 text-emerald-400' : p < 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-theme-border/40 text-theme-text-muted';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cls}`}>
      <Icon size={12} aria-hidden="true" />
      {p > 0 ? '+' : ''}
      {p}
      {suffix}
      <span className="sr-only"> 이전 기간 대비</span>
    </span>
  );
};

export const KpiCard: React.FC<{
  label: string;
  value: number | null;
  prev: number | null;
  channel: ChannelKey;
  icon: React.ReactNode;
  unit?: string;
  note?: string;
  trend: Array<number | null>;
  deltaSuffix?: string;
  emptyReason?: string;
}> = ({ label, value, prev, channel, icon, unit = '', note, trend, deltaSuffix, emptyReason }) => {
  const { color } = CHANNEL[channel];
  return (
    <div className="relative min-w-0 overflow-hidden rounded-3xl border border-theme-border bg-theme-surface p-5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl" style={{ background: color, opacity: 0.18 }} />
      <div className="flex items-center gap-2 text-xs font-medium text-theme-text-muted">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums text-theme-text">{value === null ? '–' : n(value)}</span>
        {value !== null && unit && <span className="text-sm text-theme-text-muted">{unit}</span>}
      </div>
      <div className="mt-1.5 min-h-[1.25rem]">
        <Delta cur={value} prev={prev} suffix={deltaSuffix} reason={value === null ? (emptyReason ?? '이 기간 데이터 없음') : '이전 기간 데이터 없음'} />
      </div>
      <div className="mt-3">
        <Sparkline values={trend} color={color} label={`${label} 최근 추이`} />
      </div>
      {note && <p className="mt-2 text-[11px] leading-snug text-theme-text-muted">{note}</p>}
    </div>
  );
};

/** 썸네일. 이미지가 없거나 깨지면 채널 색 그라데이션 위에 아이콘 */
export const Thumb: React.FC<{ src: string | null; color: string; icon: React.ReactNode; className?: string }> = ({ src, color, icon, className = '' }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-theme-bg ${className}`}>
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-white/90" style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 35%, #050508))` }}>
          {icon}
        </div>
      )}
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
  badge?: string;
}

/** 썸네일이 붙은 순위 목록. 1위는 크게 */
export const MediaList: React.FC<{ items: MediaItem[]; color: string; icon: React.ReactNode; empty: string }> = ({ items, color, icon, empty }) => {
  if (!items.length) return <p className="text-sm text-theme-text-muted">{empty}</p>;
  const [first, ...rest] = items;
  return (
    <div className="space-y-4">
      <a href={first.href} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-2xl border border-theme-border bg-theme-bg/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
        {first.image ? (
          <Thumb key={first.key} src={first.image} color={color} icon={icon} className="aspect-[16/9] w-full rounded-none" />
        ) : (
          // 이미지 없는 글은 본문 첫머리를 표지처럼 보여 준다
          <div className="relative flex aspect-[16/9] w-full flex-col justify-between overflow-hidden p-6" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${color} 55%, #050508), #0a0a12 70%)` }}>
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl" style={{ background: color, opacity: 0.35 }} />
            <span className="relative text-white/80">{icon}</span>
            <p aria-hidden="true" className="relative line-clamp-4 text-lg font-bold leading-snug text-white md:text-xl">
              {first.title}
            </p>
          </div>
        )}
        <div className="flex items-start gap-3 p-4">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: color }}>
            1
          </span>
          <div className="min-w-0 flex-1">
            {/* 표지 카드에 이미 제목이 크게 있으면 다시 쓰지 않는다 (스크린리더용으로만 남김) */}
            <p className={first.image ? 'line-clamp-2 text-sm font-semibold leading-snug text-theme-text group-hover:text-brand-accent' : 'sr-only'}>{first.title}</p>
            {(first.meta || first.badge) && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-theme-text-muted">
                {first.badge && <span className="rounded-full border border-theme-border px-1.5 py-px">{first.badge}</span>}
                {first.meta}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-lg font-bold tabular-nums text-theme-text">{first.value}</div>
            <div className="text-[10px] text-theme-text-muted">{first.valueLabel}</div>
          </div>
        </div>
      </a>
      {rest.length > 0 && (
        <ol className="space-y-2.5">
          {rest.map((it, i) => (
            <li key={it.key}>
              <a href={it.href} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl p-1 hover:bg-theme-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
                <span className="w-4 text-center text-xs tabular-nums text-theme-text-muted">{i + 2}</span>
                <Thumb src={it.image} color={color} icon={icon} className="h-11 w-16" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-theme-text group-hover:text-brand-accent">{it.title}</p>
                  {(it.meta || it.badge) && (
                    <p className="truncate text-[11px] text-theme-text-muted">
                      {it.badge && <span className="mr-1.5">{it.badge}</span>}
                      {it.meta}
                    </p>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums text-theme-text">{it.value}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
