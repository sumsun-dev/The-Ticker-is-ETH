/**
 * 관리자 성과 대시보드 데이터 (wp-vps /var/lib/ethcollective/stats-history.json).
 * scripts/local/weekly-stats.ts가 매주 쌓아 올리고, /api/admin/stats가 관리자 비밀번호 확인 후 내준다.
 */

export type Ranked = Array<[string, number]>;

export interface SiteWeek {
  visitors: number;
  newVisitors: number;
  pageLoads: number;
  mobilePct: number;
  daily: Ranked;
  peakHour: number | null;
  sections: Ranked;
  topPages: Ranked;
  sources: Ranked;
  refHosts: Ranked;
  bots: { search: number; ai: Ranked };
  notFound: Ranked;
  /** AI 답변 엔진 노출(AEO). 2026년 11월 수집부터 있다 */
  aeo?: AeoWeek;
  /** visitors 중 자동 방문으로 보이는 수, 출처별 (클라우드 데이터센터 IP·검색엔진 렌더링). 2026-11-10 수집부터 있다 */
  automated?: Ranked;
}

/** 하루치 홈페이지 상세. 하루로 셀 수 없는 시간대(peakHour)·일별 분포(daily)는 뺀다 */
export type SiteDay = Pick<SiteWeek, 'newVisitors' | 'mobilePct' | 'sections' | 'topPages' | 'sources' | 'refHosts' | 'bots' | 'notFound' | 'aeo' | 'automated'>;

/** [경로, AI 답변·색인 봇 요청(학습 수집 제외), 사람 첫 진입] */
export type AeoPage = [string, number, number];

export interface AeoWeek {
  /** AI 답변 서비스(ChatGPT·Perplexity 등)에서 링크를 눌러 들어온 사람의 첫 진입, 서비스별 */
  referrals: Ranked;
  /** AI 봇 요청을 용도별로: 학습 수집 / 검색 색인 / 실시간 답변 */
  kinds: Ranked;
  /** 답변·색인 봇이 많이 읽은 페이지 */
  pages: AeoPage[];
  /** AI 봇이 받은 오류 ["404 /path", 횟수] */
  errors: Ranked;
}

export interface WeekRecord {
  /** 월요일 (KST, YYYY-MM-DD) */
  week: string;
  site?: SiteWeek & { titles?: Record<string, string> };
  tg?: { subscribers: number };
  li?: { followers: number; impressions30: number; reactions30: number; newFollowers30: number };
}

export interface TgPostRecord { id: number; date: string; views: number; text: string }
export interface LiPostRecord { title: string; urn: string; date: string; impressions: number; reactions: number; comments: number }

export interface StatsHistory {
  updatedAt: string;
  channel: string;
  weeks: WeekRecord[];
  /** 날짜별 방문자(그날 처음 앱을 받은 IP+UA)와 첫 진입. site는 그날의 상세 (2026년 11월 수집부터) */
  siteDaily: Array<{ date: string; visitors: number; pageLoads: number; site?: SiteDay }>;
  /** 날짜별 텔레그램 구독자. 서버 cron(deploy/tg-subscribers.mjs)이 따로 쌓고 /api/admin/stats가 붙여 준다 */
  tgDaily?: Array<{ date: string; subscribers: number }>;
  /** 채널 글 전체. 조회수는 마지막 수집 시점 누적값 */
  tgPosts: TgPostRecord[];
  /** 링크드인 글. comments는 자동 첫 댓글을 뺀 수 */
  liPosts: LiPostRecord[];
}
