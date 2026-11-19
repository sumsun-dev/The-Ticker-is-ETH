/**
 * 발언자 소속 점검. 코드: 같은 handle 에 서로 다른 소속이 붙은 곳을 찾는다. 모델: handle 별 소속 표기를 X 프로필 bio 와 대조한다.
 * 판정만 하고 데이터는 고치지 않는다. 모델 호출(ask)은 주입받는다.
 */
import { createHash } from 'node:crypto';
import type { Ask } from './digest-factcheck';
import { parseArray, VerdictSchema, type Grade } from './weekly-factcheck';

export interface SpeakerLike {
  name?: string;
  org?: string;
  role?: string;
  handle?: string;
}
export interface SpeakerData {
  callSpeakers: Record<string, SpeakerLike>;
  debates: { id: string; positions: { holders: SpeakerLike[] }[] }[];
  calls: { id: string; speakers?: SpeakerLike[] }[];
  profiles: Record<string, { name?: string; bio?: string }>;
}
/** 한 handle 의 소속 표기들. values: 표기 → 나온 곳 */
export interface Affiliation {
  handle: string;
  name: string;
  values: Map<string, string[]>;
}
export interface SpeakerIssue {
  handle: string;
  grade: Grade;
  problem: string;
  quote: string;
}
export interface SpeakerResult {
  checked: number;
  held: number; // bio 가 없어 판정 보류
  issues: SpeakerIssue[];
  failures: string[];
  failedHandles: string[];
}

const BATCH = 20;
const MAX_FROM = 3;
const cut = (s: string, n: number): string => s.slice(0, n);
const joined = (s: SpeakerLike): string => [s.org, s.role].filter(Boolean).join(' · ');

export function collectAffiliations(data: SpeakerData): Affiliation[] {
  const byKey = new Map<string, Affiliation>();
  const add = (s: SpeakerLike, value: string, from: string) => {
    const h = s.handle?.replace(/^@/, '').trim();
    if (!h || !value) return;
    const row = byKey.get(h.toLowerCase()) ?? { handle: h, name: s.name ?? '', values: new Map<string, string[]>() };
    const froms = row.values.get(value) ?? [];
    if (froms.length < MAX_FROM && !froms.includes(from)) froms.push(from);
    row.values.set(value, froms);
    byKey.set(h.toLowerCase(), row);
  };
  for (const [label, s] of Object.entries(data.callSpeakers)) add(s, joined(s), `콜 명단 ${label}`);
  for (const c of data.calls) for (const s of c.speakers ?? []) add(s, joined(s), `콜 ${c.id}`);
  for (const d of data.debates) for (const p of d.positions) for (const h of p.holders) add(h, h.role ?? '', `논쟁 ${d.id}`);
  return [...byKey.values()];
}

// 직함·일반어는 소속을 가르지 못하므로 비교에서 뺀다
const GENERIC = new Set(['개발자', '리서처', '리드', '연구원', '연구', '진행', '공동', '저자', '팀', '독립', 'dev', 'developer', 'researcher', 'research', 'lead', 'engineer', 'cto', 'ceo', 'co', 'founder', 'and', 'the', 'of']);
const tokens = (v: string): Set<string> => new Set((v.toLowerCase().match(/[a-z0-9가-힣]+/g) ?? []).filter((t) => t.length >= 2 && !GENERIC.has(t)));

/** 서로 단어가 하나도 겹치지 않는 표기 쌍이 있으면 엇갈림. ponytail: 단어 겹침 휴리스틱이라 「Geth 리드」 vs 「EF」 같은 표기 차이도 잡는다. 오탐이 많으면 별칭 표를 둔다 */
export const conflicts = (rows: Affiliation[]): Affiliation[] =>
  rows.filter((r) => {
    const ts = [...r.values.keys()].map(tokens).filter((t) => t.size);
    return ts.some((a, i) => ts.slice(i + 1).some((b) => ![...a].some((x) => b.has(x))));
  });

export const conflictBlock = (r: Affiliation): string =>
  `[소속 엇갈림] @${r.handle}${r.name ? ` (${r.name})` : ''}\n${[...r.values].map(([v, from]) => `- ${v} ← ${from.join(', ')}`).join('\n')}`;

