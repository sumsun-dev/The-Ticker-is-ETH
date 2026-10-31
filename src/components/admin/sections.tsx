/** 성과 대시보드 탭 내용: 텔레그램, 기여자, 홈페이지, 링크드인. 위에서부터 수치 인사이트, 추이, 분포, 순위, 기간별 표 */
import React, { useId } from 'react';
import type { StatsHistory } from '../../types/adminStats';
import type { Period, Summary } from '../../utils/adminStats';
import { kstDate } from '../../utils/adminStats';
import {
  blockLabel,
  DAY_LABELS,
  linkedinFacts,
  memberFacts,
  siteFacts,
  telegramFacts,
  TG_TYPES,
  tgType,
  MIN_TYPE_POSTS,
  type Heat,
  type MemberRow,
  type Slot,
  type TypeRow,
} from '../../utils/adminInsights';
import { liThumb, pageThumb, tgThumb, type ThumbIndex } from '../../utils/adminMedia';
import { AreaChart, HBars, Heatmap, Scatter, StackedBars, TrendChart } from './charts';
import { FactGrid, MediaList, MemberTable, Panel, PeriodTable } from './ui';
import { CHANNEL, n } from './theme';

/** 기간 하나의 요약. 오래된 것부터 */
export interface SeriesRow {
  key: string;
  label: string;
  partial?: boolean;
  sum: Summary;
}

const SITE = 'https://ethcollective.xyz';
const dot = (d: string) => d.slice(5).replace('-', '.');
/** 서버 로그 경로를 사이트 주소로. 경로가 아니면 홈으로 (//host, @host 같은 값 방지) */
const siteUrl = (p: string) => (p.startsWith('/') && !p.startsWith('//') ? SITE + p : `${SITE}/`);
const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-sm text-theme-text-muted">{children}</p>;
const Info: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="-mb-4 text-xs text-theme-text-muted">{children}</p>;
const Row: React.FC<{ cols?: string; children: React.ReactNode }> = ({ cols = '', children }) => <div className={`grid gap-8 lg:gap-10 ${cols}`}>{children}</div>;
const newestFirst = (series: SeriesRow[]) => [...series].reverse().slice(0, 12).map((s) => ({ ...s, data: s.sum }));
const inPeriod = (date: string, p: Period) => date >= p.start && date <= p.end;

/** 텔레그램 글 유형 색 (분포 차트 점) */
const TYPE_COLORS: Record<string, string> = {
  '코어 콜': '#2481CC',
  다이제스트: '#7357D6',
  ETH레터: '#0F9D8A',
  논쟁: '#D9480F',
  '리서치 공유': '#C27C0E',
  '행사·공지': '#C2255C',
  '뉴스·코멘트': '#868E96',
};
const DAY_MS = 864e5;

/* ── 텔레그램 ─────────────────────────────────────────────────── */

