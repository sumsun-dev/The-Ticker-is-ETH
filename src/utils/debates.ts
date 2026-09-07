import type { Debate, DebateHolder, DebateStance, DebateStatus, DebateTimelineEntry } from '../data/ethDebatesData';

/** 아바타 폴백용 이니셜: 핸들이 있으면 핸들 앞 두 글자, 아니면 이름 앞 두 글자 */
export function initialsOf(holder: Pick<DebateHolder, 'name' | 'handle'>): string {
    const base = (holder.handle ?? holder.name).replace(/^@/, '').trim();
    if (!base) return '?';
    // 한글 이름은 첫 글자 하나로 충분하다
    return /^[가-힣]/.test(base) ? base.slice(0, 1) : base.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['bg-blue-600', 'bg-emerald-600', 'bg-orange-600', 'bg-violet-600', 'bg-pink-600', 'bg-cyan-600', 'bg-indigo-500'];

/** 같은 사람은 항상 같은 색이 나오도록 문자열 해시로 고른다 */
export function avatarColorOf(key: string): string {
    let hash = 0;
    for (const ch of key.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** "2026-09-05" → "09.05" */
export function shortDate(date: string): string {
    return date.slice(5).replace('-', '.');
}

/** 상태 색점 (목록·상세 공용) */
export const STATUS_DOT: Record<DebateStatus, string> = {
    active: 'bg-emerald-400',
    cooling: 'bg-amber-400',
    resolved: 'bg-brand-accent',
    archived: 'bg-theme-text-muted/60',
};

/** 입장 색: 점과 글자에만 쓴다 (카드 테두리에는 쓰지 않는다) */
export const STANCE_DOT: Record<DebateStance, string> = {
    pro: 'bg-brand-accent',
    con: 'bg-amber-400',
    neutral: 'bg-teal-300',
    other: 'bg-eth-purple',
};
export const STANCE_TEXT: Record<DebateStance, string> = {
    pro: 'text-brand-accent',
    con: 'text-amber-400',
    neutral: 'text-teal-300',
    other: 'text-eth-purple',
};

/** 사이트에 올리는 최소 참여 인원. 데이터 파일에는 전부 남기고 노출만 거른다 (2026-09-07 오너 결정). */
export const MIN_PARTICIPANTS = 10;

type HasHolders = { positions: ReadonlyArray<{ holders: ReadonlyArray<unknown> }> };

export function participantCount(debate: HasHolders): number {
    return debate.positions.reduce((n, p) => n + p.holders.length, 0);
}

export function isPublishable(debate: HasHolders): boolean {
    return participantCount(debate) >= MIN_PARTICIPANTS;
}

/** 이 인물이 한 발언(타임라인 항목), 시간순. 핸들 또는 이름으로 맞춘다. */
export function entriesOf(debate: Pick<Debate, 'timeline'>, holder: Pick<DebateHolder, 'handle' | 'name'>): DebateTimelineEntry[] {
    const keys = new Set([holder.handle, holder.name].filter((k): k is string => Boolean(k)).map((k) => k.toLowerCase()));
    return debate.timeline.filter((e) => keys.has(e.by.replace(/^@/, '').toLowerCase()));
}

export const STATUS_ORDER: DebateStatus[] = ['active', 'cooling', 'resolved', 'archived'];

export function countByStatus(debates: ReadonlyArray<Pick<Debate, 'status'>>): Record<DebateStatus, number> {
    const counts: Record<DebateStatus, number> = { active: 0, cooling: 0, resolved: 0, archived: 0 };
    for (const d of debates) counts[d.status] += 1;
    return counts;
}

/** 카테고리별 건수. 순서는 처음 등장한 순. */
export function countByCategory(debates: ReadonlyArray<Pick<Debate, 'category'>>): Array<{ category: string; count: number }> {
    const map = new Map<string, number>();
    for (const d of debates) map.set(d.category, (map.get(d.category) ?? 0) + 1);
    return [...map.entries()].map(([category, count]) => ({ category, count }));
}

/** 타임라인에 등장한 다이제스트 날짜, 중복 제거 최신순 */
export function relatedDigestDates(debate: Pick<Debate, 'timeline'>): string[] {
    return [...new Set(debate.timeline.map((t) => t.digest).filter((d): d is string => Boolean(d)))].sort().reverse();
}
