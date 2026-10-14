/**
 * im-not-ai(epoko77-ai/im-not-ai) 룰북으로 생성 결과의 한국어 문장을 윤문하는 공용 패스.
 * 다이제스트·콜 정리·주간 브리프가 같이 쓴다. 룰북은 scripts/assets/humanize-quick-rules.md (원본 복사본).
 * 실패하거나 결과가 미덥지 않으면 원문을 그대로 돌려준다 — 발행이 윤문보다 중요하다.
 * env: HUMANIZE_OFF=1 (윤문 생략)
 */
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

/** 오너가 정한 표기 (2026-10-14: 글램스테르담으로 통일). 생성 결과 전체에 적용한다 */
const TERMS: Array<[RegExp, string]> = [[/글램스터담/g, '글램스테르담']];

/** JSON으로 직렬화되는 값 전체에서 표기를 고친다 (윤문을 꺼도 적용) */
export const normalizeTerms = <T,>(value: T): T => JSON.parse(TERMS.reduce((s, [re, to]) => s.replace(re, to), JSON.stringify(value))) as T;

const RULES = path.resolve(process.cwd(), 'scripts/assets/humanize-quick-rules.md');

/** im-not-ai 과윤문 가드와 같은 기준: 길이가 원문 대비 50% 넘게 바뀌면 그 문장은 원문을 쓴다 */
const MAX_CHANGE = 0.5;
const ResultSchema = z.object({ texts: z.array(z.string()) });

/** 모델 응답에서 첫 JSON 객체를 꺼낸다 (코드펜스·앞뒤 설명 허용) */
function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in response');
  return JSON.parse(trimmed.slice(start, end + 1));
}

export const tooDifferent = (orig: string, next: string): boolean =>
  Math.abs(next.length - orig.length) / Math.max(orig.length, 1) > MAX_CHANGE;

/** 윤문 결과를 원문과 맞춘다. 개수가 다르면 순서 대응을 믿을 수 없으니 전부 원문 */
export function guardRewrites(originals: string[], rewrites: string[]): { texts: string[]; reverted: number } {
  if (rewrites.length !== originals.length) return { texts: originals, reverted: originals.length };
  let reverted = 0;
  const texts = originals.map((orig, i) => {
    const next = rewrites[i];
    if (!next || tooDifferent(orig, next)) {
      reverted += 1;
      return orig;
    }
    return next;
  });
  return { texts, reverted };
}

export function humanizePrompt(texts: string[], genre: string, rules: string): string {
  return `아래 JSON의 texts는 ${genre}의 문장들입니다. 첨부한 im-not-ai 룰북(한글 AI 티 패턴)으로 AI 티가 나는 부분만 윤문하세요.
- 장르와 어조(종결 어미 포함)는 원문 그대로 유지합니다.
- 사실, 수치, 날짜, 시각, EIP 번호, 고유명사, 인명, 소속, 직접 인용은 한 글자도 바꾸지 않습니다. 없는 내용을 더하지 않고 있는 내용을 빼지 않습니다.
- 탐지된 부분만 고칩니다. 자연스러운 문장은 그대로 둡니다. 대시(—)와 이모지는 쓰지 않습니다. 줄바꿈(\\n)은 그대로 둡니다.
- 입력과 같은 개수, 같은 순서로 {"texts": ["..."]} JSON 객체 하나만 출력합니다.

# 룰북
${rules}

# 윤문할 문장
${JSON.stringify({ texts }, null, 2)}`;
}

/**
 * 문장 배열을 윤문해 같은 길이의 배열로 돌려준다. run은 runClaude(prompt, model) 같은 호출자.
 * ponytail: 의미 보존은 프롬프트(룰북의 Do-NOT·내용 앵커)와 길이 가드에 맡긴다. 사실 대조 검증은 하지 않는다
 */
export function humanizeTexts(texts: string[], genre: string, run: (prompt: string) => string): string[] {
  if (process.env.HUMANIZE_OFF || texts.length === 0) return texts;
  try {
    const raw = run(humanizePrompt(texts, genre, fs.readFileSync(RULES, 'utf-8')));
    const { texts: out, reverted } = guardRewrites(texts, ResultSchema.parse(extractJson(raw)).texts);
    if (reverted) console.warn(`[WARN] humanize: ${reverted}/${texts.length}개 문장은 원문을 썼습니다`);
    return out;
  } catch (error) {
    console.warn('[WARN] humanize 실패, 원문으로 진행:', error instanceof Error ? error.message.split('\n')[0] : error);
    return texts;
  }
}
