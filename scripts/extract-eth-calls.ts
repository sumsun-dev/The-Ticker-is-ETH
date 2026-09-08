/**
 * 코어 개발자 콜 기록 추출 — Forkcast 아티팩트를 콜 레코드(src/data/eth-calls.json)로.
 * ACDE·ACDC·ACDT는 결정·토론까지 정리하고(콜당 fable 1회 + 발언 번역 sonnet 1회), 그 밖의 콜은 제목·링크만 기록한다.
 * 텔레그램 콜 브리프(post-calls-telegram.ts)는 이 레코드에서 파생되므로 사이트와 메시지 내용이 같다.
 *
 * env: CALLS_EXTRACT(id 쉼표 목록, 예 acde-244 — 이미 있는 콜도 다시 처리) · CALLS_LIMIT(한 번에 처리할 새 콜 수, 기본 3) · CALLS_SINCE(이 날짜 이후 콜만, 기본 2026-08-01)
 *      CALLS_MODEL(기본 fable) · CALLS_TRANSLATE_MODEL(기본 sonnet) · CALLS_DRY_RUN=1(프롬프트 앞부분만 출력) · CALLS_SKIP_STATUS=1(포크 상태 요약 생략)
 */
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { forkcastArtifactBase, parseForkcastFeed, type ForkcastCall } from './lib/eth-news';
import { extractJson } from './lib/eth-debates';
import { runClaude } from './lib/claude';
import {
  CallDraftSchema,
  FULL_SERIES,
  StatusDraftSchema,
  TranslationsSchema,
  applyTranslations,
  buildRecord,
  callInput,
  callLabel,
  numbered,
  parseChat,
  parseVtt,
  reapplyRoster,
  recordOnly,
  type CallRecord,
  type CallsFile,
  type ForkcastConfig,
  type ForkcastDecision,
  type ForkcastNotes,
  type ForkcastTldr,
  type SpeakerInfo,
} from './lib/eth-calls';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const FILE = path.resolve(process.cwd(), 'src/data/eth-calls.json');
const SPEAKERS = path.resolve(process.cwd(), 'src/data/call-speakers.json');
const PROFILES = path.resolve(process.cwd(), 'src/data/x-profiles.json');
const DEBATES = path.resolve(process.cwd(), 'src/data/eth-debates.json');
const CACHE_DIR = path.resolve(process.cwd(), '.cache/forkcast');
const USER_AGENT = 'eck-news-bot/1.0 (+https://ethcollective.xyz)';
const MODEL = process.env.CALLS_MODEL ?? 'fable';
const TRANSLATE_MODEL = process.env.CALLS_TRANSLATE_MODEL ?? 'sonnet';
const LIMIT = Number(process.env.CALLS_LIMIT ?? 3);
/** 아카이브 시작일. 이전 콜은 기록하지 않는다 (피드에는 2025년 콜까지 실려 있다) */
const SINCE = process.env.CALLS_SINCE ?? '2026-08-01';

