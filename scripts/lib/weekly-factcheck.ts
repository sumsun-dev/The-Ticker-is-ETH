/**
 * 주 1회 지난 글 사실 점검. 최근 7일 다이제스트·논쟁·콜의 문장을 원문과 대조해 판정만 한다 (자동 수정 없음).
 * 등급: ok / contradiction(주인 오귀속·입장 반대·수치 틀림) / overreach(원문보다 넓히거나 확정을 앞당김).
 * 모델 호출(ask)과 콜 원문 가져오기(fetchCallSource)는 주입받는다.
 */
import { z } from 'zod';
import { contextOf, lookup, MAX_SOURCE, type Ask, type CheckDigest, type InboxEntry } from './digest-factcheck';

export type Kind = 'digest' | 'debate' | 'call';
export type Grade = 'contradiction' | 'overreach';
const KIND_LABEL: Record<Kind, string> = { digest: '다이제스트', debate: '논쟁', call: '콜' };
const GRADE_LABEL: Record<Grade, string> = { contradiction: '모순', overreach: '과대' };

export interface Target {
  kind: Kind;
  date: string;
  title: string;
  claim: string;
  source: string; // 빈 문자열이면 원문 없음
  urls: string[];
  /** 모델 없이 코드로 잡은 모순 (논쟁 입장 주인이 타임라인에 없음) */
  mech?: string;
}
export interface Issue {
  kind: Kind;
  date: string;
  title: string;
  grade: Grade;
  problem: string;
  quote: string;
  urls: string[];
}
export interface WeeklyResult {
  since: string;
  today: string;
  checked: number;
  held: number; // 원문 없어 판정 보류
  issues: Issue[];
  failures: string[]; // 검사 실패한 묶음 설명
}

interface DigestRec extends CheckDigest {
  date: string;
  title?: string;
}
interface Timeline {
  by?: string;
  url?: string;
  original?: string;
  date?: string;
  digest?: string;
}
interface DebateRec {
  title: string;
  summary: string;
  keyPoints?: string[];
  positions?: { label?: string; holders?: { handle: string }[]; points?: string[] }[];
  timeline?: Timeline[];
  rootUrl?: string;
}
interface CallRec {
  id: string;
  series: string;
  number: number;
  date: string;
  title: string;
  lead?: string;
  summary?: string;
  highlights?: string[];
  forkcastUrl?: string;
  decisions?: { label?: string; text: string; original?: string }[];
  topics?: { positions?: { original?: string }[] }[];
}
export interface WeeklyData {
  digests: DigestRec[];
  debates: DebateRec[];
  calls: CallRec[];
  inbox: InboxEntry[];
}
/** 콜의 forkcast 요약(tldr 하이라이트 등) 원문. 없으면 null */
export type FetchCallSource = (call: { id: string; series: string; number: number; date: string }) => Promise<string | null>;

const BATCH = 8;
const MAX_CLAIM = 2500;
const REPORT_MAX = 3500;

