/**
 * EIP·ERC 해설 사실 점검. 해설의 사실 진술을 원문(프론트매터 뺀 본문)과 대조해 판정만 한다 (자동 수정 없음).
 * 메타(status·type·category·created·requires·title)는 모델 없이 코드로 대조한다. 모델 호출(ask)은 주입받는다.
 */
import type { EipMeta } from '../../src/data/eipsData';
import type { Ask } from './digest-factcheck';
import { metaOf } from './eips';
import { parseArray, VerdictSchema, type Grade } from './weekly-factcheck';

export type StdKind = 'EIP' | 'ERC';
export interface StdRec {
  number: number;
  titleKo: string;
  summary: string;
  before?: string[];
  after?: string[];
  impact?: { who: string; text: string }[];
  example?: { steps: { title?: string; body: string }[] } | null;
  flow?: { steps: { title?: string; body: string }[] } | null;
  iface?: { sig: string; ko: string }[];
  deep?: { title: string; body: string }[];
  safety?: { title?: string; body: string }[];
  meta: EipMeta;
  generatedAt: string;
}
export interface MetaMismatch {
  kind: StdKind;
  number: number;
  field: string;
  recorded: string;
  source: string;
}
export type ReportGrade = Grade | 'mech';
export interface ReportItem {
  grade: ReportGrade;
  block: string;
}
export interface StdIssue {
  kind: StdKind;
  number: number;
  title: string;
  grade: Grade;
  problem: string;
  quote: string;
}
export interface StdTarget {
  kind: StdKind;
  rec: StdRec;
  markdown: string; // 빈 문자열이면 원문 없음
}
export interface StdResult {
  checked: number;
  held: number;
  issues: StdIssue[];
  failures: string[];
}

const BATCH = 4;
const MAX_CLAIM = 3000;
const MAX_BODY = 6000;
const cut = (s: string, n: number): string => s.slice(0, n);

/* ── 메타 대조 (모델 없음) ───────────────────────────────────── */

export function metaMismatches(kind: StdKind, rec: Pick<StdRec, 'number' | 'meta'>, markdown: string): MetaMismatch[] {
  const src = metaOf(markdown);
  if (!src) return [];
  const rm = rec.meta;
  const pairs: [string, string, string][] = [
    ['status', rm.status ?? '', src.status],
    ['type', rm.type ?? '', src.type],
    ['category', rm.category ?? '', src.category ?? ''],
    ['created', rm.created ?? '', src.created],
    ['requires', [...(rm.requires ?? [])].sort((a, b) => a - b).join(','), [...src.requires].sort((a, b) => a - b).join(',')],
    ['title', rm.title ?? '', src.title],
  ];
  return pairs
    .filter(([, a, b]) => a !== b)
    .map(([field, recorded, source]) => ({ kind, number: rec.number, field, recorded, source }));
}

/* ── 본문 대조 ───────────────────────────────────────────────── */

export const selectStandards = <T extends Pick<StdRec, 'generatedAt'>>(recs: T[], since: string, all: boolean): T[] =>
  all ? recs : recs.filter((r) => r.generatedAt.slice(0, 10) >= since);

/** 해설의 사실 진술(why·비유 제외)을 한 덩어리로. 최대 3000자 */
export function claimOf(r: StdRec): string {
  const steps = (s?: { steps: { title?: string; body: string }[] } | null) => (s?.steps ?? []).map((x) => `${x.title ? `${x.title}: ` : ''}${x.body}`);
  const lines = [
    `요약: ${r.summary}`,
    ...(r.before ?? []).map((x) => `기존: ${x}`),
    ...(r.after ?? []).map((x) => `이후: ${x}`),
    ...(r.impact ?? []).map((x) => `영향(${x.who}): ${x.text}`),
    ...(r.iface ?? []).map((x) => `인터페이스 ${x.sig}: ${x.ko}`),
    ...(r.deep ?? []).map((x) => `심층(${x.title}): ${x.body}`),
    ...steps(r.example).map((x) => `예시 단계: ${x}`),
    ...steps(r.flow).map((x) => `흐름 단계: ${x}`),
    ...(r.safety ?? []).map((x) => `안전: ${x.title ? `${x.title}: ` : ''}${x.body}`),
  ];
  return cut(lines.join('\n'), MAX_CLAIM);
}

const PRIORITY = ['abstract', 'motivation', 'specification'];

