/**
 * ERC 해설 추출 — ethereum/ERCs 저장소의 원문으로 한국어 해설(쉬운 설명 + 구현할 함수 + 심층 설명 + 주의할 점)을 쓰고 src/data/ercs.json에 쌓는다.
 * 매 실행마다 저장소 전체 원문 메타를 src/data/erc-index.json으로 새로 쓴다(모델 없음, 목록 통계·족보용).
 * 해설은 Final 먼저, 다른 ERC가 많이 기대는 표준 순으로 ERCS_LIMIT개씩. ERC당 모델 1회 + im-not-ai 윤문 1회, 검수 없이 자동 공개(오너 결정 2026-11-02).
 * 러너에 넣지 않았다. 오너가 말할 때 세션에서 배치로 돌린다.
 *
 * env: ERCS_LIMIT(기본 20) · ERCS(번호 쉼표 목록 — 있는 것도 다시 씀) · ERCS_MODEL(기본 fable)
 *      ERCS_SHARD=1/2(작업자 여럿이 대상을 나눠 가짐, 저장은 잠금 후 다시 읽어 합침)
 *      ERCS_DRY_RUN=1(대상과 프롬프트 앞부분만 출력) · ERCS_REUSE=1(.cache/ercs/<n>.out.txt의 모델 응답을 다시 씀) · HUMANIZE_OFF=1
 */
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { ZodError } from 'zod';
import { runClaude } from './lib/claude';
import { inShard, parseShard, updateJsonLocked } from './lib/json-lock';
import { extractJson } from './lib/eth-debates';
import { humanizeTexts, normalizeTerms } from './lib/humanize';
import { hashOf, metaOf, pickTargets } from './lib/eips';
import { ErcDraftSchema, buildErcPrompt, ercOrder, ercProseOf, refreshErcMeta, toErcRecord, toIndexEntry, upsertErcs, withErcProse } from './lib/ercs';
import type { EipMeta } from '../src/data/eipsData';
import type { ErcIndexFile, ErcsFile } from '../src/data/ercsData';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATA = path.resolve(process.cwd(), 'src/data');
const FILE = path.join(DATA, 'ercs.json');
const INDEX = path.join(DATA, 'erc-index.json');
const CACHE_DIR = path.resolve(process.cwd(), '.cache/ercs');
const MODEL = process.env.ERCS_MODEL ?? 'fable';
const LIMIT = Number(process.env.ERCS_LIMIT ?? 20);
const DRY = Boolean(process.env.ERCS_DRY_RUN);
const ONLY = (process.env.ERCS ?? '').split(',').map(Number).filter((n) => n > 0);
const CACHE_HOURS = 20;
const SHARD = parseShard(process.env.ERCS_SHARD);

const readJson = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
const writeJson = (file: string, data: unknown) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');

/** 원문·결과 공개 경로는 EIP와 같다: 모델 도구 없음, 결과에 비밀값이 섞이면 버림 */
const run = (prompt: string) => runClaude(prompt, MODEL, undefined, { noTools: true });
const SECRETS = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '.env.local')]
  .filter((f) => fs.existsSync(f))
  .flatMap((f) => Object.values(dotenv.parse(fs.readFileSync(f))))
  .filter((v) => v.length >= 12);
const leaks = (value: unknown) => {
  const text = JSON.stringify(value);
  return SECRETS.some((v) => text.includes(v));
};

