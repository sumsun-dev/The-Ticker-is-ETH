/**
 * 로드맵 개념 해설(/roadmap/:slug)과 포크별 "나에게 달라지는 것"(/forks/:slug)을 써서 src/data/roadmap-explainers.json에 쌓는다.
 * 항목당 모델 1회 + im-not-ai 윤문 1회. 검수 없이 자동 공개 (EIP 해설과 같은 방식).
 * 이미 있는 것은 건너뛴다. Strawmap을 다시 옮겨 항목이 바뀌면 그 항목만 ROADMAP_ONLY로 다시 쓴다.
 *
 * env: ROADMAP_LIMIT(한 번에 쓸 수, 기본 5) · ROADMAP_ONLY(topic:<slug> 또는 fork:<slug> 쉼표 목록, 있는 것도 다시 씀)
 *      ROADMAP_MODEL(기본 fable) · ROADMAP_DRY_RUN=1(대상과 프롬프트 앞부분만 출력) · ROADMAP_SHARD=1/2 · HUMANIZE_OFF=1
 */
import fs from 'fs';
import path from 'path';
import { ZodError } from 'zod';
import * as dotenv from 'dotenv';
import { runClaude } from './lib/claude';
import { inShard, parseShard, updateJsonLocked } from './lib/json-lock';
import { extractJson } from './lib/eth-debates';
import { humanizeTexts, normalizeTerms } from './lib/humanize';
import { callLabel } from './lib/eth-calls';
import { ForkDraftSchema, TopicDraftSchema, forkProse, forkPrompt, topicProse, topicPrompt, withForkProse, withTopicProse } from './lib/roadmap';
import { LAYERS, ROADMAP_ITEMS, STRAWMAP_FORKS, itemSlug, type RoadmapItem } from '../src/data/roadmap';
import { FORKS, type Fork } from '../src/data/forks';
import type { EipRecord, EipsFile } from '../src/data/eipsData';
import type { RoadmapExplainersFile } from '../src/data/roadmapExplainers';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATA = path.resolve(process.cwd(), 'src/data');
const FILE = path.join(DATA, 'roadmap-explainers.json');
const CACHE_DIR = path.resolve(process.cwd(), '.cache/roadmap');
const MODEL = process.env.ROADMAP_MODEL ?? 'fable';
const LIMIT = Number(process.env.ROADMAP_LIMIT ?? 5);
const DRY = Boolean(process.env.ROADMAP_DRY_RUN);
const ONLY = (process.env.ROADMAP_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const SHARD = parseShard(process.env.ROADMAP_SHARD);
const SOURCE_CHARS = 8_000;

type Call = { series: string; number: number; date: string; kind?: string; decisions?: Array<{ eips?: number[]; status: string; text: string; fork?: string }> };
type Target = { key: string; kind: 'topic'; item: RoadmapItem } | { key: string; kind: 'fork'; fork: Fork };

const readJson = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf-8')) as T;

// 자료에는 남이 쓴 원문이 섞인다. 도구 없이 글만 쓰게 하고, 결과에 이 기계의 비밀값이 섞이면 버린다 (extract-eips.ts와 같은 장치)
const run = (prompt: string) => runClaude(prompt, MODEL, undefined, { noTools: true });
const SECRETS = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '.env.local')]
  .filter((f) => fs.existsSync(f))
  .flatMap((f) => Object.values(dotenv.parse(fs.readFileSync(f))))
  .filter((v) => v.length >= 12);
const leaks = (value: unknown): boolean => SECRETS.some((v) => JSON.stringify(value).includes(v));