export const TelegramPane: React.FC<{
  data: StatsHistory;
  cur: Summary;
  prev: Summary | null;
  period: Period;
  series: SeriesRow[];
  idx: ThumbIndex;
  types: TypeRow[];
  heat: Heat;
  slot: Slot | null;
}> = ({ data, cur, prev, period, series, idx, types: allTypes, heat, slot }) => {
  const { color } = CHANNEL.telegram;
  const types = allTypes.filter((t) => t.posts >= MIN_TYPE_POSTS);
  const slotNote = useId();
  const since = Date.parse(data.updatedAt) - 90 * DAY_MS;
  const recent = data.tgPosts.filter((p) => Date.parse(p.date) >= since);

  return (
    <div className="space-y-10">
      <Info>The Ticker is ETH · 글 {n(data.tgPosts.length)}개 기록 · 이 기간 글 조회 합 {n(cur.tgViews)}</Info>
      <FactGrid facts={telegramFacts(cur, prev, allTypes, slot)} />
      <Row cols="lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="기간별 추이" hint="최근 글은 조회가 쌓이는 중이라 글당 조회에서 뺌">
          <TrendChart
            rows={series.map((s) => ({ key: s.key, label: s.label, bar: s.sum.tgPosts, line: s.sum.tgAvgViews, partial: s.partial }))}
            color={color}
            barLabel="올린 글"
            lineLabel="글당 조회"
            lineUnit="회"
            selected={period.key}
          />
        </Panel>
        <Panel title="많이 본 글" hint="이 기간">
          <MediaList
            empty="이 기간에 올린 글이 없습니다"
            items={cur.topTg.map((x) => ({
              key: String(x.id),
              href: `https://t.me/${data.channel}/${x.id}`,
              title: x.text || '미디어 글',
              image: tgThumb(x.id, idx),
              value: n(x.views),
              valueLabel: '조회',
              meta: `${tgType(x.text)} · ${dot(kstDate(x.date))}`,
            }))}
          />
        </Panel>
      </Row>
      <Panel title="글별 조회 분포" hint={`최근 90일 글 ${recent.length}개 · 점 하나가 글 하나 · 세로축은 로그`}>
        <Scatter
          wide
          unit="회"
          points={recent.map((p) => ({ key: String(p.id), date: p.date, value: p.views, color: TYPE_COLORS[tgType(p.text)], title: `${dot(kstDate(p.date))} ${tgType(p.text)} · ${(p.text || '미디어 글').slice(0, 40)}` }))}
          legend={TG_TYPES.map((t) => [t, TYPE_COLORS[t]])}
        />
      </Panel>
      <Row cols="lg:grid-cols-2">
        <Panel title="유형별 글당 조회" hint="최근 90일">
          {types.length ? <HBars rows={types.map((t) => [`${t.type} (${t.posts})`, t.avgViews])} color={color} labelWidth="8rem" /> : <Empty>최근 90일 글이 부족합니다</Empty>}
        </Panel>
        <Panel title="올리기 좋은 시간" hint="최근 6개월 · 조회 중앙값">
          <Heatmap heat={heat} color={color} best={slot} describedBy={slot ? slotNote : undefined} />
          {slot && (
            <p id={slotNote} className="mt-2 text-xs text-theme-text-muted">
              {DAY_LABELS[slot.day]}요일 {blockLabel(slot.block)}에 올린 글이 보통 {n(slot.medianViews)}회로 가장 잘 읽혔습니다 (글 {slot.posts}개)
            </p>
          )}
        </Panel>
      </Row>
      <Panel title="기간별 비교" hint="최근 12개 기간">
        <PeriodTable
          rows={newestFirst(series)}
          color={color}
          selected={period.key}
          columns={[
            { label: '올린 글', get: (s: Summary) => s.tgPosts },
            { label: '조회 합', get: (s: Summary) => s.tgViews },
            { label: '글당 조회', get: (s: Summary) => s.tgAvgViews },
            { label: '최고 조회', get: (s: Summary) => s.topTg[0]?.views ?? null },
            { label: '구독자', get: (s: Summary) => s.subscribers },
          ]}
        />
      </Panel>
    </div>
  );
};

/* ── 기여자 ─────────────────────────────────────────────────────── */

const MEMBER_COLORS = ['#2481CC', '#7357D6', '#0F9D8A', '#C27C0E', '#C2255C', '#D9480F', '#5C7CFA', '#868E96'];