async function ercNumbers(): Promise<number[]> {
  const r = await fetch('https://api.github.com/repos/ethereum/ERCs/git/trees/master?recursive=1', {
    headers: { accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`ERC 목록 받기 실패: HTTP ${r.status}`);
  const { tree } = (await r.json()) as { tree: Array<{ path: string }> };
  return tree.map((x) => /^ERCS\/erc-(\d+)\.md$/.exec(x.path)?.[1]).filter((x): x is string => Boolean(x)).map(Number);
}

async function fetchSource(n: number): Promise<string | null> {
  const cached = path.join(CACHE_DIR, `${n}.md`);
  if (fs.existsSync(cached) && Date.now() - fs.statSync(cached).mtimeMs < CACHE_HOURS * 3600e3) return fs.readFileSync(cached, 'utf-8') || null;
  try {
    const r = await fetch(`https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-${n}.md`, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) {
      console.warn(`[WARN] ERC-${n} 원문 받기 실패: HTTP ${r.status}`);
      return null;
    }
    const text = await r.text();
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cached, text, 'utf-8');
    return text;
  } catch (error) {
    console.warn(`[WARN] ERC-${n} 원문 받기 실패: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/** 동시에 몇 개씩 받는다 (625개를 하나씩 받으면 오래 걸린다) */
async function fetchAll(nums: number[], width = 12): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (let i = 0; i < nums.length; i += width) {
    const part = nums.slice(i, i + width);
    const got = await Promise.all(part.map(async (n) => [n, await fetchSource(n)] as const));
    for (const [n, md] of got) if (md) out.set(n, md);
  }
  return out;
}

async function main() {
  const nums = ONLY.length ? ONLY : await ercNumbers();
  const sources = await fetchAll(nums);
  const metas = new Map<number, EipMeta>();
  for (const [n, md] of sources) {
    const m = metaOf(md);
    if (m) metas.set(n, m);
  }

  // 전체 메타 색인은 번호 일부만 돌릴 때(ERCS=...)는 건드리지 않는다
  // 전체 메타 색인은 첫 작업자만 쓴다
  if (!ONLY.length && !DRY && SHARD.i === 0) {
    const index: ErcIndexFile = { updatedAt: new Date().toISOString(), ercs: [...metas].map(([n, m]) => toIndexEntry(n, m)).sort((a, b) => a.number - b.number) };
    writeJson(INDEX, index);
  }
  let file = DRY ? readJson<ErcsFile>(FILE) : updateJsonLocked<ErcsFile>(FILE, (cur) => refreshErcMeta(cur, metas));
  const index = readJson<ErcIndexFile>(INDEX).ercs.length ? readJson<ErcIndexFile>(INDEX).ercs : [...metas].map(([n, m]) => toIndexEntry(n, m));
  console.log(`[ercs] 원문 ${metas.size}개, 해설 ${file.ercs.length}개`);

  const today = new Date().toISOString().slice(0, 10);
  const hashes = new Map([...sources].filter(([n]) => metas.has(n)).map(([n, md]) => [n, hashOf(md)]));
  const order = index.length ? ercOrder(index) : [...metas.keys()];
  const targets = ONLY.length ? ONLY.filter((n) => metas.has(n)) : pickTargets(inShard(order, SHARD), file.ercs, hashes, today, LIMIT);
  console.log(`[ercs] 이번에 쓸 ERC: ${targets.length ? targets.map((n) => `ERC-${n}`).join(', ') : '없음'}`);

  for (const n of targets) {
    const md = sources.get(n) as string;
    const prompt = buildErcPrompt(n, md);
    if (DRY) {
      console.log(prompt.slice(0, 2000));
      continue;
    }
    try {
      const started = Date.now();
      const out = path.join(CACHE_DIR, `${n}.out.txt`);
      const raw = process.env.ERCS_REUSE && fs.existsSync(out) ? fs.readFileSync(out, 'utf-8') : run(prompt);
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(out, raw, 'utf-8');
      const draft = ErcDraftSchema.parse(extractJson(raw));
      const polished = withErcProse(draft, humanizeTexts(ercProseOf(draft), 'ERC 해설 페이지("~합니다" 존댓말, 비전문가용 설명과 개발자용 심층 설명)', run));
      const record = toErcRecord(n, metas.get(n) as EipMeta, normalizeTerms(polished), md, hashes.get(n) as string, MODEL, new Date());
      if (leaks(record)) throw new Error('결과에 비밀값이 섞여 버립니다 (프롬프트 주입 의심)');
      if (record.iface.length < draft.iface.length) console.warn(`[WARN] ERC-${n} 원문에 없는 시그니처 ${draft.iface.length - record.iface.length}개를 뺐습니다`);
      file = updateJsonLocked<ErcsFile>(FILE, (cur) => upsertErcs(cur, [record], new Date()));
      console.log(`[ercs] ERC-${n} ${record.titleKo} 저장 (${Math.round((Date.now() - started) / 1000)}초)`);
    } catch (error) {
      const detail = error instanceof ZodError ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : error instanceof Error ? error.message.split('\n')[0] : String(error);
      console.warn(`[WARN] ERC-${n} 해설 실패: ${detail}`);
    }
  }
}

main().catch((error) => {
  console.error('[ercs] 실패:', error);
  process.exit(1);
});