const PROMPT = `당신은 ECK(Ethereum Collective Korea)의 리서치 에디터입니다. 아래는 Forkcast(EF Protocol Support)가 기록한 이더리움 코어 개발자 콜 하나의 원자료입니다: 결정 목록, 일정·목표, 액션 아이템, 안건 순서, 하이라이트, 안건별 노트, 발화자별 자막, 채팅. 프로토콜 개발을 매주 따라가지는 않는 한국어 독자가 "무엇이 결정됐고, 누가 어떤 입장에서 무슨 말을 했고, 왜 중요한지"를 이해하도록 콜 레코드를 JSON으로 작성하세요.

출력은 JSON 하나만 (앞뒤에 다른 텍스트 없이):
{
 "headline": "두 줄 헤드라인. 줄바꿈은 \\n, 각 줄 공백 포함 12자 이내. 이 콜에서 가장 중요한 결정 하나. 콜 이름과 날짜는 넣지 않는다. 예: EIP-8141 프레임\\n헤고타 포함 확정",
 "lead": "헤드라인 아래 한 문장 40자 이내. 그 결정이 무엇을 뜻하는지 쉬운 말로",
 "intro": "이 콜이 어떤 모임인지 한 줄. 예: 실행 계층(EL) 클라이언트 개발자들이 격주로 모이는 콜이다.",
 "summary": "한 줄 요약. 가장 중요한 결정과 그 의미를 한두 문장으로",
 "whyItMatters": "왜 중요한가. 사용자·개발자·L2에 어떤 변화를 뜻하는지 2문장 이내",
 "decisions": [{"n": 결정 번호, "label": "커버 칩용 짧은 이름 16자 이내 (예: EIP-8141 프레임)", "text": "무엇이 결정됐는지 한 문장. 그게 무슨 뜻인지 쉬운 말 한 문장", "status": "SFI|CFI|PFI|DFI|보류|확정|일정|기타"}],
 "targets": [{"n": 일정 번호, "key": "같은 일정을 뒤 콜에서 이어 볼 수 있는 영문 슬러그. 예: sepolia-fork, hoodi-fork, mainnet-fork, devnet-9, hegota-scoping", "text": "날짜와 이벤트. 확정인지 제안인지 구분"}],
 "actions": [{"n": 액션 번호, "owner": "담당", "text": "할 일과 기한"}],
 "agenda": [{"n": 안건 번호, "heading": "안건 제목의 한국어 번역"}],
 "topics": [{"title": "토론 주제", "intro": "이 주제가 무엇이고 왜 지금 논의됐는지 한 문장", "agendaN": 해당 안건 번호, "decision": "이 주제에서 결정이 났으면 'SFI 결정 01:37:56'처럼 짧게. 없으면 생략", "positions": [{"speaker": "자막의 발화자 표기 그대로", "text": "입장과 근거 한두 문장. 누구 의견에 동의하거나 반박했는지 있으면 밝힌다", "timestamp": "그 발언이 시작된 자막 시각 hh:mm:ss", "viaChat": 채팅 발언이면 true}], "quote": {"text": "그 주제에서 가장 핵심적인 한 문장의 직역", "original": "자막의 영어 원문 그대로", "speaker": "자막 표기", "timestamp": "hh:mm:ss"}}],
 "chat": [{"speaker": "채팅 표기", "text": "내용 번역", "timestamp": "hh:mm:ss"}],
 "glossary": [{"term": "용어", "def": "뜻 한 구절"}]
}

규칙:
- decisions는 [결정] 목록 전부를 순서대로 쓰고 n은 그대로 둔다. status는 기록의 결과에 맞춰 하나만: SFI(포함 확정) | CFI(포함 검토) | PFI(포함 제안, 후보로 접수·유지) | DFI(후보에서 제외: dropped, not taken up, declined) | 보류(다음 포크로 미룸: deferred) | 확정(포크 후보와 무관한 결정 사항) | 일정(날짜 결정) | 기타.
- targets, actions, agenda도 원자료의 번호를 그대로 쓴다. 없는 번호를 만들지 않는다. agenda는 안건 전부를 번역한다.
- topics는 실제로 의견이 오간 주제 2~4개. 사회자의 진행 발언과 단순 상태 보고는 뺀다. 주제당 발언자 2~6명. speaker는 [자막]의 발화자 표기(예: "Derek Chiang | Ethlabs", "Chris - Base", "lightclient")를 글자 그대로 쓴다. 채팅 발언은 [채팅]의 표기를 쓰고 viaChat을 true로 한다.
- 자막에 없는 발언을 만들지 않는다. quote.original은 자막 문장을 그대로 옮기되 말버릇(um, like, 반복)만 정리한다.
- chat은 논의에 실질적 정보나 입장을 더한 채팅 2~3개. glossary는 이 콜을 읽는 데 필요한 약어와 용어 4~8개 (이 콜에 쓰인 SFI·CFI·PFI·DFI 포함).
- EIP 번호, 포크 이름, 상태, 날짜, 숫자는 원문 그대로. 기록에 없는 사실을 만들지 않는다. 사람의 소속은 적지 않는다 (사이트가 명단으로 붙인다). 자막에서 철자가 흔들리는 이름은 역할로 대신한다(예: EIP-8360 제안자).
- 전문 용어는 처음 나올 때 통용 한국어에 원어를 병기한다. 예: 히스토리 만료(history expiry), 프레임(Frames), 챔피언(champion, 제안을 책임지고 밀어붙이는 담당자). 포크 이름은 글램스터담(Glamsterdam), 헤고타(Hegota)처럼 한국어 표기 뒤에 원어 병기, 두 번째부터는 한국어만.
- 문체는 '~했다', '~된다'의 서술체(경어 아님). 대시(—)와 이모지, 마크다운 기호 금지. 해석은 summary, whyItMatters, topics[].intro에만 넣고 나머지는 기록에 있는 사실만 쓴다.`;

