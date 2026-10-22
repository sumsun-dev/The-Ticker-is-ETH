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
  /** 날짜별 방문자(그날 처음 앱을 받은 IP+UA)와 첫 진입 */
  siteDaily: Array<{ date: string; visitors: number; pageLoads: number }>;
  /** 채널 글 전체. 조회수는 마지막 수집 시점 누적값 */
  tgPosts: TgPostRecord[];
  /** 링크드인 글. comments는 자동 첫 댓글을 뺀 수 */
  liPosts: LiPostRecord[];
}
