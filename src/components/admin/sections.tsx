/** 성과 대시보드 채널별 섹션: 텔레그램, 홈페이지, 링크드인 */
import React, { useId, useMemo } from 'react';
import { Bot, Briefcase, Globe, Send } from 'lucide-react';
import type { StatsHistory } from '../../types/adminStats';
import type { Period, Summary } from '../../utils/adminStats';
import { kstDate, MATURE_DAYS } from '../../utils/adminStats';
import { blockLabel, DAY_LABELS, monthlyTg, tgType, MIN_TYPE_POSTS, type Heat, type Slot, type TypeRow } from '../../utils/adminInsights';
import { liThumb, pageThumb, tgThumb, type ThumbIndex } from '../../utils/adminMedia';
import { AreaChart, ComboChart, Donut, HBars, Heatmap } from './charts';
import { Card, MediaList } from './ui';
import { CHANNEL, n } from './theme';

const SITE = 'https://ethcollective.xyz';
const DONUT_COLORS = ['#A086FC', '#629FFF', '#26A5E4', '#F2B544', '#34D399', '#F472B6', '#94A3B8'];
const dot = (d: string) => d.slice(5).replace('-', '.');
/** 서버 로그 경로를 사이트 주소로. 경로가 아니면 홈으로 (//host, @host 같은 값 방지) */
const siteUrl = (p: string) => (p.startsWith('/') && !p.startsWith('//') ? SITE + p : `${SITE}/`);

const Stat: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="min-w-0 rounded-2xl bg-theme-bg/50 px-4 py-3">
    <div className="text-[11px] text-theme-text-muted">{label}</div>
    <div className="mt-0.5 text-lg font-bold tabular-nums text-theme-text">{value}</div>
    {hint && <div className="text-[10px] text-theme-text-muted">{hint}</div>}
  </div>
);

const Sub: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="min-w-0">
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold text-theme-text">{title}</h3>
      {hint && <span className="text-[11px] text-theme-text-muted">{hint}</span>}
    </div>
    {children}
  </div>
);

/* ── 텔레그램 ─────────────────────────────────────────────────── */

export const TelegramSection: React.FC<{ data: StatsHistory; cur: Summary; period: Period; idx: ThumbIndex; types: TypeRow[]; heat: Heat; slot: Slot | null }> = ({
  data,
  cur,
  period,
  idx,
  types: allTypes,
  heat,
  slot,
}) => {
  const { color } = CHANNEL.telegram;
  const months = useMemo(() => monthlyTg(data.tgPosts, data.updatedAt), [data]);
  const types = allTypes.filter((t) => t.posts >= MIN_TYPE_POSTS);
  const slotNote = useId();
  const icon = <Send size={18} />;

  return (
    <Card title="텔레그램" subtitle={`The Ticker is ETH · 글 ${n(data.tgPosts.length)}개 기록`} icon={icon} accent={color}>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="이 기간 글" value={`${cur.tgPosts}개`} />
        <Stat label="글당 평균 조회" value={cur.tgAvgViews === null ? '–' : n(cur.tgAvgViews)} hint={cur.tgFresh ? `최근 ${MATURE_DAYS}일 글 ${cur.tgFresh}개 제외` : undefined} />
        <Stat label="누적 조회 합" value={n(cur.tgViews)} hint="이 기간에 올린 글 기준" />
        <Stat label="구독자" value={cur.subscribers === null ? '–' : n(cur.subscribers)} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-8">
          <Sub title="월별 추이" hint="막대가 흐린 달은 조회가 아직 쌓이는 중">
            <ComboChart rows={months} barColor={color} lineColor="#629FFF" selected={period.start.slice(0, 7)} />
          </Sub>
          <div className="grid gap-8 md:grid-cols-2">
            <Sub title="유형별 글당 평균 조회" hint="최근 90일">
              {types.length ? <HBars rows={types.map((t) => [`${t.type} (${t.posts})`, t.avgViews])} color={color} labelWidth="7.5rem" /> : <p className="text-sm text-theme-text-muted">최근 90일 글이 부족합니다</p>}
            </Sub>
            <Sub title="언제 올리면 잘 읽히나" hint="최근 6개월 · 조회 중앙값">
              <Heatmap heat={heat} color={color} best={slot} describedBy={slot ? slotNote : undefined} />
              {slot && (
                <p id={slotNote} className="mt-2 text-[11px] text-theme-text-muted">
                  가장 좋은 칸: {DAY_LABELS[slot.day]}요일 {blockLabel(slot.block)} · 보통 {n(slot.medianViews)}회 (글 {slot.posts}개)
                </p>
              )}
            </Sub>
          </div>
        </div>
        <Sub title="이 기간 많이 본 글">
          <MediaList
            color={color}
            icon={icon}
            empty="이 기간에 올린 글이 없습니다"
            items={cur.topTg.map((x) => ({
              key: String(x.id),
              href: `https://t.me/${data.channel}/${x.id}`,
              title: x.text || '미디어 글',
              image: tgThumb(x.id, idx),
              value: n(x.views),
              valueLabel: '조회',
              badge: tgType(x.text),
              meta: dot(kstDate(x.date)),
            }))}
          />
        </Sub>
      </div>
    </Card>
  );
};