const TRANSLATE_PROMPT = `아래는 이더리움 코어 개발자 콜 자막에서 발췌한 발언 원문(영어)입니다. 각 항목을 한국어로 충실히 번역하세요. 의역하지 말고 문장 구조를 유지하되 말버릇(um, like, you know)과 반복은 정리합니다. EIP 번호, 고유명사, 숫자는 그대로 두고, 전문 용어는 처음 한 번 통용 한국어에 원어를 병기합니다. 어조는 회의 발언답게 존댓말("~합니다")로 옮깁니다. 대시(—)와 이모지는 쓰지 않습니다.
출력은 JSON 하나만: {"translations": [{"n": 번호, "text": "번역"}]}`;

const STATUS_PROMPT = `아래는 이더리움 코어 개발자 콜들의 최근 결정과 일정입니다(최신 콜이 먼저). 콜 아카이브 상단에 보여줄 "지금 어디쯤인지" 두 칸을 JSON으로 쓰세요.
{"currentFork": {"name": "진행 중인 포크 이름 (예: 글램스터담)", "stage": "단계 (예: 테스트넷 단계)", "line": "핵심 상태 한 줄 45자 이내 (예: 세폴리아 10월 6일 확정 · 후디 미정 · 메인넷 12월 초 목표)"}, "nextFork": {"name": "다음 포크 이름", "stage": "예: 범위 정하는 중", "line": "예: SFI 1건(EIP-8141) · PFI 후보 20건 이상 · 11월 3일 데브콘까지 범위 확정"}}
규칙: 기록에 있는 사실만 쓰고, 최근 콜의 결정이 이전 콜의 일정을 덮어쓴다. 날짜와 숫자는 원문 그대로. 대시(—)와 이모지 금지. 출력은 JSON 하나만.`;

function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf-8')) as T) : fallback;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** 아티팩트 파일을 .cache/forkcast/<id>-<file>에 캐시 */
async function artifact(call: ForkcastCall, id: string, file: string): Promise<string | null> {
  const cached = path.join(CACHE_DIR, `${id}-${file}`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf-8');
  const text = await fetchText(`${forkcastArtifactBase(call)}/${file}`);
  if (text) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cached, text);
  }
  return text;
}

const parseJson = <T,>(text: string | null, fallback: T): T => {
  try {
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
};

function draftWithRetry(prompt: string) {
  try {
    return CallDraftSchema.parse(extractJson(runClaude(prompt, MODEL)));
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 1200) : String(error);
    console.warn(`  first draft rejected (${reason.replace(/\s+/g, ' ').slice(0, 300)}), retrying once`);
    return CallDraftSchema.parse(extractJson(runClaude(`${prompt}\n\n직전 출력이 스키마 검증에 실패했다. 아래 오류를 고쳐 같은 JSON을 다시 출력하라:\n${reason}`, MODEL)));
  }
}

