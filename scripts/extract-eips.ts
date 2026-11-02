/**
 * EIP 해설 추출 — 코어 개발자 콜에 나온 EIP의 원문을 받아 한국어 해설(쉬운 설명 + 심층 설명)을 쓰고 src/data/eips.json에 쌓는다.
 * 원문은 GitHub ethereum/EIPs(없으면 ethereum/ERCs)에서 받고, EIP당 모델 1회 + im-not-ai 윤문 1회. 검수 없이 자동 공개(오너 결정 2026-11-02).
 * 매 실행마다 원문 상태(Draft→Final 등)는 모델 없이 새로 고치고, 해설은 새 EIP와 원문이 바뀐 지 오래된 것만 EIPS_LIMIT개씩 쓴다.
 *
 * env: EIPS_LIMIT(한 번에 쓸 수, 기본 3) · EIPS(번호 쉼표 목록 — 있는 것도 다시 씀) · EIPS_MODEL(기본 fable)
 *      EIPS_DRY_RUN=1(대상과 프롬프트 앞부분만 출력, 저장 안 함) · HUMANIZE_OFF=1(윤문 끔)
 *      EIPS_SCOPE=all(콜에 나온 것 다음으로 ethereum/EIPs 저장소의 모든 EIP까지 대상. 기본은 콜에 나온 것만. 순서는 lib/eips.ts orderAll)
 *      EIPS_SHARD=1/2(작업자 여럿이 대상을 나눠 가짐. 저장은 잠금 후 다시 읽어 합치므로 동시에 돌려도 안전)
 *      EIPS_REUSE=1(.cache/eips/<n>.out.txt에 남은 모델 응답을 다시 씀, 모델 호출 없이 검증·윤문만)
 */
import fs from 'fs';
import { ZodError } from 'zod';
import path from 'path';
import * as dotenv from 'dotenv';
import { runClaude } from './lib/claude';
import { inShard, parseShard, updateJsonLocked } from './lib/json-lock';
import { extractJson } from './lib/eth-debates';
import { humanizeTexts, normalizeTerms } from './lib/humanize';
import { callLabel } from './lib/eth-calls';
import { EipDraftSchema, buildPrompt, eipsInCalls, orderAll, hashOf, metaOf, pickTargets, proseOf, refreshMeta, toRecord, upsertRecords, withProse, type EipContext } from './lib/eips';
import type { EipMeta, EipsFile } from '../src/data/eipsData';
import { isPublishable } from '../src/utils/debates';
import type { Debate } from '../src/data/ethDebatesData';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATA = path.resolve(process.cwd(), 'src/data');
const FILE = path.join(DATA, 'eips.json');
const CACHE_DIR = path.resolve(process.cwd(), '.cache/eips');
const MODEL = process.env.EIPS_MODEL ?? 'fable';
const LIMIT = Number(process.env.EIPS_LIMIT ?? 3);
const DRY = Boolean(process.env.EIPS_DRY_RUN);
const ONLY = (process.env.EIPS ?? '').split(',').map(Number).filter((n) => n > 0);
const CACHE_HOURS = 20;
const SCOPE_ALL = process.env.EIPS_SCOPE === 'all';
const SHARD = parseShard(process.env.EIPS_SHARD);

/** ethereum/EIPs 저장소의 EIP 번호 전체 (트리 API 한 번) */
async function allEipNumbers(): Promise<number[]> {
  const r = await fetch('https://api.github.com/repos/ethereum/EIPs/git/trees/master?recursive=1', {
    headers: { accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`EIP 목록 받기 실패: HTTP ${r.status}`);
  const { tree } = (await r.json()) as { tree: Array<{ path: string }> };
  return tree.map((x) => /^EIPS\/eip-(\d+)\.md$/.exec(x.path)?.[1]).filter((x): x is string => Boolean(x)).map(Number);
}

type Call = { id: string; series: string; number: number; date: string; kind?: string; eips?: number[]; decisions?: Array<{ eips?: number[]; status: string; text: string; fork?: string }> };

const readJson = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf-8')) as T;

/**
 * 원문·논쟁은 남이 쓴 글이고 결과는 검수 없이 공개된다. 모델은 도구 없이 글만 쓰고(noTools),
 * 결과에 이 기계의 비밀값이 섞이면 버린다 (프롬프트 주입으로 .env를 읽게 하는 경우 대비)
 */
const run = (prompt: string) => runClaude(prompt, MODEL, undefined, { noTools: true });
const SECRETS = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '.env.local')]
  .filter((f) => fs.existsSync(f))
  .flatMap((f) => Object.values(dotenv.parse(fs.readFileSync(f))))
  .filter((v) => v.length >= 12);
const leaks = (value: unknown): boolean => {
  const text = JSON.stringify(value);
  return SECRETS.some((v) => text.includes(v));
};

