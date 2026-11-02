/** ERC 해설 화면용 계산: 전체 색인(erc-index.json)에서 상태별 수·기반 표준·족보, 다이제스트에서 ECK가 다룬 글 */
import type { ErcIndexEntry, ErcRecord } from '../data/ercsData';
import type { EthDigest } from '../data/ethNewsData';

/** 상태 순서와 한국어 설명 (목록의 단계 표) */
export const ERC_STATUSES = ['Draft', 'Review', 'Last Call', 'Final', 'Stagnant', 'Withdrawn'] as const;

export const ERC_STATUS_TEXT: Record<string, string> = {
    Final: 'text-emerald-400',
    'Last Call': 'text-amber-400',
    Review: 'text-brand-accent',
    Living: 'text-teal-300',
    Draft: 'text-theme-text-muted',
    Stagnant: 'text-theme-text-muted',
    Withdrawn: 'text-theme-text-muted',
};

export function statusCounts(index: ReadonlyArray<Pick<ErcIndexEntry, 'status'>>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of index) out[e.status] = (out[e.status] ?? 0) + 1;
    return out;
}

/** 이 번호를 requires에 적은 ERC들 */
export const dependentsOf = (index: ReadonlyArray<ErcIndexEntry>, n: number): ErcIndexEntry[] => index.filter((e) => e.number !== n && e.requires.includes(n));

/** 다른 ERC가 가장 많이 기대는 표준 (EIP 번호 포함). 많은 순 */
export function baseStandards(index: ReadonlyArray<ErcIndexEntry>, top = 6): Array<{ number: number; count: number }> {
    const m = new Map<number, number>();
    for (const e of index) for (const r of new Set(e.requires)) m.set(r, (m.get(r) ?? 0) + 1);
    return [...m]
        .map(([number, count]) => ({ number, count }))
        .sort((a, b) => b.count - a.count || a.number - b.number)
        .slice(0, top);
}

export interface ErcFilter {
    query: string;
    topic: string | null;
}

export function matchErc(r: ErcRecord, f: ErcFilter): boolean {
    if (f.topic && r.topic !== f.topic) return false;
    const q = f.query.trim().toLowerCase();
    if (!q) return true;
    const num = q.replace(/^(erc|eip)-?/, '');
    if (/^\d+$/.test(num)) return String(r.number).startsWith(num);
    return [r.titleKo, r.meta.title, r.topic, r.summary].some((s) => s.toLowerCase().includes(q));
}

const STATUS_RANK = ['Final', 'Living', 'Last Call', 'Review', 'Draft', 'Stagnant', 'Withdrawn'];

/** 목록 순서: Final 먼저, 같은 상태면 많이 기대는 표준, 그다음 번호 */
export function sortErcs(records: ReadonlyArray<ErcRecord>, index: ReadonlyArray<ErcIndexEntry>): ErcRecord[] {
    const deps = new Map(baseStandards(index, Infinity).map((x) => [x.number, x.count]));
    const rank = (s: string) => (STATUS_RANK.indexOf(s) + 8) % 8;
    return [...records].sort((a, b) => rank(a.meta.status) - rank(b.meta.status) || (deps.get(b.number) ?? 0) - (deps.get(a.number) ?? 0) || a.number - b.number);
}

export interface Mention {
    date: string;
    title: string;
}

/** ECK 뉴스 다이제스트에서 이 번호(ERC-N, EIP-N)가 나온 항목. 최신 순 */
export function digestMentions(digests: ReadonlyArray<EthDigest>, n: number, limit = 5): Mention[] {
    const re = new RegExp(`(ERC|EIP)-?${n}(?!\\d)`, 'i');
    const out: Mention[] = [];
    for (const d of [...digests].sort((a, b) => b.date.localeCompare(a.date))) {
        for (const s of d.sections) for (const i of s.items) if (re.test(`${i.title} ${i.summary}`)) out.push({ date: d.date, title: i.title });
    }
    return out.slice(0, limit);
}

/** 번호 하나를 사이트 안 해설 페이지나 원문으로 잇는 주소. ERC 색인에 있으면 ERC, 아니면 EIP로 본다 */
export function standardHref(
    n: number,
    has: { eips: ReadonlySet<number>; ercs: ReadonlySet<number>; ercIndex: ReadonlySet<number> },
): { href: string; internal: boolean; label: string } {
    if (has.ercs.has(n)) return { href: `/ercs/${n}`, internal: true, label: `ERC-${n}` };
    if (has.eips.has(n)) return { href: `/eips/${n}`, internal: true, label: `EIP-${n}` };
    if (has.ercIndex.has(n)) return { href: `https://ercs.ethereum.org/ERCS/erc-${n}`, internal: false, label: `ERC-${n}` };
    return { href: `https://eips.ethereum.org/EIPS/eip-${n}`, internal: false, label: `EIP-${n}` };
}