async function processCall(
  call: ForkcastCall,
  ctx: { roster: Record<string, SpeakerInfo>; avatars: Record<string, string | undefined>; debates: Array<{ id: string; title: string; summary: string; keywords?: string[] }> },
): Promise<CallRecord> {
  const id = `${call.series}-${call.number}`;
  const meta = { id, series: call.series, number: call.number, date: call.date, title: call.title, forkcastUrl: call.url };
  if (!(FULL_SERIES as readonly string[]).includes(call.series)) return recordOnly(meta);

  const [kd, tldrText, notesText, configText, chatText] = await Promise.all([
    artifact(call, id, 'key_decisions.json'),
    artifact(call, id, 'tldr.json'),
    artifact(call, id, 'notes.json'),
    artifact(call, id, 'config.json'),
    artifact(call, id, 'chat.txt'),
  ]);
  const vtt = (await artifact(call, id, 'transcript_corrected.vtt')) ?? (await artifact(call, id, 'transcript.vtt')) ?? '';
  const decisions = parseJson<{ key_decisions?: ForkcastDecision[] }>(kd, {}).key_decisions ?? [];
  const tldr = parseJson<ForkcastTldr>(tldrText, {});
  const notes = parseJson<ForkcastNotes>(notesText, {});
  const config = parseJson<ForkcastConfig>(configText, {});
  if (decisions.length === 0 && !tldr.highlights) {
    console.log(`  ${id}: no decisions or highlights yet, recorded title only`);
    return recordOnly(meta);
  }
  const chat = parseChat(chatText ?? '');
  const cues = parseVtt(vtt);
  const input = callInput({ title: call.title, date: call.date, decisions, tldr, notes, vtt, chat });
  const prompt = `${PROMPT}\n\n${input}`;
  if (process.env.CALLS_DRY_RUN) {
    console.log(prompt.slice(0, 4000));
    console.log(`\n... (${prompt.length} chars, ${cues.length} cues, ${chat.length} chat lines)`);
    return recordOnly(meta);
  }
  console.log(`  ${id}: drafting with ${MODEL} (${prompt.length} chars, ${cues.length} cues)...`);
  const draft = draftWithRetry(prompt);
  let record = buildRecord({ meta, draft, decisions, tldr, notes, config, cues, chat, ...ctx });

  // 발언 원문 번역 (한 콜의 발언을 한 번에)
  const originals = record.topics.flatMap((t, ti) => t.positions.flatMap((p, pi) => (p.original ? [{ topic: ti, position: pi, text: p.original }] : [])));
  if (originals.length > 0) {
    console.log(`  ${id}: translating ${originals.length} remarks with ${TRANSLATE_MODEL}...`);
    try {
      const { translations } = TranslationsSchema.parse(extractJson(runClaude(`${TRANSLATE_PROMPT}\n\n${numbered(originals, (o) => o.text)}`, TRANSLATE_MODEL)));
      record = applyTranslations(record, originals, translations);
    } catch (error) {
      console.warn(`  [WARN] translation failed for ${id}:`, error instanceof Error ? error.message.split('\n')[0] : error);
    }
  }
  console.log(`  ${id}: ${record.decisions.length} decisions, ${record.topics.length} topics, ${record.speakers.length} speakers`);
  return record;
}

function refreshStatus(file: CallsFile): CallsFile {
  const recent = file.calls.filter((c) => c.kind === 'full').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  if (recent.length === 0) return file;
  const input = recent
    .map((c) => `## ${callLabel(c)} (${c.date})\n결정:\n${c.decisions.map((d) => `- ${d.original}`).join('\n')}\n일정:\n${c.targets.map((t) => `- ${t.text}`).join('\n')}`)
    .join('\n\n');
  try {
    const draft = StatusDraftSchema.parse(extractJson(runClaude(`${STATUS_PROMPT}\n\n${input}`, MODEL)));
    return { ...file, status: { ...draft, basis: recent[0].id } };
  } catch (error) {
    console.warn('[WARN] status summary failed:', error instanceof Error ? error.message.split('\n')[0] : error);
    return file;
  }
}

