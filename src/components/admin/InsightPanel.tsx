/** 성과 대시보드 맨 위: AI 분석(있으면)과 숫자로 짚은 포인트 */
import React from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Info, Sparkles } from 'lucide-react';
import type { AiInsight } from '../../types/adminStats';
import type { Insight } from '../../utils/adminInsights';
import { CHANNEL } from './theme';

const toneIcon = (tone: string) =>
  tone === 'up' ? <ArrowUpRight size={14} className="text-emerald-400" aria-label="상승" /> : tone === 'down' ? <ArrowDownRight size={14} className="text-rose-400" aria-label="하락" /> : <Info size={14} className="text-theme-text-muted" aria-hidden="true" />;

const ChannelDot: React.FC<{ channel: keyof typeof CHANNEL }> = ({ channel }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: CHANNEL[channel].color }}>
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: CHANNEL[channel].color }} />
    {CHANNEL[channel].label}
  </span>
);

const AiBlock: React.FC<{ ai: AiInsight }> = ({ ai }) => {
  const when = new Date(ai.generatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-snug text-theme-text md:text-[1.7rem]">{ai.headline}</h2>
        <p className="mt-3 max-w-4xl leading-relaxed text-theme-text-secondary">{ai.summary}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ai.highlights.map((x, i) => (
          <article key={i} className="rounded-2xl border border-theme-border bg-theme-bg/50 p-4">
            <div className="flex items-center justify-between">
              <ChannelDot channel={x.channel} />
              {toneIcon(x.tone)}
            </div>
            <h3 className="mt-2 font-semibold text-theme-text">{x.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-theme-text-secondary">{x.detail}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <h3 className="mb-3 text-sm font-bold text-theme-text">다음에 할 일</h3>
          <ul className="space-y-2">
            {ai.actions.map((a, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-theme-text-secondary">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden="true" />
                {a}
              </li>
            ))}
          </ul>
        </div>
        {ai.caveats.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-bold text-theme-text">해석할 때 주의</h3>
            <ul className="space-y-2">
              {ai.caveats.map((c, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-theme-text-muted">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="text-[11px] text-theme-text-muted">
        {when} 생성 · {ai.model} · 대시보드와 같은 집계만 근거로 썼습니다
      </p>
    </div>
  );
};

const RuleList: React.FC<{ items: Insight[] }> = ({ items }) => (
  <ul className="grid gap-2.5 md:grid-cols-2">
    {items.map((x, i) => (
      <li key={i} className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm leading-snug ${x.tone === 'caveat' ? 'text-theme-text-muted' : 'bg-theme-bg/40 text-theme-text-secondary'}`}>
        <span className="mt-0.5 shrink-0">{x.tone === 'caveat' ? <AlertTriangle size={14} className="text-amber-400" aria-hidden="true" /> : toneIcon(x.tone)}</span>
        <span>
          <span className="mr-1.5 font-semibold" style={{ color: CHANNEL[x.channel].color }}>
            {CHANNEL[x.channel].label}
          </span>
          {x.text}
        </span>
      </li>
    ))}
  </ul>
);

const InsightPanel: React.FC<{ ai: AiInsight | null; rules: Insight[]; periodLabel: string }> = ({ ai, rules, periodLabel }) => (
  <section aria-label="인사이트" className="relative overflow-hidden rounded-[2rem] border border-brand-accent/30 bg-theme-surface p-6 md:p-8">
    <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-primary/25 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-32 right-0 h-72 w-96 rounded-full bg-eth-purple/15 blur-3xl" />
    <div className="relative">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-primary to-eth-purple px-3 py-1 text-xs font-bold text-white">
          <Sparkles size={13} aria-hidden="true" /> {ai ? 'AI 분석' : '자동 인사이트'}
        </span>
        <span className="text-xs text-theme-text-muted">{periodLabel}</span>
      </div>
      {ai ? (
        <>
          <AiBlock ai={ai} />
          {rules.length > 0 && (
            <details className="mt-6 border-t border-theme-border pt-5">
              <summary className="cursor-pointer text-sm font-semibold text-theme-text-secondary hover:text-theme-text">숫자로 본 포인트 {rules.length}개</summary>
              <div className="mt-4">
                <RuleList items={rules} />
              </div>
            </details>
          )}
        </>
      ) : (
        <>
          <RuleList items={rules} />
          <p className="mt-5 text-[11px] text-theme-text-muted">AI 분석은 매주 월요일 성과 수집 때 지난주와 이번 달 것을 만듭니다. 이 기간 분석은 아직 없어 숫자 규칙으로 짚은 포인트만 보여 줍니다.</p>
        </>
      )}
    </div>
  </section>
);

export default InsightPanel;