/** 원문 마크다운. EIP 저장소에 없으면 ERC 저장소. 없으면 null (아직 PR만 있는 번호 등) */
async function fetchSource(n: number): Promise<string | null> {
  const cached = path.join(CACHE_DIR, `${n}.md`);
  if (fs.existsSync(cached) && Date.now() - fs.statSync(cached).mtimeMs < CACHE_HOURS * 3600e3) {
    const text = fs.readFileSync(cached, 'utf-8');
    return text || null;
  }
  let text = '';
  for (const url of [`https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-${n}.md`, `https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-${n}.md`]) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (r.ok) {
        text = await r.text();
        break;
      }
      // 404만 "그 저장소에 없음". 5xx·429 같은 일시 오류는 빈 원문으로 캐시하지 않는다
      if (r.status !== 404) {
        console.warn(`[WARN] EIP-${n} 원문 받기 실패: HTTP ${r.status}`);
        return null;
      }
    } catch (error) {
      console.warn(`[WARN] EIP-${n} 원문 받기 실패: ${error instanceof Error ? error.message : error}`);
      return null; // 네트워크 오류는 빈 원문으로 캐시하지 않는다
    }
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cached, text, 'utf-8');
  return text || null;
}

function contextOf(n: number, markdown: string, calls: Call[], debates: Debate[]): EipContext {
  const md = (d: string) => d.slice(5).replace('-', '.');
  const decisions = calls
    .filter((c) => c.kind === 'full' && ((c.eips ?? []).includes(n) || (c.decisions ?? []).some((d) => (d.eips ?? []).includes(n))))
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((c) => {
      const ds = (c.decisions ?? []).filter((d) => (d.eips ?? []).includes(n));
      const label = `${md(c.date)} ${callLabel(c)}`;
      return ds.length ? ds.map((d) => `${label} [${d.status}${d.fork ? ` · ${d.fork}` : ''}] ${d.text}`) : [`${label} 논의 (결정 없음)`];
    });
  const re = new RegExp(`EIP-?${n}(?!\\d)`);
  return {
    number: n,
    markdown,
    decisions,
    // 사이트에 노출되는 논쟁만 (오너가 거른 논쟁 내용이 공개 해설로 새지 않게)
    debates: debates.filter((d) => isPublishable(d) && re.test(`${d.title} ${d.summary}`)).map((d) => `${d.title}: ${d.summary.slice(0, 300)}`),
  };
}

async function main() {
  const calls = readJson<{ calls: Call[] }>(path.join(DATA, 'eth-calls.json')).calls;
  const debates = readJson<{ debates: Debate[] }>(path.join(DATA, 'eth-debates.json')).debates;
  let file = readJson<EipsFile>(FILE);

  const callOrder = eipsInCalls(calls).map((x) => x.number);
  const candidates = ONLY.length ? ONLY : SCOPE_ALL ? [...new Set([...callOrder, ...(await allEipNumbers())])] : callOrder;
  const sources = new Map<number, string>();
  const metas = new Map<number, EipMeta>();
  for (const n of candidates) {
    const md = await fetchSource(n);
    const meta = md ? metaOf(md) : null;
    if (!md || !meta) continue;
    sources.set(n, md);
    metas.set(n, meta);
  }
  console.log(`[eips] 후보 ${candidates.length}개 중 원문 ${sources.size}개, 해설 ${file.eips.length}개`);
  file = updateJsonLocked<EipsFile>(FILE, (cur) => refreshMeta(cur, metas));

  const today = new Date().toISOString().slice(0, 10);
  const hashes = new Map([...sources].map(([n, md]) => [n, hashOf(md)]));
  const order = SCOPE_ALL ? orderAll(callOrder, metas) : candidates;
  const targets = ONLY.length ? ONLY.filter((n) => sources.has(n)) : pickTargets(inShard(order, SHARD), file.eips, hashes, today, LIMIT);
  console.log(`[eips] 이번에 쓸 EIP: ${targets.length ? targets.map((n) => `EIP-${n}`).join(', ') : '없음'}`);

  for (const n of targets) {
    const prompt = buildPrompt(contextOf(n, sources.get(n) as string, calls, debates));
    if (DRY) {
      console.log(prompt.slice(0, 2500));
      continue;
    }
    try {
      const started = Date.now();
      // 응답을 먼저 남긴다. 검증에 걸려도 EIPS_REUSE=1로 모델을 다시 부르지 않고 고칠 수 있다
      const out = path.join(CACHE_DIR, `${n}.out.txt`);
      const raw = process.env.EIPS_REUSE && fs.existsSync(out) ? fs.readFileSync(out, 'utf-8') : run(prompt);
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(out, raw, 'utf-8');
      const draft = EipDraftSchema.parse(extractJson(raw));
      const polished = withProse(draft, humanizeTexts(proseOf(draft), 'EIP 해설 페이지("~합니다" 존댓말, 비전문가용 설명과 개발자용 심층 설명)', run));
      const record = toRecord(n, metas.get(n) as EipMeta, normalizeTerms(polished), hashes.get(n) as string, MODEL, new Date(), sources.get(n) as string);
      if (leaks(record)) throw new Error('결과에 비밀값이 섞여 버립니다 (프롬프트 주입 의심)');
      // EIP마다 저장한다. 중간에 끊겨도 다음 실행이 이어 간다
      file = updateJsonLocked<EipsFile>(FILE, (cur) => upsertRecords(cur, [record], new Date()));
      console.log(`[eips] EIP-${n} ${record.titleKo} 저장 (${Math.round((Date.now() - started) / 1000)}초)`);
    } catch (error) {
      const detail = error instanceof ZodError ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : error instanceof Error ? error.message.split('\n')[0] : String(error);
      console.warn(`[WARN] EIP-${n} 해설 실패: ${detail}`);
    }
  }
}

main().catch((error) => {
  console.error('[eips] 실패:', error);
  process.exit(1);
});
