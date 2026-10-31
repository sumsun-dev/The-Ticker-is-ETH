/** 성과 대시보드 KPI 아래 요약: AI 분석(있으면)과 숫자로 짚은 포인트 */
import React from 'react';
import type { AiInsight } from '../../types/adminStats';
import type { Insight } from '../../utils/adminInsights';
import { CHANNEL } from './theme';

const ChannelName: React.FC<{ channel: keyof typeof CHANNEL }> = ({ channel }) => (
  <span className="mr-1.5 font-semibold" style={{ color: CHANNEL[channel].color }}>
    {CHANNEL[channel].label}
  </span>
);

const toneText = (tone: string) => (tone === 'up' ? '상승' : tone === 'down' ? '하락' : null);

const RuleList: React.FC<{ items: Insight[] }> = ({ items }) => (
  <ul className="list-disc gap-x-8 pl-[18px] text-[13.5px] text-theme-text-secondary md:columns-2">
    {items.map((x, i) => (
      <li key={i} className={`my-1 break-inside-avoid ${x.tone === 'caveat' ? 'text-theme-text-muted' : ''}`}>
        <ChannelName channel={x.channel} />
        {x.text}
      </li>
    ))}
  </ul>
);

const AiBlock: React.FC<{ ai: AiInsight }> = ({ ai }) => {
  const when = new Date(ai.generatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-theme-text">{ai.headline}</h2>
        <p className="mt-1 max-w-4xl text-[13.5px] leading-relaxed text-theme-text-secondary">{ai.summary}</p>
      </div>
      <ul className="list-disc gap-x-8 pl-[18px] text-[13.5px] text-theme-text-secondary md:columns-2">
        {ai.highlights.map((x, i) => (
          <li key={i} className="my-1 break-inside-avoid">
            <ChannelName channel={x.channel} />
            <span className="font-medium text-theme-text">{x.title}</span>
            {toneText(x.tone) && <span className="sr-only"> ({toneText(x.tone)})</span>}
            <span className="text-theme-text-muted"> · {x.detail}</span>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs font-semibold text-theme-text">다음에 할 일</h3>
          <ol className="list-decimal pl-[18px] text-[13.5px] text-theme-text-secondary">
            {ai.actions.map((a, i) => (
              <li key={i} className="my-0.5">
                {a}
              </li>
            ))}
          </ol>
        </div>
        {ai.caveats.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold text-theme-text">해석할 때 주의</h3>
            <ul className="list-disc pl-[18px] text-xs text-theme-text-muted">
              {ai.caveats.map((c, i) => (
                <li key={i} className="my-0.5">
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

const InsightPanel: React.FC<{ ai: AiInsight | null; rules: Insight[]; periodLabel: string }> = ({ ai, rules, periodLabel }) => (
  <section aria-label="인사이트" className="rounded-lg bg-theme-bg-secondary px-[18px] py-4">
    <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[13px]">
      <h2 className="font-semibold text-theme-text">이번 기간 요약</h2>
      <span className="text-xs text-theme-text-muted">
        {ai ? 'AI 분석' : '자동 인사이트'} · {periodLabel}
      </span>
    </div>
    {ai ? (
      <>
        <AiBlock ai={ai} />
        {rules.length > 0 && (
          <details className="mt-4 border-t border-theme-border pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-theme-text-secondary hover:text-theme-text">숫자로 본 포인트 {rules.length}개</summary>
            <div className="mt-2">
              <RuleList items={rules} />
            </div>
          </details>
        )}
      </>
    ) : (
      <RuleList items={rules} />
    )}
  </section>
);

export default InsightPanel;
