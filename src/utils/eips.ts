/** EIP 해설 화면용 계산: 콜 기록에서 포크 포함 상태·여정, 논쟁 아카이브에서 관련 논쟁, 목록 필터 */
import type { CallRecord, CallStatus } from '../data/ethCallsData';
import type { Debate } from '../data/ethDebatesData';
import type { EipRecord } from '../data/eipsData';
import { callLabel } from './calls';
import { isPublishable } from './debates';
import { IS_EN, LT } from './lang';

type CallLike = Pick<CallRecord, 'id' | 'series' | 'number' | 'date' | 'kind' | 'eips' | 'decisions'>;

const INCLUSION: ReadonlyArray<CallStatus> = ['PFI', 'CFI', 'SFI', 'DFI'];

export interface Inclusion {
    status: 'PFI' | 'CFI' | 'SFI' | 'DFI';
    fork?: string;
    date: string;
    callId: string;
    /** 포크의 간판 기능으로 정해졌는지 */
    headliner: boolean;
}

const touches = (c: CallLike, n: number) => c.eips.includes(n) || c.decisions.some((d) => d.eips.includes(n));
const full = (calls: ReadonlyArray<CallLike>) => calls.filter((c) => c.kind === 'full');
const byDate = <T extends { date: string }>(xs: T[]) => [...xs].sort((a, b) => a.date.localeCompare(b.date));

/** 가장 최근 포함 결정(PFI·CFI·SFI·DFI). 콜에서 그런 결정이 없었으면 undefined */
export function inclusionOf(calls: ReadonlyArray<CallLike>, n: number): Inclusion | undefined {
    let found: Inclusion | undefined;
    let headliner = false;
    for (const c of byDate(full(calls))) {
        for (const d of c.decisions) {
            if (!d.eips.includes(n)) continue;
            if (/headliner/i.test(d.original)) headliner = true;
            if (INCLUSION.includes(d.status)) found = { status: d.status as Inclusion['status'], fork: d.fork, date: c.date, callId: c.id, headliner: false };
        }
    }
    return found && { ...found, headliner: headliner && found.status !== 'DFI' };
}

export interface JourneyStep {
    date: string;
    callId: string;
    call: string;
    status?: CallStatus;
    /** 결정 문구. 결정 없이 논의만 된 콜이면 undefined */
    text?: string;
}

/** 이 EIP가 나온 콜을 날짜순으로. 결정이 여럿이면 결정마다 한 줄 */
export function journeyOf(calls: ReadonlyArray<CallLike>, n: number): JourneyStep[] {
    return byDate(full(calls).filter((c) => touches(c, n))).flatMap((c) => {
        const ds = c.decisions.filter((d) => d.eips.includes(n));
        const base = { date: c.date, callId: c.id, call: callLabel(c) };
        return ds.length ? ds.map((d) => ({ ...base, status: d.status, text: d.text })) : [base];
    });
}

export const lastDiscussed = (calls: ReadonlyArray<CallLike>, n: number): JourneyStep | undefined => journeyOf(calls, n).at(-1);

/** 사이트에 노출되는 논쟁 중 제목·요약에 이 EIP가 나오는 것. 최근 활동 순 */
export function debatesFor(debates: ReadonlyArray<Debate>, n: number): Debate[] {
    const re = new RegExp(`(EIP|ERC)-?${n}(?!\\d)`, 'i');
    return debates
        .filter((d) => isPublishable(d) && re.test(`${d.title} ${d.summary}`))
        .sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''));
}

export interface EipFilter {
    query: string;
    topic: string | null;
    fork: string | null;
}

/** 번호(8141, EIP-8141)나 한국어·영어 제목, 주제로 찾는다 */
export function matchEip(r: EipRecord, inc: Inclusion | undefined, f: EipFilter): boolean {
    if (f.topic && r.topic !== f.topic) return false;
    if (f.fork && inc?.fork !== f.fork) return false;
    const q = f.query.trim().toLowerCase();
    if (!q) return true;
    const num = q.replace(/^eip-?/, '');
    if (/^\d+$/.test(num)) return String(r.number).startsWith(num);
    return [r.titleKo, r.meta.title, r.topic, r.summary].some((s) => s.toLowerCase().includes(q));
}

/** 목록 순서: 최근 콜에서 다룬 것 먼저, 콜 기록이 없으면 번호 큰 것 먼저 */
export function sortByRecent<T extends { record: EipRecord; last?: JourneyStep }>(rows: T[]): T[] {
    return [...rows].sort((a, b) => (b.last?.date ?? '').localeCompare(a.last?.date ?? '') || b.record.number - a.record.number);
}

/** 포크 포함 상태 배지 (영어판은 en) */
export function inclusionLabel(inc: Inclusion | undefined, metaStatus: string, en: boolean = IS_EN): string {
    if (!inc) return LT(metaStatus === 'Final' ? '최종 확정' : '콜 결정 없음', en);
    const fork = inc.fork ? `${inc.fork} ` : '';
    const text = LT({ PFI: '포함 제안', CFI: '포함 검토', SFI: '포함 확정', DFI: '포함 제외' }[inc.status], en);
    // 영어 라벨은 약어를 풀어 쓴 것이라 약어를 다시 붙이지 않는다
    return en ? `${fork}${text}` : `${fork}${text} (${inc.status})`;
}
