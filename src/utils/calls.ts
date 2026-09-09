import type { CallPosition, CallRecord, CallSpeaker, CallStatus, CallTopic } from '../data/ethCallsData';

/** 시리즈 필 (목록·상세 공용). 모르는 시리즈(브레이크아웃)는 슬러그를 대문자로 */
export const SERIES_INFO: Record<string, { label: string; name: string; className: string }> = {
    acde: { label: 'ACDE', name: 'All Core Devs · Execution', className: 'bg-brand-primary' },
    acdc: { label: 'ACDC', name: 'All Core Devs · Consensus', className: 'bg-teal-700' },
    acdt: { label: 'ACDT', name: 'All Core Devs · Testing', className: 'bg-violet-700' },
};
export const MAIN_SERIES = ['acde', 'acdc', 'acdt'] as const;

export function seriesInfo(series: string): { label: string; name: string; className: string } {
    return SERIES_INFO[series] ?? { label: series.toUpperCase(), name: 'Breakout', className: 'bg-theme-surface-hover' };
}

export function callLabel(call: Pick<CallRecord, 'series' | 'number'>): string {
    return `${seriesInfo(call.series).label} #${call.number}`;
}

/** 결정 상태 색: 점과 글자에만 쓴다 */
export const STATUS_DOT: Record<CallStatus, string> = {
    SFI: 'bg-emerald-400',
    CFI: 'bg-brand-accent',
    PFI: 'bg-eth-purple',
    DFI: 'bg-theme-text-muted/60',
    보류: 'bg-amber-400',
    확정: 'bg-teal-300',
    일정: 'bg-teal-300',
    기타: 'bg-theme-text-muted/60',
};
export const STATUS_TEXT: Record<CallStatus, string> = {
    SFI: 'text-emerald-400',
    CFI: 'text-brand-accent',
    PFI: 'text-eth-purple',
    DFI: 'text-theme-text-muted',
    보류: 'text-amber-400',
    확정: 'text-teal-300',
    일정: 'text-teal-300',
    기타: 'text-theme-text-muted',
};

/** "2026-08-27" → "2026.08.27" */
export function dotDate(date: string): string {
    return date.replace(/-/g, '.');
}

export function splitDuration(min: number): { h: number; m: number } {
    return { h: Math.floor(min / 60), m: min % 60 };
}

export function tsToSec(t: string): number {
    const [h, m, s] = t.split(':').map(Number);
    return h * 3600 + m * 60 + (s || 0);
}

/** 유튜브 링크를 그 시각에서 시작하도록 */
export function videoAt(videoUrl: string | undefined, timestamp: string | undefined): string | undefined {
    if (!videoUrl) return undefined;
    if (!timestamp) return videoUrl;
    const sec = tsToSec(timestamp);
    return `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}t=${sec}s`;
}

/** 월별 묶음, 최신 달·최신 콜 먼저 */
export function groupByMonth<T extends Pick<CallRecord, 'date'>>(calls: ReadonlyArray<T>): Array<{ month: string; calls: T[] }> {
    const map = new Map<string, T[]>();
    for (const c of [...calls].sort((a, b) => b.date.localeCompare(a.date))) {
        const month = c.date.slice(0, 7);
        map.set(month, [...(map.get(month) ?? []), c]);
    }
    return [...map.entries()].map(([month, list]) => ({ month, calls: list }));
}

export function speakerOf(call: Pick<CallRecord, 'speakers'>, label: string): CallSpeaker {
    return call.speakers.find((s) => s.label === label) ?? { label, name: label.replace(/\s+[-|]\s+.*$|\s*\(.*$/, '').trim(), share: 0 };
}

/** Avatar 컴포넌트가 받는 모양으로 */
export function holderOfSpeaker(speaker: CallSpeaker): { name: string; handle?: string; avatar?: string; role?: string } {
    const role = [speaker.org, speaker.role].filter(Boolean).join(' · ');
    return { name: speaker.name, handle: speaker.handle, avatar: speaker.avatar, role: role || undefined };
}

export interface Remark {
    topic: CallTopic;
    position: CallPosition;
}

/** 이 사람이 토론에서 한 발언, 레코드 순서대로 */
export function remarksOf(call: Pick<CallRecord, 'topics'>, label: string): Remark[] {
    return call.topics.flatMap((topic) => topic.positions.filter((p) => p.speaker === label).map((position) => ({ topic, position })));
}

/** 결정에 등장한 포크 이름들 (필터 칩) */
export function forksOf(calls: ReadonlyArray<Pick<CallRecord, 'decisions'>>): string[] {
    return [...new Set(calls.flatMap((c) => c.decisions.map((d) => d.fork).filter((f): f is string => Boolean(f))))];
}

export function mentionsEip(call: Pick<CallRecord, 'eips'>, query: string): boolean {
    const n = Number(query.replace(/[^0-9]/g, ''));
    return Number.isFinite(n) && n > 0 && call.eips.includes(n);
}

/** 이 콜의 일정 항목이 뒤 콜에서 어떻게 바뀌었는지: 같은 key를 가진 가장 최근 뒤 콜의 문구 */
export function laterTargetUpdates(
    call: Pick<CallRecord, 'id' | 'date' | 'targets'>,
    calls: ReadonlyArray<Pick<CallRecord, 'id' | 'series' | 'number' | 'date' | 'targets'>>,
): Record<string, { callId: string; label: string; text: string }> {
    const out: Record<string, { callId: string; label: string; text: string }> = {};
    const later = calls.filter((c) => c.id !== call.id && c.date > call.date).sort((a, b) => a.date.localeCompare(b.date));
    for (const t of call.targets) {
        for (const c of later) {
            const hit = c.targets.find((x) => x.key === t.key && x.text !== t.text);
            if (hit) out[t.key] = { callId: c.id, label: callLabel(c), text: hit.text };
        }
    }
    return out;
}

/** 다음 ACD 콜 추정: ACDE·ACDC는 목요일 격주로 번갈아 열린다. 마지막 콜 + 14일 중 가장 이른 것 */
export function nextCallEstimate(calls: ReadonlyArray<Pick<CallRecord, 'series' | 'number' | 'date'>>, today: string): { label: string; date: string } | undefined {
    const candidates = ['acde', 'acdc'].flatMap((series) => {
        const latest = calls.filter((c) => c.series === series).sort((a, b) => b.date.localeCompare(a.date))[0];
        if (!latest) return [];
        let d = new Date(`${latest.date}T00:00:00Z`);
        let number = latest.number;
        do {
            d = new Date(d.getTime() + 14 * 86_400_000);
            number += 1;
        } while (d.toISOString().slice(0, 10) < today);
        return [{ label: `${seriesInfo(series).label} #${number}`, date: d.toISOString().slice(0, 10) }];
    });
    return candidates.sort((a, b) => a.date.localeCompare(b.date))[0];
}

export function todayKst(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

/** 홈 노출용: 정리된(full) 본 시리즈 콜을 최신순으로 n개 */
export function latestFullCalls<T extends Pick<CallRecord, 'series' | 'kind' | 'date'>>(calls: ReadonlyArray<T>, n = 3): T[] {
    return calls
        .filter((c) => c.kind === 'full' && (MAIN_SERIES as readonly string[]).includes(c.series))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, n);
}
