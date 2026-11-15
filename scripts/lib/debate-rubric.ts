/**
 * 논쟁 정리 채점표 — 정리된 논쟁 레코드가 실제 트윗 논쟁을 제대로 반영했는지 100점으로 잰다.
 * 기계 검사 40점(이 파일, 결정적) + 모델 판정 60점(scripts/score-debates.ts가 원문과 대조).
 */
import { z } from 'zod';
import type { DebateDraft } from './eth-debates';

type Debate = Pick<DebateDraft, 'id' | 'title' | 'summary' | 'keyPoints' | 'positions' | 'timeline'>;

export const RUBRIC = [
  { key: 'attribution', max: 10, by: 'code', label: '인용 귀속', desc: '인용 URL의 작성자 핸들이 발화자(by)와 같다' },
  { key: 'original', max: 5, by: 'code', label: '원문 확보', desc: '인용마다 트윗 원문 전문이 있다' },
  { key: 'stanceLink', max: 10, by: 'code', label: '입장·발언 연결', desc: '발화자가 입장 목록에 있고 발언 입장과 같은 쪽이다' },
  { key: 'bothSides', max: 10, by: 'code', label: '양측 발언', desc: '서로 다른 두 입장 모두 실제 인용이 있다' },
  { key: 'exchange', max: 5, by: 'code', label: '맞대응', desc: '입장이 다른 사람에게 직접 답글·인용한 발언이 있다' },
  { key: 'isDebate', max: 15, by: 'model', label: '논쟁 성립', desc: '동의·농담·정보 공유가 아니라 실제 의견 대립이다' },
  { key: 'fidelity', max: 15, by: 'model', label: '원문 충실도', desc: '요약·논거·인용 번역이 원문에 근거하고 지어내거나 과장하지 않았다' },
  { key: 'stance', max: 10, by: 'model', label: '입장 분류', desc: '각 발언의 찬반 분류가 원문 내용과 맞다' },
  { key: 'issue', max: 10, by: 'model', label: '쟁점 명확성', desc: '제목·핵심 쟁점이 실제로 갈리는 지점을 짚는다' },
  { key: 'balance', max: 10, by: 'model', label: '균형', desc: '양쪽 논거를 비슷한 깊이로 공정하게 담았다' },
] as const;

export type RubricKey = (typeof RUBRIC)[number]['key'];
export const MODEL_KEYS = RUBRIC.filter((r) => r.by === 'model').map((r) => r.key);

