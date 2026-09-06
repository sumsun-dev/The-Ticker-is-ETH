/**
 * 이더리움 논쟁 아카이브의 순수 로직 — 스키마, 상태 계산, 병합, 답글 파싱.
 * I/O(claude 호출, X API, 파일 읽기·쓰기)는 scripts/extract-eth-debates.ts가 담당한다.
 */
import { z } from 'zod';

export const CATEGORIES = ['프로토콜 설계', '확장성 · L2', '토큰화 · 기관', '규제', '거버넌스 · 커뮤니티'] as const;
export const STANCES = ['pro', 'con', 'neutral', 'other'] as const;
/** 인용 트윗이 누구에게 답한 것인지: reply(답글) · quote(인용) · none(확인했으나 관계 없음) */
export const RELATIONS = ['reply', 'quote', 'none'] as const;

/** 진행 중 → 식어감(7일 무활동) → 종결(30일 무활동). 결론 남(resolved)은 편집자가 JSON에서 직접 표기. */
export const COOLING_AFTER_DAYS = 7;
export const ARCHIVE_AFTER_DAYS = 30;

const HolderSchema = z.object({
  /** X 핸들(@ 없이). 워치리스트 밖 인물은 없을 수 있다 */
  handle: z.string().optional(),
  name: z.string(),
  /** 소속·직책 한 구절 (예: 'Geth 리드', 'Paradigm CTO', '인플루언서·투자자') */
  role: z.string().optional(),
  avatar: z.url().optional(),
  watchlist: z.boolean().optional(),
});
const PositionSchema = z.object({
  stance: z.enum(STANCES),
  label: z.string(),
  holders: z.array(HolderSchema).min(1),
  // 모델이 상한을 넘겨도 실패시키지 않고 앞에서 자른다 (한 번의 초과로 추출 전체를 버리지 않기 위해)
  points: z.array(z.string()).min(1).transform((a) => a.slice(0, 5)),
});
const TimelineEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** 발화자 핸들 또는 이름 */
  by: z.string(),
  stance: z.enum(STANCES).optional(),
  quote: z.string(),
  url: z.url(),
  /** 이 인용이 실린 다이제스트 날짜 */
  digest: z.string().optional(),
  /** 이 트윗이 답하거나 인용한 상대의 핸들 (관계도용, 트윗 메타데이터로 채움) */
  replyTo: z.string().optional(),
  relation: z.enum(RELATIONS).optional(),
  /** 트윗 원문 전문 (tweet.php display_text) */
  original: z.string().optional(),
  /** 원문 전문 번역 (헤드리스 일괄 번역) */
  translation: z.string().optional(),
});
const SourceSchema = z.object({ title: z.string(), url: z.url() });

/** 헤드리스 모델이 내는 초안 한 건. id가 기존 레코드와 같으면 갱신, 아니면 신규. */
export const DebateDraftSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  title: z.string(),
  category: z.enum(CATEGORIES),
  summary: z.string(),
  keyPoints: z.array(z.string()).min(1).transform((a) => a.slice(0, 5)),
  /** 무엇을 두고 다투는지 독자가 모를 수 있는 기술·제도적 맥락 */
  background: z.string().optional(),
  /** 이 논쟁의 결과가 생태계에 무엇을 바꾸는지 */
  whyItMatters: z.string().optional(),
  /** 근거 문서 (EIP, 블로그, 포럼 글) */
  sources: z.array(SourceSchema).transform((a) => a.slice(0, 6)).optional(),
  /** 이 논쟁을 X에서 다시 찾을 검색어 (후속 활동 자동 수집용) */
  keywords: z.array(z.string()).transform((a) => a.slice(0, 6)).optional(),
  positions: z.array(PositionSchema).min(2),
  timeline: z.array(TimelineEntrySchema).min(1),
});
export const DraftEnvelopeSchema = z.object({ debates: z.array(DebateDraftSchema) });

export type Relation = (typeof RELATIONS)[number];
export type Holder = z.infer<typeof HolderSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;
export type DebateDraft = z.infer<typeof DebateDraftSchema>;
export type DebateStatus = 'active' | 'cooling' | 'archived' | 'resolved';

export interface Engagement {
  likes: number;
  retweets: number;
  quotes: number;
  replies: number;
  views: number;
}

export interface Debate extends DebateDraft {
  status: DebateStatus;
  firstSeen: string;
  lastActivity: string;
  /** 루트 트윗의 반응 규모 (tweet.php) — 리트윗 본문은 싣지 않고 수만 기록 */
  engagement?: Engagement;
  rootUrl?: string;
}

