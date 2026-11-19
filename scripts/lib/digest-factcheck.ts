/**
 * 다이제스트 사실 검사. 생성 모델과 별개로 각 항목 문장을 인용 원문(인박스 summary)과 대조해
 * 주어 오귀속·입장 뒤집힘·수치 오류를 잡고 고친다 (2026-11-16 호: wolovim 트윗을 barnabemonnot 발언으로 서술).
 * 모델 호출은 ask 로 주입받는다. 검사가 실패해도 원본을 그대로 돌려줘 출고를 막지 않는다.
 */
import { z } from 'zod';

export interface CheckItem {
  title: string;
  summary: string;
  why: string;
  url: string;
  source: string;
  date: string;
}
export interface CheckDigest {
  intro: string;
  sections: { heading: string; items: CheckItem[] }[];
}
export interface InboxEntry {
  url: string;
  author: string;
  summary: string;
  conversationId?: string;
}
export type Ask = (prompt: string) => string;

const CHUNK = 30;
export const MAX_SOURCE = 4000;
const CTX_SEP = '\n---\n'; // 대화 맥락이 붙은 원문(논쟁·스레드)은 다른 참여자가 주어일 수 있어 lead 검사를 하지 않는다
export const NO_SOURCE = '원문 없음';

const JudgeSchema = z.array(z.object({ n: z.number(), ok: z.boolean(), problem: z.string().optional() }));
const FixSchema = z.array(z.object({ n: z.number(), title: z.string(), summary: z.string(), why: z.string() }));
const IntroSchema = z.object({ intro: z.string() });

const handleOf = (url: string): string | undefined =>
  /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)\/status\//i.exec(url)?.[1]?.toLowerCase();

const statusId = (url: string): string | undefined => /\/status\/(\d+)/.exec(url)?.[1];

// 정확한 url → 쿼리 뺀 url → 같은 status id (계정이 잘못 박힌 옛 url 도 같은 트윗으로 찾는다)
export const lookup = <T>(map: Map<string, T>, url: string): T | undefined => {
  const hit = map.get(url) ?? map.get(url.split('?')[0]);
  if (hit !== undefined) return hit;
  const id = statusId(url);
  if (!id) return undefined;
  for (const [k, v] of map) if (statusId(k) === id) return v;
  return undefined;
};

function parseJson(text: string, open: '[' | '{'): unknown {
  const close = open === '[' ? ']' : '}';
  const t = text.trim();
  const s = t.indexOf(open);
  const e = t.lastIndexOf(close);
  if (s === -1 || e === -1) throw new Error(`응답에 JSON ${open === '[' ? '배열' : '객체'} 없음`);
  return JSON.parse(t.slice(s, e + 1));
}

/** 코드 대조: 링크 계정 ≠ 인박스 author, 또는 요약 맨 앞 계정이 링크 계정과 다른 알려진 계정 */
export function mechanicalIssues(
  digest: CheckDigest,
  inboxByUrl: Map<string, { author: string }>,
  sources: Map<string, string> = new Map(),
): Map<CheckItem, string> {
  return new Map([...mech(digest, inboxByUrl, sources)].map(([i, m]) => [i, m.problem]));
}

/** lead: 앞머리 계정 불일치로 걸렸을 때 그 잘못된 핸들 */
function mech(
  digest: CheckDigest,
  inboxByUrl: Map<string, { author: string }>,
  sources: Map<string, string>,
): Map<CheckItem, { problem: string; lead?: string }> {
  const known = new Set([...inboxByUrl.values()].map((i) => i.author.replace(/^@/, '').toLowerCase()));
  const out = new Map<CheckItem, { problem: string; lead?: string }>();
  for (const item of digest.sections.flatMap((s) => s.items)) {
    const urlHandle = handleOf(item.url);
    if (!urlHandle) continue;
    // 글쓴이 대조는 url 이 정확히 같은 인박스 항목만 근거로 쓴다 (같은 status id 의 옛 사본은 author 가 틀릴 수 있다)
    const author = (inboxByUrl.get(item.url) ?? inboxByUrl.get(item.url.split('?')[0]))?.author.replace(/^@/, '').toLowerCase();
    if (author && author !== urlHandle) {
      out.set(item, { problem: `링크 글쓴이는 @${urlHandle}인데 인박스 author 는 @${author}` });
      continue;
    }
    for (const text of [item.summary, item.title]) {
      const lead = /^\s*@?([A-Za-z0-9_]{1,15})\b/.exec(text)?.[1]?.toLowerCase();
      // 원문(대화 맥락 포함)에 그 핸들이 나오면 정상(논쟁 항목 등). 원문이 없으면 검사하지 않는다
      const source = lookup(sources, item.url)?.toLowerCase();
      if (lead && lead !== urlHandle && known.has(lead) && source && !source.includes(CTX_SEP) && !source.includes(lead)) {
        out.set(item, { problem: `링크 글쓴이는 @${urlHandle}인데 문장이 @${lead} 의 발언처럼 시작함`, lead });
        break;
      }
    }
  }
  return out;
}