/** 프론트매터를 빼고 Abstract·Motivation·Specification 을 앞에 둔 본문. 최대 6000자 */
export function bodyOf(markdown: string): string {
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const parts = body.split(/^(?=##\s)/m);
  const rank = (p: string): number => {
    const i = PRIORITY.indexOf(/^##\s+(.+)$/m.exec(p)?.[1]?.trim().toLowerCase() ?? '');
    return i < 0 ? PRIORITY.length : i;
  };
  // 정렬은 안정적이라 우선순위 밖 절은 원래 순서를 지킨다
  return cut(
    parts
      .map((p, i) => ({ p, i }))
      .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
      .map((x) => x.p)
      .join('')
      .trim(),
    MAX_BODY,
  );
}

const prompt = (batch: StdTarget[]): string => `당신은 사실 점검관입니다. 각 항목의 "서술"(한국어 해설)을 EIP·ERC "원문"과 대조해 등급을 매기세요.
- contradiction: 원문과 모순. 함수 시그니처, 상수, 가스 값, 바이트 크기, EIP 번호, 상태(Draft/Final 등), 요구(requires) EIP 가 원문과 다름.
- overreach: 원문에 없는 동작을 표준이 「보장」「강제」한다고 씀. 선택(MAY)·권장(SHOULD)을 필수(MUST)로 씀. 특정 조건의 수치를 일반화.
- ok: 그 밖의 모두. 원문 뒷부분(생략된 절)에 있을 수 있는 내용은 문제가 아닙니다.
사실 진술만 등급을 매기세요. 「왜 필요한가」, 비유, 예시 이야기의 비유·전망·해석은 판정에서 제외합니다.
문제가 있으면 problem(한 줄)과 quote(근거가 되는 원문 한 구절, 원문 그대로)를 쓰세요.
JSON 배열만 답하세요: [{"n":1,"grade":"ok"},{"n":2,"grade":"contradiction","problem":"...","quote":"..."}]  (모든 번호에 대해)

${batch.map((t, k) => `[${k + 1}] (${t.kind}-${t.rec.number}) ${t.rec.meta.title}\n서술:\n${claimOf(t.rec)}\n원문:\n${bodyOf(t.markdown)}`).join('\n\n')}`;

export function standardsFactcheck(targets: StdTarget[], ask: Ask): StdResult {
  const checkable = targets.filter((t) => t.markdown.trim());
  const result: StdResult = { checked: 0, held: targets.length - checkable.length, issues: [], failures: [] };
  for (let i = 0; i < checkable.length; i += BATCH) {
    const batch = checkable.slice(i, i + BATCH);
    try {
      const verdicts = VerdictSchema.parse(parseArray(ask(prompt(batch))));
      result.checked += batch.length;
      for (const v of verdicts) {
        const t = batch[v.n - 1];
        if (!t || v.grade === 'ok') continue;
        result.issues.push({ kind: t.kind, number: t.rec.number, title: t.rec.titleKo, grade: v.grade, problem: v.problem || '원문과 어긋남', quote: v.quote ?? '' });
      }
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      result.failures.push(`검사 실패: ${batch.map((t) => `${t.kind}-${t.rec.number}`).join(', ')} (${cut(why, 80)})`);
    }
  }
  return result;
}

export const stdIssueItem = (i: StdIssue): ReportItem => ({
  grade: i.grade,
  block: [`[${i.grade === 'contradiction' ? '모순' : '과대'}] ${i.kind}-${i.number} ${i.title}`, `문제: ${i.problem}`, i.quote && `근거: "${i.quote}"`].filter(Boolean).join('\n'),
});

export const mismatchItem = (m: MetaMismatch): ReportItem => ({
  grade: 'mech',
  block: `[메타 불일치] ${m.kind}-${m.number} ${m.field}: 기록 "${m.recorded}" / 원문 "${m.source}"`,
});

const ORDER: Record<ReportGrade, number> = { contradiction: 0, mech: 1, overreach: 2 };
const COUNT_LABEL: Record<ReportGrade, string> = { contradiction: '모순', mech: '코드 대조', overreach: '과대' };

/** 보고 본문. 모순 → 코드 대조 → 과대 순, 길이 넘으면 나머지는 개수로 요약. 항목도 실패도 없으면 빈 문자열 */
export function composeReport(head: string, items: ReportItem[], failures: string[], max = 3500): string {
  if (items.length === 0 && failures.length === 0) return '';
  const sorted = [...items].sort((a, b) => ORDER[a.grade] - ORDER[b.grade]); // 안정 정렬
  const tail = failures.join('\n');
  const parts: string[] = [];
  let used = head.length + tail.length + 140;
  let k = 0;
  for (; k < sorted.length; k++) {
    if (used + sorted[k].block.length + 2 > max) break;
    parts.push(sorted[k].block);
    used += sorted[k].block.length + 2;
  }
  const rest = sorted.slice(k);
  if (rest.length) {
    const by = (Object.keys(ORDER) as ReportGrade[]).map((g) => [g, rest.filter((i) => i.grade === g).length] as const).filter(([, n]) => n);
    parts.push(`외 ${rest.length}건 생략 (${by.map(([g, n]) => `${COUNT_LABEL[g]} ${n}`).join(', ')})`);
  }
  return [head, ...parts, tail].filter(Boolean).join('\n\n').slice(0, max);
}