async function main() {
  const file = readJson<CallsFile>(FILE, { updatedAt: '', calls: [] });
  const roster = readJson<{ speakers: Record<string, SpeakerInfo> }>(SPEAKERS, { speakers: {} }).speakers;
  const profiles = readJson<Record<string, { avatar?: string }>>(PROFILES, {});
  const avatars = Object.fromEntries(Object.entries(profiles).map(([h, p]) => [h.toLowerCase(), p.avatar]));
  const debates = readJson<{ debates: Array<{ id: string; title: string; summary: string; keywords?: string[] }> }>(DEBATES, { debates: [] }).debates;

  if (process.env.CALLS_REAPPLY) {
    // 명단(call-speakers.json)이나 아바타가 바뀐 뒤: 레코드의 발언자 정보만 다시 입힌다
    const calls = file.calls.map((c) => (c.kind === 'full' ? reapplyRoster(c, roster, avatars) : c));
    fs.writeFileSync(FILE, JSON.stringify({ ...file, updatedAt: new Date().toISOString(), calls }, null, 2) + '\n');
    const all = calls.flatMap((c) => c.speakers);
    console.log(`Reapplied roster: ${all.filter((s) => s.handle).length}/${all.length} speakers with handle, ${all.filter((s) => s.avatar).length} with avatar`);
    return;
  }

  const feedXml = await fetchText('https://forkcast.org/feed.xml');
  if (!feedXml) throw new Error('forkcast feed unavailable');
  const feed = parseForkcastFeed(feedXml);
  const idOf = (c: ForkcastCall) => `${c.series}-${c.number}`;
  const isFull = (c: ForkcastCall) => (FULL_SERIES as readonly string[]).includes(c.series);
  // 정리가 끝난 콜과 정리 대상이 아닌 시리즈는 건너뛴다. 아티팩트가 아직 없어 제목만 기록된 ACD 콜은 다음 실행에서 다시 시도
  const known = new Set(file.calls.filter((c) => c.kind === 'full' || !(FULL_SERIES as readonly string[]).includes(c.series)).map((c) => c.id));
  const wanted = process.env.CALLS_EXTRACT?.split(',').map((s) => s.trim()).filter(Boolean);
  const fresh = feed.filter((c) => c.date >= SINCE && !known.has(idOf(c)));
  const targets = wanted
    ? feed.filter((c) => wanted.includes(idOf(c)))
    : [
        // 새 ACD 콜은 최근 것부터 LIMIT개를 고르되, 처리는 오래된 순으로
        ...fresh.filter(isFull).sort((a, b) => b.date.localeCompare(a.date)).slice(0, LIMIT).reverse(),
        ...fresh.filter((c) => !isFull(c)),
      ];
  if (targets.length === 0) {
    console.log('[SKIP] no new calls');
    return;
  }
  console.log(`Processing ${targets.length} calls: ${targets.map(idOf).join(', ')}`);

  const save = (calls: CallRecord[], status = file.status): CallsFile => {
    const sorted = [...calls].sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);
    const out: CallsFile = { ...file, updatedAt: new Date().toISOString(), ...(status ? { status } : {}), calls: sorted };
    fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + '\n');
    return out;
  };
  let calls = [...file.calls];
  let processedFull = false;
  for (const call of targets) {
    const record = await processCall(call, { roster, avatars, debates });
    if (process.env.CALLS_DRY_RUN) continue;
    calls = [...calls.filter((c) => c.id !== record.id), record];
    if (record.kind === 'full') processedFull = true;
    // 콜 하나마다 저장: 중간에 죽어도 진행분이 남고 다음 실행이 이어간다
    save(calls);
  }
  if (process.env.CALLS_DRY_RUN) return;
  let out = save(calls);
  if (processedFull && !process.env.CALLS_SKIP_STATUS) {
    console.log('Refreshing fork status summary...');
    out = save(calls, refreshStatus(out).status);
  }
  console.log(`Wrote ${FILE}: ${out.calls.length} calls (${out.calls.filter((c) => c.kind === 'full').length} full)`);
}

main().catch((error) => {
  console.warn('[WARN] extract-eth-calls failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