export const MembersPane: React.FC<{ data: StatsHistory; cur: Summary; members: MemberRow[]; memberSeries: Array<{ key: string; label: string; members: MemberRow[] }>; period: Period }> = ({
  data,
  cur,
  members,
  memberSeries,
  period,
}) => {
  // 색은 보이는 기간 전체 글 수 순으로 정해, 기간을 바꿔도 같은 사람은 같은 색
  const totals = new Map<string, number>();
  for (const s of memberSeries) for (const m of s.members) totals.set(m.name, (totals.get(m.name) ?? 0) + m.posts);
  const ranked = [...totals].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const top = ranked.slice(0, MEMBER_COLORS.length - 1);
  const colors: Record<string, string> = Object.fromEntries(top.map((name, i) => [name, MEMBER_COLORS[i]]));
  if (ranked.length > top.length) colors['그 밖'] = MEMBER_COLORS.at(-1)!;
  const group = (name: string) => (top.includes(name) ? name : '그 밖');

  return (
    <div className="space-y-10">
      <Info>이 기간 텔레그램 글 기준 · 작성자는 사이트 콘텐츠에 붙은 이름이라 사이트에 아직 안 들어온 최근 글은 빠질 수 있음</Info>
      <FactGrid facts={memberFacts(members, cur.tgPosts)} />
      <Row cols="lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="기간별 기여자 글 수" hint="최근 12개 기간">
          <StackedBars
            unit="개"
            colors={colors}
            selected={period.key}
            rows={memberSeries.map((s) => {
              const parts = new Map<string, number>();
              for (const m of s.members) parts.set(group(m.name), (parts.get(group(m.name)) ?? 0) + m.posts);
              return { key: s.key, label: s.label, parts: [...parts] };
            })}
          />
        </Panel>
        <Panel title="기여자별 글당 평균 조회" hint="이 기간 · 조회 쌓인 글만">
          {members.some((m) => m.avgViews !== null) ? (
            <HBars rows={members.filter((m) => m.avgViews !== null).map((m) => [`${m.name} (${m.posts})`, m.avgViews as number])} color={CHANNEL.telegram.color} labelWidth="7rem" />
          ) : (
            <Empty>조회가 쌓인 글이 아직 없습니다</Empty>
          )}
        </Panel>
      </Row>
      <Panel title="기여자별 성과" hint="글당 평균은 올린 지 3일 지난 글만">
        <MemberTable rows={members} color={CHANNEL.telegram.color} topHref={(id) => `https://t.me/${data.channel}/${id}`} />
      </Panel>
    </div>
  );
};

/* ── 홈페이지 ─────────────────────────────────────────────────── */

export const SitePane: React.FC<{ data: StatsHistory; cur: Summary; prev: Summary | null; period: Period; series: SeriesRow[]; idx: ThumbIndex }> = ({ data, cur, prev, period, series, idx }) => {
  const { color } = CHANNEL.site;
  const daily = data.siteDaily.map((d) => ({ key: d.date, label: dot(d.date), value: d.visitors }));
  const site = cur.site;
  const srcTotal = site ? site.sources.reduce((a, [, v]) => a + v, 0) : 0;
  const logged = series.filter((s) => s.sum.siteDays > 0);

  return (
    <div className="space-y-10">
      <Info>ethcollective.xyz 서버 로그 기준 · 로그는 14일만 남아 2026년 10월부터 쌓임</Info>
      <FactGrid facts={siteFacts(cur, prev, data.siteDaily.filter((d) => inPeriod(d.date, period)))} />
      <Row cols="lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="일별 방문자" hint={`기록 ${daily.length}일 · 음영은 선택한 기간`}>
          {daily.length ? <AreaChart points={daily} color={color} highlight={(d) => inPeriod(d, period)} unit="명" /> : <Empty>기록 없음</Empty>}
        </Panel>
        <Panel title="유입 경로" hint="첫 진입 기준">
          {site ? (
            <>
              <HBars rows={site.sources} color={color} total={srcTotal} labelWidth="5rem" />
              {site.refHosts.length > 0 && <p className="mt-3 text-xs leading-relaxed text-theme-text-muted">외부: {site.refHosts.map(([h, c]) => `${h} ${c}`).join(', ')}</p>}
            </>
          ) : (
            <Empty>상세 기록 없음</Empty>
          )}
        </Panel>
      </Row>
      {site ? (
        <Row cols="lg:grid-cols-3">
          <Panel title="많이 들어온 페이지">
            <MediaList
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
          </Panel>
          <Panel title="분야별 첫 진입">
            <HBars rows={site.sections.slice(0, 7)} color={color} labelWidth="4.5rem" />
          </Panel>
          <Panel title="AI 크롤러" hint={`검색엔진 ${n(site.bots.search)}`}>
            <HBars rows={site.bots.ai} color={CHANNEL.overall.color} />
          </Panel>
        </Row>
      ) : (
        <Empty>이 기간의 홈페이지 상세 기록이 없습니다.</Empty>
      )}
      {logged.length > 0 && (
        <Panel title="기간별 비교" hint="로그가 있는 기간만">
          <PeriodTable
            rows={newestFirst(logged)}
            color={color}
            selected={period.key}
            columns={[
              { label: '방문자', get: (s: Summary) => s.visitors },
              { label: '첫 진입', get: (s: Summary) => s.pageLoads },
              { label: '로그 일수', get: (s: Summary) => s.siteDays },
              { label: 'AI 크롤러', get: (s: Summary) => (s.site ? s.site.bots.ai.reduce((a, [, v]) => a + v, 0) : null) },
              { label: '검색엔진', get: (s: Summary) => s.site?.bots.search ?? null },
            ]}
          />
        </Panel>
      )}
    </div>
  );
};