export interface DebatesFile {
  updatedAt: string;
  /** 이미 추출을 끝낸 다이제스트 날짜 — 같은 호를 두 번 넣지 않기 위함 */
  processedDigests: string[];
  debates: Debate[];
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function computeStatus(lastActivity: string, today: string, current?: DebateStatus): DebateStatus {
  if (current === 'resolved') return 'resolved';
  const idle = daysBetween(lastActivity, today);
  if (idle >= ARCHIVE_AFTER_DAYS) return 'archived';
  if (idle >= COOLING_AFTER_DAYS) return 'cooling';
  return 'active';
}

function holderKey(h: Holder): string {
  return (h.handle ?? h.name).toLowerCase();
}

/** 같은 url의 인용은 하나만 (먼저 온 것 유지, 관계 메타데이터는 어느 쪽에 있든 보존), 날짜순 */
function dedupeTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  const byUrl = new Map<string, TimelineEntry>();
  for (const t of entries) {
    const prev = byUrl.get(t.url);
    byUrl.set(
      t.url,
      prev
        ? {
            ...prev,
            ...(prev.relation ? {} : { replyTo: t.replyTo, relation: t.relation }),
            ...(prev.original ? {} : { original: t.original }),
            ...(prev.translation ? {} : { translation: t.translation }),
          }
        : t,
    );
  }
  return [...byUrl.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** 같은 입장(stance, other면 label까지)끼리 인물을 합친다. 기존 인물의 빈 아바타는 새 초안 값으로 채운다. */
function mergePositions(prev: Position[], next: Position[]): Position[] {
  const matches = (a: Position, b: Position) => a.stance === b.stance && (a.stance !== 'other' || a.label === b.label);
  const merged = next.map((np) => {
    const pp = prev.find((p) => matches(p, np));
    if (!pp) return np;
    const fresh = new Map(np.holders.map((h) => [holderKey(h), h]));
    const kept = pp.holders.map((h) => {
      const f = fresh.get(holderKey(h));
      if (!f) return h;
      return {
        ...h,
        ...(f.avatar && !h.avatar ? { avatar: f.avatar, name: f.name } : {}),
        ...(f.role && !h.role ? { role: f.role } : {}),
      };
    });
    const seen = new Set(kept.map(holderKey));
    return { ...np, holders: [...kept, ...np.holders.filter((h) => !seen.has(holderKey(h)))] };
  });
  const untouched = prev.filter((p) => !next.some((np) => matches(p, np)));
  return [...merged, ...untouched];
}

/**
 * 초안을 기존 레코드에 병합한다.
 * - id가 있으면 갱신: 타임라인은 url 기준 중복 제거 후 날짜순, 인물은 합집합, 요약·쟁점·논거는 최신 초안으로.
 * - 없으면 신규. 제목·카테고리는 한 번 정해지면 초안이 바꾸지 못한다(편집자만).
 * - 결과는 마지막 활동 최신순, 상태는 오늘 기준으로 다시 계산.
 */
export function mergeDebates(existing: Debate[], drafts: DebateDraft[], today: string): Debate[] {
  const byId = new Map(existing.map((d) => [d.id, d]));
  for (const draft of drafts) {
    const dates = draft.timeline.map((t) => t.date).sort();
    const prev = byId.get(draft.id);
    if (!prev) {
      const timeline = dedupeTimeline(draft.timeline);
      byId.set(draft.id, {
        ...draft,
        timeline,
        firstSeen: dates[0],
        lastActivity: dates[dates.length - 1],
        status: 'active',
      });
      continue;
    }
    const timeline = dedupeTimeline([...prev.timeline, ...draft.timeline]);
    const lastActivity = [prev.lastActivity, ...dates].sort().pop() as string;
    byId.set(draft.id, {
      ...prev,
      summary: draft.summary,
      keyPoints: draft.keyPoints,
      background: draft.background ?? prev.background,
      whyItMatters: draft.whyItMatters ?? prev.whyItMatters,
      sources: draft.sources?.length ? draft.sources : prev.sources,
      keywords: draft.keywords?.length ? draft.keywords : prev.keywords,
      positions: mergePositions(prev.positions, draft.positions),
      timeline,
      lastActivity,
    });
  }
  return [...byId.values()]
    .map((d) => ({ ...d, status: computeStatus(d.lastActivity, today, d.status) }))
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

/** X 프로필 캐시 항목 (screenname.php / user_info) */
export interface XProfile {
  handle: string;
  name: string;
  avatar?: string;
  followers?: number;
  /** X 프로필 소개글 — 소속·직책 판단 근거 */
  bio?: string;
}

/** 워치리스트 설정 항목 (scripts/config/twitter-accounts.json): why에 '분야 — 소속·역할' 메모가 있다 */
export interface WatchlistEntry {
  name: string;
  why: string;
}

/** 프롬프트용 인물 정보: 워치리스트 메모와 프로필 바이오·팔로워를 한 줄씩. 아는 게 없는 인물은 뺀다. */
export function personLines(
  handles: Iterable<string>,
  watchlist: Map<string, WatchlistEntry>,
  profiles: Record<string, XProfile>,
): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of handles) {
    const h = raw.replace(/^@/, '').toLowerCase();
    if (!h || seen.has(h)) continue;
    seen.add(h);
    const w = watchlist.get(h);
    const p = profiles[h];
    if (!w && !p) continue;
    const parts = [
      w ? `워치리스트: ${w.name}, ${w.why}` : '',
      p?.followers ? `팔로워 ${p.followers}` : '',
      p?.bio ? `바이오: ${p.bio.replace(/\s+/g, ' ').slice(0, 160)}` : '',
    ].filter(Boolean);
    lines.push(`- @${p?.handle ?? raw.replace(/^@/, '')}: ${parts.join(' · ')}`);
  }
  return lines;
}

/** pbs.twimg.com 아바타는 48px `_normal`로 오므로 400px 변형으로 바꾼다 */
export function avatarLarge(url: string | undefined): string | undefined {
  return url?.replace(/_normal(\.\w+)$/, '_400x400$1');
}

/** 레코드의 인물에 캐시된 프로필(이름·아바타)을 채운다. 핸들이 있는 인물만. */
export function applyProfiles(debates: Debate[], profiles: Record<string, XProfile>): Debate[] {
  const fill = (h: Holder): Holder => {
    const p = h.handle ? profiles[h.handle.toLowerCase()] : undefined;
    if (!p) return h;
    return { ...h, name: p.name || h.name, ...(p.avatar ? { avatar: p.avatar } : {}) };
  };
  return debates.map((d) => ({ ...d, positions: d.positions.map((p) => ({ ...p, holders: p.holders.map(fill) })) }));
}

/** latest_replies.php 응답의 답글 한 건 */
export interface ThreadReply {
  id: string;
  handle: string;
  name: string;
  avatar?: string;
  bio?: string;
  followers: number;
  text: string;
  date: string;
  url: string;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** latest_replies.php 응답을 정규화한다. 짧은 인사·멘션만 있는 답글은 뺀다. */
type Raw = Record<string, unknown>;
const raw = (v: unknown): Raw => (v && typeof v === 'object' ? (v as Raw) : {});

export function parseThreadReplies(payload: unknown, minChars = 40): ThreadReply[] {
  const p = raw(payload);
  return asArray<Raw>((p.timeline ?? p.replies) as Raw | Raw[] | undefined)
    .map((tw): ThreadReply | null => {
      const info = raw(tw.user_info ?? tw.author);
      const id = String(tw.tweet_id ?? tw.id ?? '');
      const handle = String(tw.screen_name ?? info.screen_name ?? '');
      // 앞머리 @멘션 제거 후 남는 본문 길이로 판단
      const text = String(tw.text ?? '').trim().replace(/^(@\w+\s+)+/, '');
      if (!id || !handle || text.length < minChars) return null;
      const created = new Date(String(tw.created_at ?? ''));
      return {
        id,
        handle,
        name: String(info.name ?? handle),
        avatar: avatarLarge(info.avatar ? String(info.avatar) : undefined),
        bio: info.description ? String(info.description) : undefined,
        followers: Number(info.followers_count ?? 0),
        text,
        date: Number.isNaN(created.getTime()) ? '' : created.toISOString(),
        url: `https://x.com/${handle}/status/${id}`,
      };
    })
    .filter((r): r is ThreadReply => r !== null);
}

/** 답글 중 논쟁 후보만 남긴다: 워치리스트 계정이거나 팔로워가 minFollowers 이상. 팔로워 많은 순 상위 limit개. */
export function pickNotableReplies(
  replies: ThreadReply[],
  watchlist: Set<string>,
  { minFollowers = 2000, limit = 8 }: { minFollowers?: number; limit?: number } = {},
): ThreadReply[] {
  return replies
    .filter((r) => watchlist.has(r.handle.toLowerCase()) || r.followers >= minFollowers)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, limit);
}

/** 모델이 추정한 X 핸들이 실제 프로필과 같은 사람인지: 이름 토큰이 프로필 이름이나 핸들에 들어 있어야 한다 */
export function handleMatchesName(holderName: string, profileName: string | undefined, handle: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  const want = norm(holderName);
  if (want.length < 3) return false;
  const got = [norm(profileName ?? ''), norm(handle)];
  return got.some((g) => g.length > 0 && (g.includes(want) || want.includes(g)));
}

/** x.com/<handle>/status/<id> 에서 트윗 id를 뽑는다 */
export function tweetIdOf(url: string): string | undefined {
  return /(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/.exec(url)?.[1];
}

/** 헤드리스 응답에서 JSON 객체만 추출 (코드펜스·앞뒤 설명 제거) */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in response');
  return JSON.parse(trimmed.slice(start, end + 1));
}