/* ── 이전 실행과 비교 (새 handle·바뀐 소속만 모델 대조) ───────── */

export const affHash = (r: Affiliation): string => createHash('sha1').update([...r.values.keys()].sort().join('\n')).digest('hex').slice(0, 12);

export type Seen = Record<string, string>;

export const pickChanged = (rows: Affiliation[], seen: Seen): Affiliation[] => rows.filter((r) => seen[r.handle.toLowerCase()] !== affHash(r));

/** 이번에 본 handle 을 기록한다. 검사가 실패한 handle 은 기록하지 않아 다음 실행에 다시 본다 */
export function nextSeen(rows: Affiliation[], prev: Seen, failed: string[]): Seen {
  const skip = new Set(failed.map((h) => h.toLowerCase()));
  const out: Seen = { ...prev };
  for (const r of rows) if (!skip.has(r.handle.toLowerCase())) out[r.handle.toLowerCase()] = affHash(r);
  return out;
}

/* ── 모델 대조 ───────────────────────────────────────────────── */

const prompt = (batch: { row: Affiliation; name: string; bio: string }[]): string => `당신은 사실 점검관입니다. 각 인물의 "소속 표기"(우리 사이트가 쓴 소속·직책)를 X 프로필 "bio"와 대조해 등급을 매기세요.
- contradiction: bio 가 다른 조직을 현재 소속으로 명시함 (표기와 충돌).
- overreach: bio 에 근거 없는 직함·소속을 단정함. 「prev. EF」「ex-EF」「전 EF」 같은 과거 소속을 현재 소속처럼 씀.
- ok: 그 밖의 모두. bio 가 짧거나 소속 정보가 없어 근거가 부족하면 ok (판정 보류, 문제 아님).
문제가 있으면 problem(한 줄)과 quote(근거가 되는 bio 한 구절, 그대로)를 쓰세요.
JSON 배열만 답하세요: [{"n":1,"grade":"ok"},{"n":2,"grade":"contradiction","problem":"...","quote":"..."}]  (모든 번호에 대해)

${batch.map((b, k) => `[${k + 1}] @${b.row.handle}${b.name ? ` (${b.name})` : ''}\n소속 표기: ${[...b.row.values.keys()].join(' | ')}\nbio: ${cut(b.bio, 500)}`).join('\n\n')}`;

export function speakerFactcheck(rows: Affiliation[], profiles: SpeakerData['profiles'], ask: Ask): SpeakerResult {
  const lower = new Map(Object.entries(profiles).map(([k, v]) => [k.toLowerCase(), v]));
  const withBio = rows
    .map((row) => {
      const p = lower.get(row.handle.toLowerCase());
      return { row, name: p?.name ?? row.name, bio: (p?.bio ?? '').trim() };
    })
    .filter((x) => x.bio);
  const result: SpeakerResult = { checked: 0, held: rows.length - withBio.length, issues: [], failures: [], failedHandles: [] };
  for (let i = 0; i < withBio.length; i += BATCH) {
    const batch = withBio.slice(i, i + BATCH);
    try {
      const verdicts = VerdictSchema.parse(parseArray(ask(prompt(batch))));
      result.checked += batch.length;
      for (const v of verdicts) {
        const t = batch[v.n - 1];
        if (!t || v.grade === 'ok') continue;
        result.issues.push({ handle: t.row.handle, grade: v.grade, problem: v.problem || 'bio 와 어긋남', quote: v.quote ?? '' });
      }
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      result.failedHandles.push(...batch.map((b) => b.row.handle));
      result.failures.push(`발언자 검사 실패: ${batch.slice(0, 3).map((b) => `@${b.row.handle}`).join(', ')} 등 ${batch.length}명 (${cut(why, 80)})`);
    }
  }
  return result;
}

export const speakerIssueBlock = (i: SpeakerIssue, row?: Affiliation): string =>
  [`[${i.grade === 'contradiction' ? '모순' : '과대'}] 발언자 @${i.handle}`, row && `표기: ${[...row.values.keys()].join(' | ')}`, `문제: ${i.problem}`, i.quote && `근거: "${i.quote}"`]
    .filter(Boolean)
    .join('\n');