/* ── 링크드인 ─────────────────────────────────────────────────── */

export const LinkedInPane: React.FC<{ data: StatsHistory; cur: Summary; prev: Summary | null; period: Period; series: SeriesRow[]; idx: ThumbIndex }> = ({ data, cur, prev, period, series, idx }) => {
  const { color } = CHANNEL.linkedin;
  const posts = data.liPosts.filter((x) => inPeriod(x.date, period));
  const tracked = series.filter((s) => s.sum.liImpressions !== null);
  const eng = (x: { impressions: number; reactions: number; comments: number }) => (x.impressions ? Math.round(((x.reactions + x.comments) / x.impressions) * 1000) / 10 : 0);

  return (
    <div className="space-y-10">
      <Info>ECK 페이지 · 기록은 2026.10.09부터 · 댓글은 자동 링크 댓글 제외</Info>
      <FactGrid facts={linkedinFacts(cur, prev, posts)} />
      <Row cols="lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="기간별 추이" hint="기록이 기간 전체를 덮는 기간만">
          {tracked.length ? (
            <TrendChart
              rows={tracked.map((s) => ({ key: s.key, label: s.label, bar: s.sum.liPosts, line: s.sum.liImpressions, partial: s.partial }))}
              color={color}
              barLabel="올린 글"
              lineLabel="노출"
              lineUnit="회"
              selected={period.key}
            />
          ) : (
            <Empty>아직 기간 전체를 덮은 기록이 없습니다</Empty>
          )}
        </Panel>
        <Panel title="글별 노출 분포" hint={`기록된 글 ${data.liPosts.length}개 · 세로축은 로그`}>
          <Scatter
            unit="회"
            points={data.liPosts.map((x) => ({ key: x.urn, date: `${x.date}T03:00:00Z`, value: x.impressions, color: inPeriod(x.date, period) ? color : '#d4d4d8', title: `${dot(x.date)} ${x.title.slice(0, 40)} · 참여율 ${eng(x)}%` }))}
            legend={[
              ['선택한 기간', color],
              ['그 밖', '#d4d4d8'],
            ]}
          />
        </Panel>
      </Row>
      <Panel title="노출 많은 글" hint="이 기간">
        <MediaList
          empty="이 기간의 링크드인 기록이 없습니다"
          items={cur.topLi.map((x) => ({
            key: x.urn,
            href: `https://www.linkedin.com/feed/update/${x.urn}/`,
            title: x.title,
            image: liThumb(x.title, data.tgPosts, idx),
            value: n(x.impressions),
            valueLabel: '노출',
            meta: `${dot(x.date)} · 반응 ${x.reactions} · 댓글 ${x.comments} · 참여율 ${eng(x)}%`,
          }))}
        />
      </Panel>
      {tracked.length > 0 && (
        <Panel title="기간별 비교" hint="기록이 있는 기간만">
          <PeriodTable
            rows={newestFirst(tracked)}
            color={color}
            selected={period.key}
            columns={[
              { label: '올린 글', get: (s: Summary) => s.liPosts },
              { label: '노출', get: (s: Summary) => s.liImpressions },
              { label: '글당 노출', get: (s: Summary) => (s.liImpressions !== null && s.liPosts ? Math.round(s.liImpressions / s.liPosts) : null) },
              { label: '반응', get: (s: Summary) => s.liReactions },
              { label: '참여율', get: (s: Summary) => s.liEngagement, format: (v) => `${v}%` },
              { label: '팔로워', get: (s: Summary) => s.followers },
            ]}
          />
        </Panel>
      )}
    </div>
  );
};
