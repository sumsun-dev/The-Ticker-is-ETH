/**
 * 레딧 AMA 정리 — EF 프로토콜 클러스터 AMA 스레드를 콜 아카이브(/calls) 레코드로.
 *
 * 입력: 레딧 댓글 Atom 피드(.rss). 레딧이 비인증 JSON API는 막아 두었고 RSS만 열린다.
 *      로컬 맥에서는 레딧이 IP를 막으므로(403) 받아 둔 파일을 --file로 넣는다. gv-vps에서는 URL로 바로 받는다.
 * 출력: src/data/eth-calls.json에 series 'ama' 레코드 (결정·일정·안건은 없고 주제별 발언만)
 *
 * 실행: npx tsx scripts/extract-reddit-ama.ts --url <스레드 URL> [--file <피드 파일>] [--number 14] [--date 2025-08-29] [--title "..."]
 *      npx tsx scripts/extract-reddit-ama.ts --reapply --id ama-14   (모델 재호출 없이 명단·참여자만 갱신)
 * env: AMA_MODEL(기본 fable) · AMA_DRY_RUN=1(프롬프트만 출력) · AMA_MAX_BYTES(원자료 예산, 기본 90000)
 */
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { runClaude } from './lib/claude';
import { extractJson } from './lib/eth-debates';
import { AmaDraftSchema, amaInput, amaSpeakers, buildAmaRecord, parseAmaFeed, type RosterEntry } from './lib/reddit-ama';
import type { CallsFile } from './lib/eth-calls';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const FILE = path.resolve(process.cwd(), 'src/data/eth-calls.json');
const SPEAKERS = path.resolve(process.cwd(), 'src/data/call-speakers.json');
const PROFILES = path.resolve(process.cwd(), 'src/data/x-profiles.json');
const DEBATES = path.resolve(process.cwd(), 'src/data/eth-debates.json');
const USER_AGENT = 'eck-news-bot/1.0 (+https://ethcollective.xyz)';
const MODEL = process.env.AMA_MODEL ?? 'fable';
const MAX_BYTES = Number(process.env.AMA_MAX_BYTES ?? 90_000);
const RAW_DUMP = path.resolve(process.cwd(), '.cache/ama-raw.json');

const PROMPT = `당신은 ECK(Ethereum Collective Korea)의 시니어 리서치 에디터입니다. 아래는 이더리움 재단 프로토콜 클러스터(옛 EF 리서치)가 레딧 r/ethereum에서 연 AMA의 원자료입니다. 각 줄은 [번호]로 시작하고, 사전 질문은 "질문(보낸 사람)", 나머지는 "@레딧핸들"로 표시돼 있습니다. 답변과 현장 질문이 섞여 있으니 내용을 보고 가려내세요.

프로토콜 개발을 매주 따라가지는 않는 한국어 독자가 "이 AMA에서 무엇을 물었고, 재단 쪽이 무엇을 답했는지"를 이해하도록 정리하세요.

출력은 JSON 하나만 (앞뒤에 다른 텍스트 없이):
{
 "headline": "두 줄 헤드라인. 줄바꿈은 \\n, 각 줄 공백 포함 12자 이내. 이 AMA에서 가장 중요한 답변 하나. 예: 발행량 축소는\\n아직 합의 전",
 "lead": "헤드라인 아래 한 문장 40자 이내",
 "intro": "이 자리가 무엇인지 한 줄. 예: 이더리움 재단 프로토콜 클러스터가 레딧에서 여는 공개 질의응답이다.",
 "summary": "한두 문장 요약. 이 회차에서 가장 많이 다뤄진 쟁점과 재단 쪽 답의 요지",
 "whyItMatters": "이 답변들이 무엇을 바꾸는지 두세 문장",
 "topics": [
   {
     "title": "주제 제목 (예: 발행량 곡선)",
     "intro": "이 주제에서 무엇을 물었고 논의가 어떻게 흘렀는지 두세 문장",
     "positions": [ { "n": 12, "speaker": "레딧핸들", "text": "그 사람이 한 말의 한국어 요약. 한두 문장, 원문 문장을 그대로 옮기지 않는다" } ]
   }
 ],
 "glossary": [ { "term": "용어", "def": "한 줄 풀이" } ]
}

규칙:
- 주제는 3~6개. 질문 수와 답변 분량이 많은 것부터.
- positions의 n은 원자료 번호를 그대로 씁니다. 그 번호의 작성자를 speaker에 적습니다. 번호를 지어내지 않습니다.
- 각 주제에 재단 쪽 답변을 반드시 포함합니다. 답변 없이 질문만 있는 주제는 만들지 않습니다.
- 사실만 전달하고 과장하지 않습니다. 원문에 없는 수치·일정을 만들지 않습니다.
- 전문 용어는 통용되는 한국어 표기를 쓰고 처음 나올 때 원어를 병기합니다.
- 한국어 문장에 대시(—)와 이모지를 쓰지 않습니다.

원자료:
`;