const src = (sources: Map<string, string>, url: string): string =>
  (lookup(sources, url) || NO_SOURCE).slice(0, MAX_SOURCE);

const render = (items: CheckItem[], sources: Map<string, string>): string =>
  items
    .map((i, k) => `[${k + 1}] 제목: ${i.title}\n요약: ${i.summary}\n의미: ${i.why}\nURL: ${i.url}\n원문: ${src(sources, i.url)}`)
    .join('\n\n');

/** 모델 판정. 원문 없는 항목은 보류(ok). 반환: 문제 있는 항목 → 문제 설명 */
export function judgeItems(items: CheckItem[], sources: Map<string, string>, ask: Ask): Map<CheckItem, string> {
  const out = new Map<CheckItem, string>();
  const checkable = items.filter((i) => src(sources, i.url) !== NO_SOURCE);
  for (let c = 0; c < checkable.length; c += CHUNK) {
    const chunk = checkable.slice(c, c + CHUNK);
    const prompt = `당신은 사실 검사관입니다. 아래 다이제스트 항목(제목·요약·의미)이 각 항목의 "원문"과 맞는지 대조하세요.
확인할 것: (1) 주어: 누가 말하거나 행동했는가 (2) 입장: 찬성·반대·주장 방향이 원문과 같은가 (3) 수치·이름·EIP 번호가 원문과 맞는가.
원문은 링크 트윗과 같은 대화의 다른 글입니다. 원문에 없는 내용이 더 있는 것은 다른 출처에서 왔을 수 있으니 문제가 아닙니다.
원문과 **모순**되는 것만 ok=false 와 problem(한 줄)으로 쓰세요: 원문 글쓴이가 아닌 사람을 그 말의 주인으로 씀, 입장·방향이 반대, 수치·EIP 번호가 틀림.
JSON 배열만 답하세요: [{"n":1,"ok":true},{"n":2,"ok":false,"problem":"..."}]  (모든 번호에 대해)

${render(chunk, sources)}`;
    const verdicts = JudgeSchema.parse(parseJson(ask(prompt), '['));
    for (const v of verdicts) {
      const item = chunk[v.n - 1];
      if (item && !v.ok) out.set(item, v.problem || '원문과 어긋남');
    }
  }
  return out;
}

/** 걸린 항목만 원문 기준으로 고친다. 답이 없는 항목은 결과에서 빠진다 (url·source·date 는 유지) */
export function fixItems(
  flagged: { item: CheckItem; problem: string }[],
  sources: Map<string, string>,
  ask: Ask,
): Map<CheckItem, CheckItem> {
  const out = new Map<CheckItem, CheckItem>();
  for (let c = 0; c < flagged.length; c += CHUNK) {
    const chunk = flagged.slice(c, c + CHUNK);
    const body = chunk
      .map(
        ({ item: i, problem }, k) =>
          `[${k + 1}] 제목: ${i.title}\n요약: ${i.summary}\n의미: ${i.why}\nURL: ${i.url}\n문제: ${problem}\n원문: ${src(sources, i.url)}`,
      )
      .join('\n\n');
    const prompt = `아래 다이제스트 항목에 사실 오류가 있습니다. "문제"를 바로잡도록 제목·요약·의미를 원문에 맞게 고치세요.
원문은 URL 계정(@X) 본인이 쓴 글입니다. 원문에 나오지 않는 사람을 주어나 대상으로 쓰지 마세요. 원문에 없는 내용은 쓰지 말고, 주어(누가 말했나)는 URL 계정의 실제 작성자 기준으로 쓰세요. 문체와 길이는 유지하세요.
JSON 배열만 답하세요: [{"n":1,"title":"...","summary":"...","why":"..."}]

${body}`;
    for (const f of FixSchema.parse(parseJson(ask(prompt), '['))) {
      const orig = chunk[f.n - 1]?.item;
      if (orig) out.set(orig, { ...orig, title: f.title, summary: f.summary, why: f.why });
    }
  }
  return out;
}