export const daysBefore = (date: string, n: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

const inWindow = (d: string | undefined, since: string, today: string): boolean => !!d && d >= since && d <= today;
const cut = (s: string, n: number): string => s.slice(0, n);

export async function collectTargets(
  data: WeeklyData,
  since: string,
  today: string,
  fetchCallSource: FetchCallSource = async () => null,
): Promise<Target[]> {
  const out: Target[] = [];

  const sources = new Map<string, string>();
  for (const i of data.inbox) if (i.summary && !sources.has(i.url)) sources.set(i.url, contextOf(i, data.inbox));
  for (const d of data.digests.filter((x) => inWindow(x.date, since, today))) {
    const items = d.sections.flatMap((s) => s.items);
    for (const it of items) {
      out.push({
        kind: 'digest',
        date: d.date,
        title: it.title,
        claim: `제목: ${it.title}\n요약: ${it.summary}\n의미: ${it.why}`,
        source: lookup(sources, it.url) ?? '',
        urls: [it.url],
      });
    }
    // 인트로는 그 호의 최종 항목과 대조한다
    out.push({
      kind: 'digest',
      date: d.date,
      title: '인트로',
      claim: d.intro,
      source: items.map((i) => `- ${i.title}: ${i.summary}`).join('\n'),
      urls: [],
    });
  }

  for (const b of data.debates) {
    const tl = b.timeline ?? [];
    if (!tl.some((t) => inWindow(t.date ?? t.digest, since, today))) continue;
    const claim = [
      `요약: ${b.summary}`,
      ...(b.keyPoints ?? []).map((k) => `쟁점: ${k}`),
      ...(b.positions ?? []).map(
        (p) => `입장 "${p.label ?? ''}" (${(p.holders ?? []).map((h) => `@${h.handle}`).join(', ')}):\n${(p.points ?? []).map((x) => `  - ${x}`).join('\n')}`,
      ),
    ].join('\n');
    const withOrig = tl.filter((t) => t.original);
    const authors = new Set(tl.map((t) => (t.by ?? '').replace(/^@/, '').toLowerCase()).filter(Boolean));
    const ghost = authors.size
      ? [...new Set((b.positions ?? []).flatMap((p) => (p.holders ?? []).map((h) => h.handle)))].filter((h) => !authors.has(h.replace(/^@/, '').toLowerCase()))
      : [];
    out.push({
      kind: 'debate',
      date: [...tl].map((t) => t.date ?? t.digest ?? '').sort().pop() ?? '',
      title: b.title,
      claim: cut(claim, MAX_CLAIM),
      source: withOrig.map((t) => `@${t.by ?? '?'} (${t.url ?? ''}): ${t.original}`).join('\n---\n'),
      urls: withOrig.map((t) => t.url ?? '').filter(Boolean).slice(0, 3),
      mech: ghost.length ? `입장 주인 ${ghost.map((h) => `@${h}`).join(', ')} 가 타임라인 원문에 없음` : undefined,
    });
  }

  for (const c of data.calls.filter((x) => inWindow(x.date, since, today))) {
    const claim = [
      c.lead && `요약: ${c.lead}`,
      ...(c.highlights ?? []).map((h) => `하이라이트: ${h}`),
      ...(c.decisions ?? []).map((d) => `결정 ${d.label ?? ''}: ${d.text}`),
    ]
      .filter(Boolean)
      .join('\n');
    const remote = await fetchCallSource(c).catch(() => null);
    const local = [
      ...(c.decisions ?? []).map((d) => d.original ?? ''),
      ...(c.topics ?? []).flatMap((t) => (t.positions ?? []).map((p) => p.original ?? '')),
    ].filter(Boolean);
    out.push({
      kind: 'call',
      date: c.date,
      title: c.title,
      claim: cut(claim, MAX_CLAIM),
      source: [remote, ...local].filter(Boolean).join('\n---\n'),
      urls: c.forkcastUrl ? [c.forkcastUrl] : [],
    });
  }
  return out;
}

const VerdictSchema = z.array(
  z.object({
    n: z.number(),
    grade: z.enum(['ok', 'contradiction', 'overreach']),
    problem: z.string().optional(),
    quote: z.string().optional(),
  }),
);

function parseArray(text: string): unknown {
  const s = text.indexOf('[');
  const e = text.lastIndexOf(']');
  if (s === -1 || e === -1) throw new Error('응답에 JSON 배열 없음');
  return JSON.parse(text.slice(s, e + 1));
}

const prompt = (batch: Target[]): string => `당신은 사실 점검관입니다. 각 항목의 "서술"을 "원문"과 대조해 등급을 매기세요.
- contradiction: 원문과 모순. 주인 오귀속(그 말을 한 사람이 아님), 입장·방향 반대, 수치·번호 틀림.
- overreach: 원문보다 넓히거나 확정을 앞당김. 제안·논의를 결정·완료로 씀, 특정 조건의 수치를 일반화, 원문에 없는 기술명을 붙임.
- ok: 그 밖의 모두. 원문에 없는 내용이 더 있는 것은 다른 출처에서 왔을 수 있으니 문제가 아닙니다.
사실 진술(누가 무엇을 했다·결정됐다·수치·이름)만 등급을 매기세요. 「의미」 문단의 해석·전망(인과 해석, 앞으로의 의미)은 overreach 가 아닙니다.
문제가 있으면 problem(한 줄)과 quote(근거가 되는 원문 한 구절, 원문 그대로)를 쓰세요.
JSON 배열만 답하세요: [{"n":1,"grade":"ok"},{"n":2,"grade":"overreach","problem":"...","quote":"..."}]  (모든 번호에 대해)

${batch.map((t, k) => `[${k + 1}] (${KIND_LABEL[t.kind]}) ${t.title}\n서술:\n${t.claim}\n원문:\n${cut(t.source, MAX_SOURCE)}`).join('\n\n')}`;

export function weeklyFactcheck(targets: Target[], since: string, today: string, ask: Ask): WeeklyResult {
  const mechIssues = targets
    .filter((t) => t.mech)
    .map((t): Issue => ({ kind: t.kind, date: t.date, title: t.title, grade: 'contradiction', problem: t.mech as string, quote: '', urls: t.urls }));
  const checkable = targets.filter((t) => t.source.trim());
  const result: WeeklyResult = { since, today, checked: 0, held: targets.length - checkable.length, issues: mechIssues, failures: [] };
  for (let i = 0; i < checkable.length; i += BATCH) {
    const batch = checkable.slice(i, i + BATCH);
    try {
      const verdicts = VerdictSchema.parse(parseArray(ask(prompt(batch))));
      result.checked += batch.length;
      for (const v of verdicts) {
        const t = batch[v.n - 1];
        if (!t || v.grade === 'ok') continue;
        result.issues.push({
          kind: t.kind,
          date: t.date,
          title: t.title,
          grade: v.grade,
          problem: v.problem || '원문과 어긋남',
          quote: v.quote ?? '',
          urls: t.urls,
        });
      }
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      result.failures.push(`검사 실패: ${batch.map((t) => `${KIND_LABEL[t.kind]} ${t.title}`).slice(0, 3).join(', ')} 등 ${batch.length}건 (${cut(why, 80)})`);
    }
  }
  return result;
}

const block = (i: Issue): string =>
  [
    `[${GRADE_LABEL[i.grade]}] ${KIND_LABEL[i.kind]} ${i.date.slice(5)} · ${i.title}`,
    `문제: ${i.problem}`,
    i.quote && `근거: "${i.quote}"`,
    ...i.urls.slice(0, 2),
  ]
    .filter(Boolean)
    .join('\n');

/** 오너 DM 텍스트. 문제도 실패도 없으면 빈 문자열. 길면 모순 먼저, 나머지는 개수로 요약 */
export function formatReport(r: WeeklyResult, max = REPORT_MAX): string {
  if (r.issues.length === 0 && r.failures.length === 0) return '';
  const sorted = [...r.issues].sort(
    (a, b) => (a.grade === b.grade ? 0 : a.grade === 'contradiction' ? -1 : 1) || b.date.localeCompare(a.date),
  );
  const head = `${r.since} ~ ${r.today} · 검사 ${r.checked}건 · 문제 ${r.issues.length}건 · 원문 없어 보류 ${r.held}건`;
  const tail = r.failures.join('\n');
  const parts: string[] = [];
  let used = head.length + tail.length + 120; // 요약 줄 여유
  let k = 0;
  for (; k < sorted.length; k++) {
    const b = block(sorted[k]);
    if (used + b.length + 2 > max) break;
    parts.push(b);
    used += b.length + 2;
  }
  const rest = sorted.slice(k);
  if (rest.length) {
    const n = (g: Grade) => rest.filter((i) => i.grade === g).length;
    parts.push(`외 ${rest.length}건 생략 (모순 ${n('contradiction')}, 과대 ${n('overreach')})`);
  }
  return [head, ...parts, tail].filter(Boolean).join('\n\n').slice(0, max);
}

/** 인박스 여러 시점 버전(최신 먼저)을 url 기준으로 합친다. 같은 url 은 앞(최신) 것이 이긴다. 형식이 깨진 버전은 건너뜀 */
export function mergeInboxVersions(versions: unknown[]): InboxEntry[] {
  const seen = new Map<string, InboxEntry>();
  for (const v of versions) {
    const items = (v as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) continue;
    for (const i of items as InboxEntry[]) if (i && typeof i.url === 'string' && !seen.has(i.url)) seen.set(i.url, i);
  }
  return [...seen.values()];
}