const norm = (s: string) => s.replace(/^@/, '').toLowerCase();
export const urlHandle = (url: string): string | undefined => url.match(/x\.com\/([^/]+)\/status\//i)?.[1]?.toLowerCase();

/** by(핸들 또는 이름)를 입장 목록의 인물로 찾는다 */
function holderOf(d: Debate, by: string) {
  const b = norm(by);
  for (const p of d.positions) for (const h of p.holders) {
    if ((h.handle && norm(h.handle) === b) || norm(h.name) === b) return { holder: h, stance: p.stance };
  }
  return undefined;
}

const ratio = (n: number, of: number) => (of === 0 ? 0 : n / of);

/** 기계 검사 점수와 걸린 문제 목록 */
export function codeScores(d: Debate): { scores: Record<string, number>; problems: string[] } {
  const problems: string[] = [];
  const tl = d.timeline;

  const misattributed = tl.filter((t) => {
    const u = urlHandle(t.url);
    const h = holderOf(d, t.by)?.holder.handle ?? t.by;
    return u !== undefined && u !== norm(h);
  });
  for (const t of misattributed.slice(0, 3)) problems.push(`인용 귀속 불일치: by=${t.by}, URL 작성자=${urlHandle(t.url)}`);

  const withOriginal = tl.filter((t) => t.original?.trim()).length;
  if (withOriginal < tl.length) problems.push(`원문 없는 인용 ${tl.length - withOriginal}개`);

  const linked = tl.filter((t) => {
    const h = holderOf(d, t.by);
    return h && (!t.stance || t.stance === h.stance);
  });
  if (linked.length < tl.length) problems.push(`입장 목록과 안 맞는 발언 ${tl.length - linked.length}개`);

  const opposing = new Set(tl.map((t) => t.stance ?? holderOf(d, t.by)?.stance).filter((s) => s && s !== 'neutral'));
  if (opposing.size < 2) problems.push('한쪽 입장의 인용만 있음');

  const stanceOfHandle = (handle?: string) => (handle ? holderOf(d, handle)?.stance : undefined);
  const exchanged = tl.some((t) => {
    if (!t.replyTo || t.relation === 'none') return false;
    const mine = t.stance ?? holderOf(d, t.by)?.stance;
    const theirs = stanceOfHandle(t.replyTo);
    return norm(t.replyTo) !== norm(t.by) && mine && theirs && mine !== theirs;
  });
  if (!exchanged) problems.push('입장이 다른 사람끼리 주고받은 답글·인용이 없음');

  return {
    scores: {
      attribution: Math.round(10 * ratio(tl.length - misattributed.length, tl.length)),
      original: Math.round(5 * ratio(withOriginal, tl.length)),
      stanceLink: Math.round(10 * ratio(linked.length, tl.length)),
      bothSides: opposing.size >= 2 ? 10 : 0,
      exchange: exchanged ? 5 : 0,
    },
    problems,
  };
}

export const ModelVerdictSchema = z.object({
  scores: z.array(
    z.object({
      id: z.string(),
      isDebate: z.number().min(0).max(15),
      fidelity: z.number().min(0).max(15),
      stance: z.number().min(0).max(10),
      issue: z.number().min(0).max(10),
      balance: z.number().min(0).max(10),
      problems: z.array(z.string()).transform((a) => a.slice(0, 4)),
    }),
  ),
});
export type ModelVerdict = z.infer<typeof ModelVerdictSchema>['scores'][number];

export const grade = (total: number) => (total >= 85 ? '좋음' : total >= 70 ? '손볼 곳 있음' : '다시 정리');

/** 모델에게 보낼 레코드 요약 (아바타·메타데이터 제외, 원문 포함) */
export function judgeView(d: Debate) {
  return {
    id: d.id,
    title: d.title,
    summary: d.summary,
    keyPoints: d.keyPoints,
    positions: d.positions.map((p) => ({ stance: p.stance, label: p.label, holders: p.holders.map((h) => h.handle ?? h.name), points: p.points })),
    timeline: d.timeline.map((t) => ({ by: t.by, stance: t.stance, quote: t.quote, original: t.original ?? '(원문 없음)', replyTo: t.replyTo })),
  };
}

export function judgePrompt(debates: Debate[]): string {
  const rubric = RUBRIC.filter((r) => r.by === 'model').map((r) => `- ${r.key} (0~${r.max}): ${r.label}. ${r.desc}`).join('\n');
  return `너는 이더리움 커뮤니티 논쟁 아카이브의 검수자다. 아래 논쟁 레코드들은 X(트위터) 스레드를 모델이 정리한 것이다.
각 레코드를 timeline[].original(트윗 원문)과 대조해 다음 항목을 채점하라. 원문에 없는 내용은 근거로 쓰지 마라.

${rubric}

채점 기준:
- 만점은 흠이 없을 때만 준다. 원문과 어긋나는 문장 하나마다 fidelity를 깎는다.
- 같은 편끼리 맞장구친 것, 한 사람의 독백, 정보 공유를 논쟁으로 포장했으면 isDebate를 크게 깎는다.
- 원문이 남에게 답하는 글인데 그 사람의 주장으로 적었으면 stance와 fidelity를 깎는다.
- problems에는 고쳐야 할 구체적 문제를 한국어 한 문장씩, 최대 4개(인물·인용을 짚어서). 문제 없으면 빈 배열.

JSON만 출력하라: {"scores":[{"id":"...","isDebate":0,"fidelity":0,"stance":0,"issue":0,"balance":0,"problems":["..."]}]}

레코드:
${JSON.stringify(debates.map(judgeView), null, 1)}`;
}