export function factcheckDigest<D extends CheckDigest>(
  digest: D,
  inbox: InboxEntry[],
  ask: Ask,
): { digest: D; report: string[] } {
  try {
    return run(digest, inbox, ask);
  } catch (error) {
    return { digest, report: [`검사 실패: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

/** 링크 트윗을 맨 앞에, 같은 conversationId 의 다른 항목(author: summary)을 뒤에 붙인다 (합계 MAX_SOURCE 자) */
export function contextOf(main: InboxEntry, inbox: InboxEntry[]): string {
  const rest = main.conversationId
    ? inbox.filter((o) => o !== main && o.summary && o.conversationId === main.conversationId)
    : [];
  return [main.summary, ...rest.map((o) => `@${o.author.replace(/^@/, '')}: ${o.summary}`)].join(CTX_SEP).slice(0, MAX_SOURCE);
}

function run<D extends CheckDigest>(
  digest: D,
  inbox: InboxEntry[],
  ask: Ask,
): { digest: D; report: string[] } {
  const byUrl = new Map<string, { author: string }>();
  const sources = new Map<string, string>();
  for (const i of inbox) {
    if (!byUrl.has(i.url)) byUrl.set(i.url, i);
    if (i.summary && !sources.has(i.url)) sources.set(i.url, contextOf(i, inbox));
  }

  const all = digest.sections.flatMap((s) => s.items);
  const problems = new Map<CheckItem, string>(judgeItems(all, sources, ask));
  // 기계 대조에서 걸린 항목은 모델 판정과 무관하게 고친다
  const mechs = mech(digest, byUrl, sources);
  for (const [item, { problem: p }] of mechs) {
    const model = problems.get(item);
    problems.set(item, model ? `${p}; ${model}` : p);
  }
  if (problems.size === 0) return { digest, report: [] };

  const fixed = fixItems([...problems].map(([item, problem]) => ({ item, problem })), sources, ask);
  const stillBad = judgeItems([...fixed.values()], sources, ask);
  const report: string[] = [];
  const replace = new Map<CheckItem, CheckItem | null>();
  for (const [item, problem] of problems) {
    const f = fixed.get(item);
    const stillMech = f ? mech({ intro: '', sections: [{ heading: '', items: [f] }] }, byUrl, sources).has(f) : true;
    // 앞머리 계정 문제였다면 잘못된 핸들이 고친 글에 그대로 남아 있는지(원문에는 없는데) 결정적으로 확인
    const lead = mechs.get(item)?.lead;
    const leadLeft = !!(f && lead && `${f.title} ${f.summary}`.toLowerCase().includes(lead));
    if (f && !stillBad.has(f) && !stillMech && !leadLeft) {
      replace.set(item, f);
      report.push(`고침: ${item.title} — ${problem}`);
    } else {
      replace.set(item, null);
      report.push(`뺌: ${item.title} — ${problem}`);
    }
  }

  const sections = digest.sections
    .map((s) => ({
      ...s,
      items: s.items.flatMap((i) => (replace.has(i) ? (replace.get(i) ? [replace.get(i) as CheckItem] : []) : [i])),
    }))
    .filter((s) => s.items.length > 0);
  let next = { ...digest, sections } as D;

  const list = sections
    .flatMap((s) => s.items)
    .map((i) => `- ${i.title}: ${i.summary}`)
    .join('\n');
  const prompt = `다이제스트 항목 일부가 사실 오류로 고쳐지거나 빠졌습니다. 아래 인트로(에디터 칼럼)를 최종 항목 목록과 대조해,
항목과 어긋나는 문장(사람·입장·사실)이 있으면 그 부분만 고친 인트로를, 없으면 원래 인트로를 그대로 돌려주세요. 문체와 분량은 유지하세요.
JSON 객체만 답하세요: {"intro":"..."}

[인트로]
${digest.intro}

[최종 항목]
${list}`;
  const { intro } = IntroSchema.parse(parseJson(ask(prompt), '{'));
  if (intro.trim() && intro !== digest.intro) {
    next = { ...next, intro };
    report.push('고침: 인트로 — 최종 항목과 어긋난 문장 정리');
  }
  return { digest: next, report };
}