/* ── 홈페이지 ─────────────────────────────────────────────────── */

export const SiteSection: React.FC<{ data: StatsHistory; cur: Summary; period: Period; idx: ThumbIndex }> = ({ data, cur, period, idx }) => {
  const { color } = CHANNEL.site;
  const icon = <Globe size={18} />;
  const daily = data.siteDaily.map((d) => ({ key: d.date, label: dot(d.date), value: d.visitors }));
  const inPeriod = (date: string) => date >= period.start && date <= period.end;
  const site = cur.site;
  const aiTotal = site ? site.bots.ai.reduce((a, [, v]) => a + v, 0) : 0;

  return (
    <Card title="홈페이지" subtitle="ethcollective.xyz · 서버 로그 기준" icon={icon} accent={color}>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="방문자" value={cur.visitors === null ? '–' : n(cur.visitors)} hint={cur.visitors === null ? '기간 전체 로그 없음' : undefined} />
        <Stat label="첫 진입" value={cur.pageLoads === null ? '–' : n(cur.pageLoads)} />
        <Stat label="신규 / 재방문" value={site?.newVisitors !== undefined && cur.visitors !== null ? `${n(site.newVisitors)} / ${n(cur.visitors - site.newVisitors)}` : '–'} />
        <Stat label="모바일" value={site?.mobilePct !== undefined ? `${site.mobilePct}%` : '–'} />
      </div>

      <Sub title="일별 방문자" hint={`기록 ${daily.length}일 · 선택 기간 강조`}>
        {daily.length ? <AreaChart points={daily} color={color} highlight={inPeriod} unit="명" /> : <p className="text-sm text-theme-text-muted">기록 없음</p>}
      </Sub>

      {site ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <Sub title="유입 경로">
            <Donut rows={site.sources} colors={DONUT_COLORS} centerLabel="유입 경로 비중" />
            {site.refHosts.length > 0 && <p className="mt-3 text-[11px] text-theme-text-muted">외부 사이트: {site.refHosts.map(([h, c]) => `${h} ${c}`).join(' · ')}</p>}
          </Sub>
          <Sub title="분야별 첫 진입">
            <HBars rows={site.sections.slice(0, 7)} color={color} />
          </Sub>
          <Sub title="많이 들어온 페이지">
            <MediaList
              color={color}
              icon={icon}
              empty="기록 없음"
              items={site.topPages.slice(0, 6).map(([p, c]) => ({
                key: p,
                href: siteUrl(p),
                title: cur.titles[p] ?? (p === '/' ? '홈' : p),
                image: pageThumb(p, idx),
                value: n(c),
                valueLabel: '첫 진입',
                meta: p,
              }))}
            />
          </Sub>
          <Sub title="AI·검색 크롤러" hint="GEO 지표">
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Stat label="AI 크롤러 요청" value={n(aiTotal)} />
              <Stat label="검색엔진 요청" value={n(site.bots.search)} />
            </div>
            <HBars rows={site.bots.ai} color={CHANNEL.overall.color} />
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-theme-text-muted">
              <Bot size={12} aria-hidden="true" /> AI 답변 엔진이 사이트를 얼마나 읽어 가는지 보여 줍니다
            </p>
          </Sub>
        </div>
      ) : (
        <p className="mt-6 text-sm text-theme-text-muted">이 기간의 홈페이지 상세 기록이 없습니다. 서버 로그는 14일만 남아, 기록은 2026년 10월부터 쌓입니다.</p>
      )}
    </Card>
  );
};

/* ── 링크드인 ─────────────────────────────────────────────────── */

export const LinkedInSection: React.FC<{ data: StatsHistory; cur: Summary; idx: ThumbIndex }> = ({ data, cur, idx }) => {
  const { color } = CHANNEL.linkedin;
  const icon = <Briefcase size={18} />;
  return (
    <Card title="링크드인" subtitle={`페이지 팔로워 ${cur.followers === null ? '–' : n(cur.followers)}명`} icon={icon} accent={color}>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="이 기간 글" value={`${cur.liPosts}개`} />
        <Stat label="노출" value={cur.liImpressions === null ? '–' : n(cur.liImpressions)} hint={cur.liImpressions === null ? '기록 시작 전' : undefined} />
        <Stat label="반응 · 댓글" value={`${n(cur.liReactions)} · ${n(cur.liComments)}`} hint="자동 링크 댓글 제외" />
        <Stat label="참여율" value={cur.liEngagement === null ? '–' : `${cur.liEngagement}%`} hint="(반응+댓글) ÷ 노출" />
      </div>
      <MediaList
        color={color}
        icon={icon}
        empty="이 기간의 링크드인 기록이 없습니다"
        items={cur.topLi.map((x) => ({
          key: x.urn,
          href: `https://www.linkedin.com/feed/update/${x.urn}/`,
          title: x.title,
          image: liThumb(x.title, data.tgPosts, idx),
          value: n(x.impressions),
          valueLabel: '노출',
          meta: `${dot(x.date)} · 반응 ${x.reactions} · 댓글 ${x.comments}${x.impressions ? ` · 참여율 ${Math.round(((x.reactions + x.comments) / x.impressions) * 1000) / 10}%` : ''}`,
        }))}
      />
    </Card>
  );
};
