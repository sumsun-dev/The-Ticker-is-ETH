/**
 * 논쟁 정리 채점 — src/data/eth-debates.json 의 레코드를 채점표(scripts/lib/debate-rubric.ts)로 100점 채점한다.
 * 기계 검사 40점 + 헤드리스 모델이 트윗 원문과 대조한 판정 60점. 데이터는 바꾸지 않고 결과만 .cache/debate-scores.json 에 쓴다.
 *
 * env: SCORE_MODEL(기본 opus) · SCORE_BATCH(한 번에 보낼 레코드 수, 기본 4) · SCORE_IDS(쉼표 목록) · RESCORE=1(이미 채점한 것도 다시)
 */
import fs from 'fs';
import path from 'path';
import { runClaude } from './lib/claude';
import { extractJson } from './lib/eth-debates';
import { codeScores, grade, judgePrompt, ModelVerdictSchema, MODEL_KEYS, type ModelVerdict } from './lib/debate-rubric';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '.cache/debate-scores.json');
const MODEL = process.env.SCORE_MODEL ?? 'opus';
const BATCH = Number(process.env.SCORE_BATCH ?? 4);

type Row = { id: string; title: string; status?: string; total: number; grade: string; code: Record<string, number>; model: Omit<ModelVerdict, 'id' | 'problems'>; problems: string[] };

const { debates } = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/eth-debates.json'), 'utf8'));
const prev: Record<string, Row> = fs.existsSync(OUT) && !process.env.RESCORE ? JSON.parse(fs.readFileSync(OUT, 'utf8')).rows : {};
const only = process.env.SCORE_IDS?.split(',');
const todo = debates.filter((d: { id: string }) => !prev[d.id] && (!only || only.includes(d.id)));
const rows: Record<string, Row> = { ...prev };

const save = () => fs.writeFileSync(OUT, JSON.stringify({ scoredAt: new Date().toISOString(), model: MODEL, rows }, null, 1));

console.log(`[score] ${todo.length}건 채점 (${MODEL}, ${BATCH}건씩), 이미 채점 ${Object.keys(prev).length}건`);
for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  let verdicts: ModelVerdict[];
  try {
    verdicts = ModelVerdictSchema.parse(extractJson(runClaude(judgePrompt(batch), MODEL))).scores;
  } catch (error) {
    console.warn(`[WARN] ${batch.map((d: { id: string }) => d.id).join(', ')} 채점 실패: ${error instanceof Error ? error.message.slice(0, 300) : error}`);
    continue;
  }
  for (const d of batch) {
    const v = verdicts.find((x) => x.id === d.id);
    if (!v) { console.warn(`[WARN] ${d.id} 판정 없음`); continue; }
    const c = codeScores(d);
    const { problems } = v;
    const model = { isDebate: v.isDebate, fidelity: v.fidelity, stance: v.stance, issue: v.issue, balance: v.balance };
    const total = Object.values(c.scores).reduce((a, b) => a + b, 0) + MODEL_KEYS.reduce((a, k) => a + model[k], 0);
    rows[d.id] = { id: d.id, title: d.title, status: d.status, total, grade: grade(total), code: c.scores, model, problems: [...c.problems, ...problems] };
    console.log(`[score] ${String(total).padStart(3)} ${grade(total)}  ${d.id}`);
  }
  save();
}
save();

const all = Object.values(rows).sort((a, b) => a.total - b.total);
const avg = all.reduce((a, r) => a + r.total, 0) / (all.length || 1);
console.log(`\n[score] ${all.length}건 평균 ${avg.toFixed(1)}점 · 좋음 ${all.filter((r) => r.total >= 85).length} · 손볼 곳 ${all.filter((r) => r.total >= 70 && r.total < 85).length} · 다시 정리 ${all.filter((r) => r.total < 70).length}`);
console.log(`[score] 결과: ${path.relative(ROOT, OUT)}`);