const arg = (name: string): string | undefined => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function feedText(url: string, file?: string): Promise<string> {
  if (file) return fs.readFileSync(file, 'utf-8');
  const res = await fetch(`${url.replace(/\/$/, '')}/.rss?limit=500`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`레딧 피드를 받지 못했습니다 (http ${res.status}). 로컬에서는 --file로 받아 둔 피드를 넣으세요.`);
  return res.text();
}

/** 명단(call-speakers.json)과 X 프로필에서 레딧 핸들과 같은 핸들만 가져온다. 확인 못 한 사람은 핸들 그대로 둔다 */
function buildRoster(): Record<string, RosterEntry> {
  const roster: Record<string, RosterEntry> = {};
  const speakers = (JSON.parse(fs.readFileSync(SPEAKERS, 'utf-8')) as { speakers: Record<string, RosterEntry> }).speakers;
  const profiles = JSON.parse(fs.readFileSync(PROFILES, 'utf-8')) as Record<string, { handle?: string; avatar?: string }>;
  const avatarOf = (handle?: string) => (handle ? Object.values(profiles).find((p) => p.handle?.toLowerCase() === handle.toLowerCase())?.avatar : undefined);
  for (const entry of Object.values(speakers)) {
    if (!entry.handle) continue;
    roster[entry.handle.toLowerCase()] = { ...entry, ...(avatarOf(entry.handle) ? { avatar: avatarOf(entry.handle) } : {}) };
  }
  return roster;
}

/** 모델을 다시 부르지 않고 명단·참여자만 다시 입힌다 (콜 추출의 CALLS_REAPPLY와 같은 용도) */
function reapply(id: string): void {
  const file = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as CallsFile;
  const target = file.calls.find((c) => c.id === id);
  if (!target) throw new Error(`${id} 레코드가 없습니다`);
  const speakers = amaSpeakers(target.topics, buildRoster());
  const calls = file.calls.map((c) => (c.id === id ? { ...c, speakers } : c));
  fs.writeFileSync(FILE, JSON.stringify({ ...file, updatedAt: new Date().toISOString(), calls }, null, 2) + '\n');
  console.log(`${id}: 참여자 ${speakers.length}명 다시 입힘 (실명 확인 ${speakers.filter((s) => s.name !== s.label).length}명)`);
}

async function main() {
  if (process.argv.includes('--reapply')) {
    reapply(arg('id') ?? `ama-${Number(arg('number') ?? 0)}`);
    return;
  }
  const url = arg('url');
  if (!url) throw new Error('--url <레딧 스레드 URL>이 필요합니다');
  const items = parseAmaFeed(await feedText(url, arg('file')));
  if (items.length < 5) throw new Error(`피드에서 항목을 ${items.length}개만 찾았습니다. 피드가 비어 있거나 차단됐습니다.`);

  const number = Number(arg('number') ?? 0);
  const date = arg('date') ?? items[items.length - 1].updated.slice(0, 10);
  const meta = {
    id: arg('id') ?? `ama-${number}`,
    series: 'ama',
    number,
    date,
    title: arg('title') ?? `EF Protocol AMA #${number}`,
    forkcastUrl: url,
  };

  const prompt = `${PROMPT}${amaInput(items, MAX_BYTES)}`;
  if (process.env.AMA_DRY_RUN) {
    console.log(prompt.slice(0, 4_000));
    console.log(`\n... 프롬프트 ${Buffer.byteLength(prompt, 'utf-8')}바이트, 항목 ${items.length}개`);
    return;
  }

  console.log(`AMA #${number} 정리 중 (항목 ${items.length}개, 프롬프트 ${Buffer.byteLength(prompt, 'utf-8')}바이트, ${MODEL})...`);
  const raw = runClaude(prompt, MODEL);
  const parsed = AmaDraftSchema.safeParse(extractJson(raw));
  if (!parsed.success) {
    // 스키마에 걸리면 모델 응답을 남긴다. 다시 부르지 않고 무엇이 어긋났는지 보기 위함
    fs.mkdirSync(path.dirname(RAW_DUMP), { recursive: true });
    fs.writeFileSync(RAW_DUMP, raw, 'utf-8');
    throw new Error(`모델 출력이 스키마에 맞지 않습니다 (원문 ${RAW_DUMP}): ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')} ${i.message}`).join(' / ')}`);
  }
  const draft = parsed.data;
  const debates = (JSON.parse(fs.readFileSync(DEBATES, 'utf-8')) as { debates: Array<{ id: string; title: string; summary: string; keywords?: string[] }> }).debates;
  const record = buildAmaRecord({ meta, draft, items, roster: buildRoster(), debates });

  const file = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as CallsFile;
  const calls = [record, ...file.calls.filter((c) => c.id !== record.id)].sort((a, b) => b.date.localeCompare(a.date));
  fs.writeFileSync(FILE, JSON.stringify({ ...file, updatedAt: new Date().toISOString(), calls }, null, 2) + '\n');
  console.log(`${record.id}: 주제 ${record.topics.length}개, 발언 ${record.topics.reduce((n, t) => n + t.positions.length, 0)}건, 참여자 ${record.speakers.length}명 → ${FILE}`);
}

main().catch((error) => {
  console.error(`[ERROR] extract-reddit-ama: ${(error as Error).message}`);
  process.exit(1);
});
