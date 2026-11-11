/**
 * 영어판 데이터: 한국어 문장 → 영어 문장 사전(src/data/en/*.json)으로 데이터를 통째로 바꿔 끼운다.
 * 사전은 scripts/translate-en.ts 가 채운다. 열쇠는 한국어 문장의 해시라, 한국어가 바뀌면 그 문장만 다시 번역된다.
 * 사전에 없는 문장은 한국어 그대로 남는다.
 */
export type Dict = Record<string, string>;

export const HANGUL = /[가-힣]/;

/** cyrb53: 브라우저와 node 에서 같은 값을 내는 짧은 문자열 해시 */
export function hashKo(s: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
        const ch = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** 코드가 값으로 비교하는 칸. 번역하지 않는다 (콜 결정의 status: '확정'·'보류' 등) */
const KEEP = new Set(['status']);
/** 영어 원문을 한국어로 옮겨 둔 칸. 영어판에선 원문이 그대로 보이므로 뺀다 */
const DROP = new Set(['translation']);

const isPlain = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype;

/** 번역 대상 한국어 문장을 문서 순서대로 모은다 (localize 와 같은 규칙) */
export function collectKo(value: unknown, out: Set<string> = new Set()): Set<string> {
    if (typeof value === 'string') {
        if (HANGUL.test(value)) out.add(value);
    } else if (Array.isArray(value)) {
        for (const x of value) collectKo(x, out);
    } else if (isPlain(value)) {
        for (const [k, x] of Object.entries(value)) {
            if (typeof x === 'string' && (KEEP.has(k) || DROP.has(k))) continue;
            collectKo(x, out);
        }
    }
    return out;
}

export function localize<T>(value: T, dict: Dict): T {
    if (typeof value === 'string') return ((HANGUL.test(value) && dict[hashKo(value)]) || value) as T;
    if (Array.isArray(value)) return value.map((x) => localize(x, dict)) as T;
    if (isPlain(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([k, x]) => !(typeof x === 'string' && DROP.has(k)))
                .map(([k, x]) => [k, typeof x === 'string' && KEEP.has(k) ? x : localize(x, dict)]),
        ) as T;
    }
    return value;
}
