/** 하드포크 화면용 계산: 콜 결정에서 다가오는 포크의 EIP별 최신 포함 상태 */
import type { CallRecord, CallStatus } from '../data/ethCallsData';
import type { Fork } from '../data/forks';

type CallLike = Pick<CallRecord, 'id' | 'date' | 'kind' | 'decisions'>;
export type ForkStatus = 'SFI' | 'CFI' | 'PFI' | 'DFI';

export interface ForkEipStatus {
    number: number;
    status: ForkStatus;
    date: string;
    callId: string;
}

// 콜 정리에서 '확정'은 포함 확정(SFI)과 같은 뜻으로 쓰였다 (예: 2026-09-21 FOCIL·프레임 트랜잭션)
const AS_FORK: Partial<Record<CallStatus, ForkStatus>> = { SFI: 'SFI', 확정: 'SFI', CFI: 'CFI', PFI: 'PFI', DFI: 'DFI' };
export const FORK_STATUS_ORDER: ForkStatus[] = ['SFI', 'CFI', 'PFI', 'DFI'];
export const FORK_STATUS_LABEL: Record<ForkStatus, string> = { SFI: '포함 확정', CFI: '포함 검토', PFI: '포함 제안', DFI: '제외' };

/** 포크 이름이 붙은 결정 중 EIP마다 가장 최근 것. 메타 EIP의 확정 목록(fork.eips)은 콜 결정이 없을 때 SFI로 채운다 */
export function forkEipStatuses(calls: ReadonlyArray<CallLike>, fork: Pick<Fork, 'callFork' | 'eips' | 'meta'>): ForkEipStatus[] {
    const latest = new Map<number, ForkEipStatus>();
    if (fork.callFork) {
        const sorted = calls.filter((c) => c.kind === 'full').sort((a, b) => a.date.localeCompare(b.date));
        for (const c of sorted)
            for (const d of c.decisions) {
                const status = AS_FORK[d.status];
                if (!status || d.fork !== fork.callFork) continue;
                for (const n of d.eips) if (n !== fork.meta) latest.set(n, { number: n, status, date: c.date, callId: c.id });
            }
    }
    for (const e of fork.eips) if (!latest.has(e.number)) latest.set(e.number, { number: e.number, status: 'SFI', date: '', callId: '' });
    return [...latest.values()].sort((a, b) => FORK_STATUS_ORDER.indexOf(a.status) - FORK_STATUS_ORDER.indexOf(b.status) || a.number - b.number);
}