/** 해설이 없는 EIP의 원문 앞부분. 못 받으면 빈 문자열 */
async function sourceHead(n: number): Promise<string> {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-${n}.md`, { signal: AbortSignal.timeout(20_000) });
    return r.ok ? (await r.text()).slice(0, SOURCE_CHARS) : '';
  } catch {
    return '';
  }
}

const eipBrief = (r: EipRecord): string => `EIP-${r.number} ${r.titleKo} (${r.meta.title}, ${r.meta.status})\n요약: ${r.summary}\n배경: ${r.why}\n${r.deep.slice(0, 3).map((d) => `${d.title}: ${d.body}`).join('\n')}`;

async function topicMaterial(it: RoadmapItem, eips: Map<number, EipRecord>, calls: Call[]) {
  const nums = it.eips ?? [];
  const texts = await Promise.all(nums.map(async (n) => (eips.has(n) ? eipBrief(eips.get(n) as EipRecord) : `EIP-${n} 원문 앞부분:\n${await sourceHead(n)}`)));
  const decisions = calls
    .filter((c) => c.kind === 'full')
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((c) => (c.decisions ?? []).filter((d) => (d.eips ?? []).some((n) => nums.includes(n))).map((d) => `${c.date} ${callLabel(c as never)} [${d.status}${d.fork ? ` · ${d.fork}` : ''}] ${d.text}`));
  return { eips: texts.filter((t) => !t.endsWith(':\n')), decisions };
}

function forkMaterial(f: Fork, eips: Map<number, EipRecord>): string[] {
  const list = [...(f.headliners ?? []), ...f.eips.filter((x) => !f.headliners?.some((h) => h.number === x.number))];
  return list.map((x) => {
    const r = eips.get(x.number);
    return r ? `EIP-${x.number} ${r.titleKo}: ${r.summary} 영향: ${r.impact.map((i) => `${i.who}: ${i.text}`).join(' / ')}` : `EIP-${x.number} ${x.note}`;
  });
}

async function main() {
  const calls = readJson<{ calls: Call[] }>(path.join(DATA, 'eth-calls.json')).calls;
  const eips = new Map(readJson<EipsFile>(path.join(DATA, 'eips.json')).eips.map((r) => [r.number, r]));
  const file = readJson<RoadmapExplainersFile>(FILE);

  const all: Target[] = [
    ...ROADMAP_ITEMS.map((item) => ({ key: `topic:${itemSlug(item)}`, kind: 'topic' as const, item })),
    ...FORKS.map((fork) => ({ key: `fork:${fork.slug}`, kind: 'fork' as const, fork })),
  ];
  const have = (t: Target) => (t.kind === 'topic' ? Boolean(file.topics[itemSlug(t.item)]) : Boolean(file.forks[t.fork.slug]));
  const targets = ONLY.length ? all.filter((t) => ONLY.includes(t.key)) : inShard(all.filter((t) => !have(t)), SHARD).slice(0, LIMIT);
  console.log(`[roadmap] 이번에 쓸 것 ${targets.length}개: ${targets.map((t) => t.key).join(', ') || '없음'}`);

  for (const t of targets) {
    const slug = t.kind === 'topic' ? itemSlug(t.item) : t.fork.slug;
    try {
      const started = Date.now();
      let prompt: string;
      let basis: 'eip' | 'strawmap' = 'strawmap';
      if (t.kind === 'topic') {
        const it = t.item;
        const m = await topicMaterial(it, eips, calls);
        basis = m.eips.length ? 'eip' : 'strawmap';
        prompt = topicPrompt({
          name: it.name,
          en: it.en,
          layer: it.layer === 'cross' ? '여러 층' : (LAYERS.find((l) => l.key === it.layer)?.name ?? it.layer),
          fork: `${STRAWMAP_FORKS[it.fork].name} (${STRAWMAP_FORKS[it.fork].when})`,
          kind: { headliner: '헤드라이너', onchain: '프로토콜 변경', offchain: '프로토콜 밖 작업(클라이언트·명세·네트워크)' }[it.kind],
          uncertain: Boolean(it.uncertain),
          neighbors: ROADMAP_ITEMS.filter((x) => x !== it && x.fork === it.fork && x.layer === it.layer).map((x) => x.name),
          ...m,
        });
      } else {
        const f = t.fork;
        prompt = forkPrompt({ name: f.name, alias: f.alias, date: f.date, summary: f.summary, eips: forkMaterial(f, eips) });
      }
      if (DRY) {
        console.log(`\n=== ${t.key}\n${prompt.slice(0, 2000)}`);
        continue;
      }
      const out = path.join(CACHE_DIR, `${t.key.replace(':', '-')}.out.txt`);
      const raw = run(prompt);
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(out, raw, 'utf-8');
      const meta = { model: MODEL, generatedAt: new Date().toISOString() };

      if (t.kind === 'topic') {
        const draft = TopicDraftSchema.parse(extractJson(raw));
        if ('skip' in draft) {
          console.warn(`[WARN] ${t.key} 모델이 확실히 모른다고 해 건너뜁니다`);
          continue;
        }
        const polished = normalizeTerms(withTopicProse(draft, humanizeTexts(topicProse(draft), '로드맵 개념 해설("~합니다" 존댓말, 비전문가용)', run)));
        const record = { ...polished, basis, ...meta };
        if (leaks(record)) throw new Error('결과에 비밀값이 섞여 버립니다 (프롬프트 주입 의심)');
        updateJsonLocked<RoadmapExplainersFile>(FILE, (cur) => ({ ...cur, updatedAt: meta.generatedAt, topics: { ...cur.topics, [slug]: record } }));
        console.log(`[roadmap] ${t.key} ${record.title} 저장 (${Math.round((Date.now() - started) / 1000)}초)`);
      } else {
        const draft = ForkDraftSchema.parse(extractJson(raw));
        const polished = normalizeTerms(withForkProse(draft, humanizeTexts(forkProse(draft), '하드포크가 대상별로 바꾸는 것("~합니다" 존댓말, 비전문가용)', run)));
        const record = { ...polished, ...meta };
        if (leaks(record)) throw new Error('결과에 비밀값이 섞여 버립니다 (프롬프트 주입 의심)');
        updateJsonLocked<RoadmapExplainersFile>(FILE, (cur) => ({ ...cur, updatedAt: meta.generatedAt, forks: { ...cur.forks, [slug]: record } }));
        console.log(`[roadmap] ${t.key} 저장 (${Math.round((Date.now() - started) / 1000)}초)`);
      }
    } catch (error) {
      const detail = error instanceof ZodError ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : error instanceof Error ? error.message.split('\n')[0] : String(error);
      console.warn(`[WARN] ${t.key} 실패: ${detail}`);
    }
  }
}

main().catch((error) => {
  console.error('[roadmap] 실패:', error);
  process.exit(1);
});
