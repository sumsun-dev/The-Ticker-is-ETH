/**
 * 논쟁 추출·병합 — 다이제스트의 '논쟁 · 담론' 항목을 쟁점 단위 레코드로 누적한다 (Claude Code 헤드리스).
 *
 * 입력: 아직 처리하지 않은 다이제스트의 논쟁 항목
 *      + 인박스에서 같은 스레드의 원문 트윗
 *      + (X_RAPIDAPI_KEY 있을 때) 루트 트윗의 답글 상위권과 반응 수
 *      + 활성 논쟁 목록 (같은 쟁점이면 id 재사용)
 * 출력: src/data/eth-debates.json, src/data/x-profiles.json(아바타 캐시)
 *
 * env: DEBATES_MAX_DIGESTS(기본 14) · DEBATES_DRY_RUN=1(프롬프트만 출력) · DIGEST_DATE(오늘 날짜 덮어쓰기)
 *      주제 모드: DEBATES_TOPIC(정규식) · DEBATES_TOPIC_HINT(사람이 읽는 주제명) · DEBATES_CONTEXT_FILE(배경 자료 텍스트)
 *      → 모든 호·모든 섹션과 인박스에서 주제에 맞는 항목만 모아 그 주제의 논쟁을 정리한다. 처리 이력은 남기지 않는다.
 *      DEBATES_EXTRA_TWEETS: 주제 모드에서 항목으로 추가할 루트 트윗 id (쉼표 구분) — 인박스에서 사라진 옛 스레드를 되살릴 때
 *      DEBATES_SEARCH: 주제 모드에서 X 검색(search.php)으로 항목을 보강할 쿼리 (쉼표 구분, `from:handle 키워드` 가능)
 *      DEBATES_SEARCH_MIN_FOLLOWERS(기본 3000) · DEBATES_SEARCH_LIMIT(기본 25) · DEBATES_SEARCH_SINCE(기본 60일 전): 팔로워 하한, 전체 상한, 날짜 하한
 *      DEBATES_REPLY_PAGES(기본 1) · DEBATES_REPLY_LIMIT(기본 8): 루트 트윗 답글을 몇 페이지(20건씩) 훑고 상위 몇 명을 남길지. 인용 트윗은 항상 1페이지 추가.
 *      DEBATES_FILL_ROLES=1: 소속·직책(role)이 비어 있는 인물만 프로필 바이오를 근거로 채운다 (추출 없이).
 *      DEBATES_FILL_TEXT=1: 인용 트윗의 원문 전문과 번역이 빈 항목만 채운다 (추출 없이). 팝업의 원문·번역이 여기서 나온다.
 *      DEBATES_REFINE=1 또는 id 목록: 기존 레코드를 인용 트윗 원문 전문을 근거로 교정한다 (입장·논거·인용 다시 쓰기, id·인물 프로필 유지).
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import {
  applyProfiles,
  avatarLarge,
  DebateDraftSchema,
  DraftEnvelopeSchema,
  extractJson,
  handleMatchesName,
  mergeDebates,
  parseThreadReplies,
  personLines,
  pickNotableReplies,
  tweetIdOf,
  CATEGORIES,
  type Debate,
  type DebateDraft,
  type DebatesFile,
  type Engagement,
  type ThreadReply,
  type TimelineEntry,
  type WatchlistEntry,
  type XProfile,
} from './lib/eth-debates';
import { z } from 'zod';
import type { NewsItem } from './lib/eth-news';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DIGESTS = path.resolve(process.cwd(), 'src/data/eth-digests.json');
const INBOX = path.resolve(process.cwd(), 'src/data/eth-news-inbox.json');
const OUTPUT = path.resolve(process.cwd(), 'src/data/eth-debates.json');
const PROFILES = path.resolve(process.cwd(), 'src/data/x-profiles.json');
const ACCOUNTS = path.resolve(process.cwd(), 'scripts/config/twitter-accounts.json');
const MAX_DIGESTS = Number(process.env.DEBATES_MAX_DIGESTS ?? 14);

interface DigestItem { title: string; summary: string; why?: string; url: string; source: string; date: string }
interface Digest { date: string; sections: Array<{ heading: string; items: DigestItem[] }> }

const EDITOR_PROMPT = `당신은 ECK(Ethereum Collective Korea)의 시니어 리서치 에디터입니다.
아래 다이제스트의 '논쟁 · 담론' 항목과 그 스레드의 원문 트윗·답글을 읽고, 쟁점 단위의 논쟁 레코드를 JSON으로 작성하세요.

논쟁의 정의 (세 조건을 모두 만족해야 합니다):
1. 한 문장의 질문으로 쓸 수 있는 쟁점이 있다. 제목이 곧 그 질문이다. (예: "다음 BPO는 무엇을 신호로 발동해야 하나")
2. 서로 다른 입장이 둘 이상이고, 각 입장에 실명 인물이 붙는다. 한 사람이 문제를 제기만 한 경우는 논쟁이 아니므로 싣지 않는다.
3. 입장마다 근거가 되는 원문 링크가 있다. 아래 제공된 트윗·답글의 url만 쓴다. 제공되지 않은 url을 만들지 않는다.
잡담, 홍보, 인사 교환, 단순 동의는 논쟁이 아니다.

기존 논쟁과의 병합:
- "활성 논쟁 목록"에 같은 쟁점(같은 EIP·포크·프로토콜·사건)이 있으면 그 id를 그대로 써서 갱신한다. 새 인물, 새 인용, 진전된 논거를 담는다. 기존 제목은 그대로 둔다.
- 없으면 새 id를 만든다. id는 영문 소문자·숫자·하이픈만, 3~5단어 (예: robinhood-chain-eth-accrual).
- 다이제스트 항목 하나가 두 논쟁일 수도, 여러 항목이 한 논쟁일 수도 있다. 쟁점 기준으로 묶는다.

각 레코드:
- title: 질문형 한 문장, 한국어.
- category: 다음 중 하나 — ${CATEGORIES.join(' | ')}
- summary: 무엇을 두고 누가 갈렸는지 한두 문장.
- keyPoints: 이 논쟁이 정확히 무엇을 다투는지, 하위 질문 2~3개.
- background: 다투는 대상이 무엇인지 모르는 독자를 위한 기술·제도적 맥락 3~5문장 (예: 그 EIP가 무엇을 바꾸는지, 누가 제안했고 어디까지 진행됐는지, 경쟁 제안과의 차이). "배경 자료"를 근거로 써도 된다. 없으면 생략.
- whyItMatters: 이 논쟁의 결과가 생태계에 무엇을 바꾸는지, 무엇을 지켜봐야 하는지 2~3문장. 인사이트를 담되 근거 없는 전망은 쓰지 않는다.
- sources: 이 논쟁에 직접 관련된 문서(EIP 본문, 블로그, 포럼 글)의 title과 url, 최대 5개. "배경 자료"의 출처 목록에 있는 url만 쓴다.
- keywords: 이 논쟁의 후속 활동을 X에서 다시 찾을 검색어 2~4개 (예: "EIP-8363", "tapered issuance burn"). 영문 위주.
- positions: 제목의 질문에 대한 찬성(pro)과 반대(con) 두 편이 기본. 양쪽 논거를 모두 인정하거나 판단을 유보하거나 절충안을 낸 인물은 중립(neutral)으로 따로 둔다. 찬반 축이 아예 아니면 other로 두고 label로 구분한다. 각 편:
  - label: 그 입장을 한 구절로 (예: "호재다", "돌아오는 게 거의 없다")
  - holders: 인물 목록. X 계정이면 handle(@ 없이)과 name, 계정을 모르면 name만 두고 watchlist: false. 인용으로만 등장한 인물도 넣되 watchlist: false.
    각 인물에 role: 소속과 직책을 한 구절로 (예: "Geth 리드", "Paradigm CTO", "EF 리서처", "Base 개발자", "독립 리서처", "인플루언서·투자자"). "인물 정보"의 워치리스트 메모와 바이오를 근거로 하고, 근거가 없으면 role을 생략한다. 지어내지 않는다.
  - points: 핵심 논거 1~4개, 각 한 문장. 인용 트윗의 취지를 유지하되, 배경 자료로 기술적 맥락을 보충해 독자가 논거를 이해할 수 있게 쓴다 (예: "8130으로 타임락을 우회할 수 있다"가 아니라 왜 그렇게 되는지까지).
- timeline: 인용 트윗 목록. date(YYYY-MM-DD), by(핸들 또는 이름), stance, quote(한국어 번역 1~2문장, 원문 취지 유지, 전문 전재 금지), url(제공된 것만), digest(그 항목의 다이제스트 날짜).

인용과 용어 규칙:
- quote는 의역이 아니라 원문의 핵심 문장을 충실히 옮긴 번역이다. 원문 문장 구조를 유지하고, 필요하면 2~3문장까지 옮긴다. 원문에 없는 해석을 보태지 않는다.
- points는 원문에서 근거를 찾을 수 있는 논거만 쓴다. 원문 일부만 주어졌을 수 있으니 확인되지 않는 내용은 단정하지 않는다.
- 전문 용어는 이더리움 커뮤니티에서 통용되는 한국어를 쓰고 레코드 안에서 처음 나올 때 원어를 괄호로 병기한다. 예: 발행(issuance), 스테이킹 비율(staking ratio), 수익률(yield), 소각(burn), 검증자(validator), 프리컴파일(precompile), 프레임 트랜잭션(frame transaction), 멤풀(mempool), 하드포크(hard fork), 계정 추상화(account abstraction), 인증자(authenticator), 키스토어(keystore). EIP 번호와 고유명사는 원어 그대로.
- 배경 자료가 있으면 그 맥락 안에서 용어를 해석한다 (예: 이 논쟁에서 issuance는 검증자 보상 발행, tapered burn은 단계적 소각).

문체: 설명형 서술. 대시(—)와 이모지는 쓰지 않는다.
출력: 아래 형식의 JSON 하나만, 앞뒤에 다른 텍스트 없이.
{"debates": [{"id": "...", "title": "...", "category": "...", "summary": "...", "keyPoints": ["..."], "background": "...", "whyItMatters": "...", "sources": [{"title": "...", "url": "..."}], "keywords": ["..."], "positions": [{"stance": "pro", "label": "...", "holders": [{"handle": "...", "name": "...", "role": "..."}], "points": ["..."]}], "timeline": [{"date": "YYYY-MM-DD", "by": "...", "stance": "pro", "quote": "...", "url": "...", "digest": "YYYY-MM-DD"}]}]}
조건을 만족하는 항목이 없으면 {"debates": []}.`;

function todayKst(): string {
  return process.env.DIGEST_DATE ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf-8')) as T) : fallback;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** twitter-api45 호출. 키가 없거나 실패하면 null — 답글·아바타 없이도 추출은 진행된다. */
function makeXApi() {
  const key = process.env.X_RAPIDAPI_KEY;
  const host = process.env.X_RAPIDAPI_HOST ?? 'twitter-api45.p.rapidapi.com';
  if (!key) {
    console.log('[INFO] X_RAPIDAPI_KEY not set — replies, engagement and avatars skipped');
    return null;
  }
  // 20초 타임아웃, 5xx·네트워크 오류는 한 번 재시도. 타임아웃이 없으면 끊긴 연결 하나에 전체 실행이 멈춘다.
  return async (endpoint: string, params: Record<string, string>): Promise<Record<string, unknown> | null> => {
    const qs = new URLSearchParams(params).toString();
    for (let attempt = 0; attempt < 2; attempt++) {
      await sleep(attempt === 0 ? 500 : 3000);
      try {
        const res = await fetch(`https://${host}/${endpoint}.php?${qs}`, {
          headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
          signal: AbortSignal.timeout(20_000),
        });
        if (res.status >= 500 && attempt === 0) continue;
        if (!res.ok) {
          console.warn(`[WARN] x ${endpoint} ${qs}: HTTP ${res.status}`);
          return null;
        }
        const body = await res.text();
        return body ? (JSON.parse(body) as Record<string, unknown>) : null;
      } catch (error) {
        if (attempt === 0) continue;
        console.warn(`[WARN] x ${endpoint} ${qs}:`, error instanceof Error ? error.message : error);
        return null;
      }
    }
    return null;
  };
}

/** 트윗 원문 전문. display_text는 280자에서 잘리므로 text를 쓰고, t.co 링크는 entities.urls의 펼친 주소로 바꾼다. */
function fullText(tw: Record<string, unknown>): string {
  const text = String(tw.text ?? '');
  const display = String(tw.display_text ?? '');
  let out = text.length >= display.length ? text : display;
  const entities = (tw.entities ?? {}) as Record<string, unknown>;
  for (const u of (entities.urls as Array<Record<string, unknown>> | undefined) ?? []) {
    if (u.url && u.expanded_url) out = out.split(String(u.url)).join(String(u.expanded_url));
  }
  // 미디어 첨부의 t.co 꼬리표는 본문이 아니므로 뗀다
  for (const m of (entities.media as Array<Record<string, unknown>> | undefined) ?? []) {
    if (m.url) out = out.split(String(m.url)).join('');
  }
  return out.replace(/[ \t]+\n/g, '\n').trim();
}

function toEngagement(tweet: Record<string, unknown> | null): Engagement | undefined {
  if (!tweet) return undefined;
  const n = (v: unknown) => Number(v ?? 0) || 0;
  return { likes: n(tweet.likes ?? tweet.favorites), retweets: n(tweet.retweets), quotes: n(tweet.quotes), replies: n(tweet.replies), views: n(tweet.views) };
}

/** 헤드리스 호출 공통: JSON 봉투에서 result만 꺼낸다 */
function runClaude(prompt: string, model: string): string {
  const raw = execFileSync('claude', ['-p', prompt, '--output-format', 'json', '--model', model], {
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 15 * 60 * 1000,
    // ponytail: 로컬 백필 때 Claude Code 세션 안에서 돌려도 중첩 실행 차단에 안 걸리게
    env: { ...process.env, CLAUDECODE: undefined },
  });
  const envelope = JSON.parse(raw) as { result?: string; is_error?: boolean };
  if (envelope.is_error || !envelope.result) throw new Error('headless claude returned an error');
  return envelope.result;
}

/** 프로필 캐시에 없는 핸들을 screenname.php로 채운다 (이름·아바타·팔로워·바이오) */
async function fetchProfiles(handles: Iterable<string>, profiles: Record<string, XProfile>, xApi: ReturnType<typeof makeXApi>, needBio = false) {
  if (!xApi) return;
  for (const handle of new Set(handles)) {
    const key = handle.toLowerCase();
    if (profiles[key] && (!needBio || profiles[key].bio !== undefined)) continue;
    const p = await xApi('screenname', { screenname: handle });
    if (!p?.profile) continue;
    profiles[key] = {
      ...profiles[key],
      handle: String(p.profile),
      name: String(p.name ?? handle),
      avatar: avatarLarge(p.avatar ? String(p.avatar) : undefined) ?? profiles[key]?.avatar,
      followers: Number(p.sub_count ?? 0),
      bio: String(p.desc ?? ''),
    };
  }
}

/** 인용 트윗의 답글·인용 상대와 원문 전문을 tweet.php로 채운다. 둘 다 이미 있는 항목은 건너뛴다. */
async function fillRelations(debates: Debate[], xApi: ReturnType<typeof makeXApi>): Promise<Debate[]> {
  if (!xApi) return debates;
  const out: Debate[] = [];
  for (const d of debates) {
    const timeline: TimelineEntry[] = [];
    for (const t of d.timeline) {
      const id = tweetIdOf(t.url);
      if ((t.relation && t.original) || !id) {
        timeline.push(t);
        continue;
      }
      const tw = await xApi('tweet', { id });
      if (!tw) {
        timeline.push(t);
        continue;
      }
      const author = String((tw.author as Record<string, unknown> | undefined)?.screen_name ?? t.by).toLowerCase();
      const replyTo = tw.in_reply_to_screen_name ? String(tw.in_reply_to_screen_name) : '';
      const quoted = String(((tw.quoted as Record<string, unknown> | undefined)?.author as Record<string, unknown> | undefined)?.screen_name ?? '');
      const original = t.original ?? (fullText(tw) || undefined);
      let relation: Pick<TimelineEntry, 'replyTo' | 'relation'> = { replyTo: t.replyTo, relation: t.relation };
      if (!t.relation) {
        if (replyTo && replyTo.toLowerCase() !== author) relation = { replyTo, relation: 'reply' };
        else if (quoted && quoted.toLowerCase() !== author) relation = { replyTo: quoted, relation: 'quote' };
        else relation = { relation: 'none' };
      }
      timeline.push({ ...t, ...relation, ...(original ? { original } : {}) });
    }
    out.push({ ...d, timeline });
  }
  return out;
}

/** 원문은 있는데 번역이 없는 인용을 헤드리스(sonnet)로 일괄 번역한다. 40건씩 나눠 호출. */
async function fillTranslations(debates: Debate[]): Promise<Debate[]> {
  const pending = debates.flatMap((d) => d.timeline.filter((t) => t.original && !t.translation).map((t) => ({ url: t.url, original: t.original! })));
  if (pending.length === 0) return debates;
  const map = new Map<string, string>();
  for (let i = 0; i < pending.length; i += 40) {
    const chunk = pending.slice(i, i + 40);
    const prompt =
      `다음 트윗 원문들을 한국어로 전문 번역하세요. 요약하거나 의역하지 말고 문장 단위로 충실히 옮기되 자연스러운 설명형 문체로 씁니다. 인명, 프로젝트명, EIP 번호는 원어 그대로 둡니다. 전문 용어는 이더리움 커뮤니티에서 통용되는 한국어를 쓰고 처음 나올 때 원어를 괄호로 병기합니다 (예: 발행(issuance), 스테이킹 비율(staking ratio), 수익률(yield), 소각(burn), 검증자(validator), 프리컴파일(precompile), 프레임 트랜잭션(frame transaction), 멤풀(mempool), 계정 추상화(account abstraction)). 대시(—)와 이모지는 쓰지 않습니다.\n` +
      `출력은 JSON 하나만: {"translations": {"<url>": "<번역>"}}\n\n` +
      chunk.map((c) => `URL: ${c.url}\n원문: ${c.original.replace(/\s+/g, ' ')}`).join('\n\n');
    try {
      const { translations } = z.object({ translations: z.record(z.string(), z.string()) }).parse(extractJson(runClaude(prompt, 'sonnet')));
      for (const [url, text] of Object.entries(translations)) map.set(url, text.trim());
    } catch (error) {
      console.warn('[WARN] translation chunk failed:', error instanceof Error ? error.message : error);
    }
  }
  console.log(`  translated ${map.size}/${pending.length} quotes`);
  return debates.map((d) => ({ ...d, timeline: d.timeline.map((t) => (!t.translation && map.has(t.url) ? { ...t, translation: map.get(t.url) } : t)) }));
}

const REFINE_PROMPT = `당신은 ECK(Ethereum Collective Korea)의 시니어 리서치 에디터입니다.
아래는 이더리움 논쟁 레코드 하나와, 그 레코드가 인용한 트윗들의 원문 전문입니다. 이 레코드는 이전에 트윗 본문이 잘린 상태(280~500자)에서 만들어져, 긴 글의 뒷부분을 보지 못한 채 입장과 논거가 정리됐을 수 있습니다.
원문 전문을 처음부터 끝까지 읽고 레코드를 교정하세요.

교정 규칙:
- id, title, category는 그대로 둡니다. 인물(holders)의 handle과 name도 그대로 두되, 원문 전체를 보니 입장이 다르면 다른 편(pro/con/neutral/other)으로 옮길 수 있습니다. 새 인물을 만들지 않습니다.
- summary, keyPoints, background, whyItMatters, positions[].label, positions[].points를 원문 전문에 맞게 다시 씁니다. 원문에 근거가 없는 내용은 뺍니다. 배경 자료가 있으면 사실 확인에 씁니다.
- timeline의 각 항목은 url을 바꾸지 말고 quote와 stance만 교정합니다. quote는 의역이 아니라 원문의 핵심 문장을 충실히 옮긴 번역이며 2~3문장까지 허용합니다. 원문에 없는 해석을 보태지 않습니다. 항목을 추가하거나 빼지 않습니다.
- 전문 용어는 통용되는 한국어를 쓰고 레코드 안에서 처음 나올 때 원어를 괄호로 병기합니다. 예: 발행(issuance), 스테이킹 비율(staking ratio), 수익률(yield), 소각(burn), 검증자(validator), 프리컴파일(precompile), 프레임 트랜잭션(frame transaction), 멤풀(mempool), 하드포크(hard fork), 계정 추상화(account abstraction), 인증자(authenticator), 키스토어(keystore). EIP 번호와 고유명사는 원어 그대로.
- 문체는 설명형 서술. 대시(—)와 이모지는 쓰지 않습니다.
출력: 입력 레코드와 같은 형식의 JSON 하나만 (키: id, title, category, summary, keyPoints, background, whyItMatters, positions, timeline). timeline 항목은 {date, by, stance, quote, url}만 담습니다.`;

/** 기존 레코드를 인용 트윗 원문 전문으로 교정한다. 헤드리스 호출은 레코드당 한 번(opus). */
async function refineDebates(file: DebatesFile, ids: string[], context: string) {
  for (const id of ids) {
    const d = file.debates.find((x) => x.id === id);
    if (!d) {
      console.warn(`[WARN] refine: unknown id ${id}`);
      continue;
    }
    const record = {
      id: d.id, title: d.title, category: d.category, summary: d.summary, keyPoints: d.keyPoints, background: d.background, whyItMatters: d.whyItMatters,
      positions: d.positions.map((p) => ({ stance: p.stance, label: p.label, holders: p.holders.map((h) => ({ handle: h.handle, name: h.name, role: h.role })), points: p.points })),
      timeline: d.timeline.map((t) => ({ date: t.date, by: t.by, stance: t.stance, quote: t.quote, url: t.url })),
    };
    const originals = d.timeline.map((t, i) => `[${i + 1}] ${t.url}\n@${t.by} · ${t.date}\n${(t.original ?? '(원문 없음)').replace(/\s+/g, ' ')}`).join('\n\n');
    const prompt =
      `${REFINE_PROMPT}\n\n` +
      (context ? `배경 자료 (사실 확인용):\n${context}\n\n` : '') +
      `현재 레코드:\n${JSON.stringify(record, null, 1)}\n\n인용 트윗 원문 전문 (${d.timeline.length}건):\n\n${originals}`;
    if (process.env.DEBATES_DRY_RUN) {
      console.log(prompt.slice(0, 3000));
      return;
    }
    console.log(`Refining ${id} (${d.timeline.length} quotes, ${originals.length} chars of originals)...`);
    let draft: DebateDraft;
    try {
      draft = DebateDraftSchema.parse(extractJson(runClaude(prompt, 'opus')));
    } catch (error) {
      console.warn(`[WARN] refine ${id} failed:`, error instanceof Error ? error.message : error);
      continue;
    }
    if (draft.id !== d.id) {
      console.warn(`[WARN] refine ${id}: model changed id to ${draft.id} — skipped`);
      continue;
    }
    // 인물 프로필(아바타·소속·워치리스트 표시)은 기존 것을 유지하고, 편 배치·라벨·논거는 초안을 따른다
    const profile = new Map(d.positions.flatMap((p) => p.holders.map((h) => [(h.handle ?? h.name).toLowerCase(), h] as const)));
    const positions = draft.positions.map((p) => ({
      ...p,
      holders: p.holders.map((h) => ({ ...(profile.get((h.handle ?? h.name).toLowerCase()) ?? h), ...(h.role && !profile.get((h.handle ?? h.name).toLowerCase())?.role ? { role: h.role } : {}) })),
    }));
    const byUrl = new Map(draft.timeline.map((t) => [t.url, t]));
    const timeline = d.timeline.map((t) => (byUrl.has(t.url) ? { ...t, quote: byUrl.get(t.url)!.quote, stance: byUrl.get(t.url)!.stance ?? t.stance } : t));
    Object.assign(d, {
      title: d.title, category: d.category,
      summary: draft.summary, keyPoints: draft.keyPoints,
      background: draft.background ?? d.background, whyItMatters: draft.whyItMatters ?? d.whyItMatters,
      positions, timeline,
    });
    fs.writeFileSync(OUTPUT, JSON.stringify({ ...file, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
    console.log(`  refined ${id}: ${positions.length} positions, ${timeline.length} quotes`);
  }
}

/** role이 빈 인물의 소속·직책만 채운다. 워치리스트 메모 + 바이오를 근거로, 근거 없으면 비워 둔다. */
async function fillRoles(file: DebatesFile, profiles: Record<string, XProfile>, accountInfo: Map<string, WatchlistEntry>, xApi: ReturnType<typeof makeXApi>) {
  const allHolders = file.debates.flatMap((d) => d.positions.flatMap((p) => p.holders));
  // 아바타가 빈 인물의 프로필도 이 기회에 채운다 (이전 조회가 일시 오류였을 수 있음)
  await fetchProfiles(allHolders.flatMap((h) => (h.handle && !h.avatar ? [h.handle] : [])), profiles, xApi);
  const missing = allHolders.filter((h) => !h.role);
  if (missing.length === 0) {
    console.log('[SKIP] every holder already has a role');
    file.debates = applyProfiles(file.debates, profiles);
    fs.writeFileSync(OUTPUT, JSON.stringify({ ...file, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
    fs.writeFileSync(PROFILES, JSON.stringify(profiles, null, 2), 'utf-8');
    return;
  }
  await fetchProfiles(missing.flatMap((h) => (h.handle ? [h.handle] : [])), profiles, xApi, true);
  const lines = personLines(missing.flatMap((h) => (h.handle ? [h.handle] : [])), accountInfo, profiles);
  // 이름만 있는 인물(인용으로 등장): X 핸들을 추정받되, 프로필 조회로 이름이 맞는지 검증한 것만 쓴다
  const nameOnlyHolders = file.debates.flatMap((d) => d.positions.flatMap((p) => p.holders.filter((h) => !h.handle)));
  const nameOnly = nameOnlyHolders.map((h) => `- 이름: ${h.name} (X 계정 미상)`);
  const prompt =
    `다음 인물들의 소속과 직책을 한국어 한 구절로 정리하세요 (예: "Geth 리드", "Paradigm CTO", "EF 리서처", "Base 개발자", "독립 리서처", "인플루언서·투자자", "Uniswap 창업자").\n` +
    `워치리스트 메모와 바이오를 근거로만 판단하고, 근거가 부족하면 그 인물은 생략합니다. 지어내지 않습니다. 이더리움 생태계에서 널리 알려진 인물이면 알려진 소속을 써도 됩니다.\n` +
    `"X 계정 미상"인 인물은 확실히 아는 경우에만 X 핸들(@ 없이)을 handles에 적습니다. 확실하지 않으면 적지 않습니다.\n` +
    `출력은 JSON 하나만: {"roles": {"<핸들 또는 이름>": "<소속·직책>"}, "handles": {"<이름>": "<핸들>"}}\n\n인물 정보:\n${[...lines, ...nameOnly].join('\n')}`;
  if (process.env.DEBATES_DRY_RUN) {
    console.log(prompt);
    return;
  }
  const { roles, handles } = z
    .object({ roles: z.record(z.string(), z.string()), handles: z.record(z.string(), z.string()).optional() })
    .parse(extractJson(runClaude(prompt, 'sonnet')));
  const lookup = new Map(Object.entries(roles).map(([k, v]) => [k.replace(/^@/, '').toLowerCase(), v.trim()]));

  // 핸들 검증: 워치리스트 이름·핸들과 맞으면 그대로, 아니면 screenname.php로 조회해 이름이 맞을 때만 채택
  const verified = new Map<string, string>();
  for (const h of nameOnlyHolders) {
    const fromWatchlist = [...accountInfo.entries()].find(([sn, w]) => handleMatchesName(h.name, w.name, sn));
    const guess = fromWatchlist?.[0] ?? handles?.[h.name]?.replace(/^@/, '');
    if (!guess) continue;
    await fetchProfiles([guess], profiles, xApi, true);
    const p = profiles[guess.toLowerCase()];
    if (p && handleMatchesName(h.name, p.name, p.handle)) verified.set(h.name.toLowerCase(), p.handle);
  }
  let filled = 0;
  file.debates = file.debates.map((d) => ({
    ...d,
    positions: d.positions.map((p) => ({
      ...p,
      holders: p.holders.map((h) => {
        const handle = h.handle ?? verified.get(h.name.toLowerCase());
        const role = h.role ?? lookup.get((handle ?? h.name).toLowerCase()) ?? lookup.get(h.name.toLowerCase());
        if (role && !h.role) filled += 1;
        return { ...h, ...(handle ? { handle } : {}), ...(role ? { role } : {}) };
      }),
    })),
  }));
  file.debates = applyProfiles(file.debates, profiles);
  fs.writeFileSync(OUTPUT, JSON.stringify({ ...file, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
  fs.writeFileSync(PROFILES, JSON.stringify(profiles, null, 2), 'utf-8');
  console.log(`Filled roles for ${filled}/${missing.length} holders`);
}

async function main() {
  const today = todayKst();
  const digests = readJson<{ digests: Digest[] }>(DIGESTS, { digests: [] }).digests;
  const file = readJson<DebatesFile>(OUTPUT, { updatedAt: '', processedDigests: [], debates: [] });
  const processed = new Set(file.processedDigests);
  const accounts = readJson<{ accounts: Array<{ screenname: string; name?: string; why?: string }> }>(ACCOUNTS, { accounts: [] }).accounts;
  const accountInfo = new Map<string, WatchlistEntry>(accounts.map((a) => [a.screenname.toLowerCase(), { name: a.name ?? a.screenname, why: a.why ?? '' }]));
  const profiles = readJson<Record<string, XProfile>>(PROFILES, {});
  if (process.env.DEBATES_FILL_ROLES) {
    await fillRoles(file, profiles, accountInfo, makeXApi());
    return;
  }
  if (process.env.DEBATES_REFINE) {
    const ids = process.env.DEBATES_REFINE === '1' ? file.debates.map((d) => d.id) : process.env.DEBATES_REFINE.split(',').map((s) => s.trim()).filter(Boolean);
    const ctxFile = process.env.DEBATES_CONTEXT_FILE;
    await refineDebates(file, ids, ctxFile && fs.existsSync(ctxFile) ? fs.readFileSync(ctxFile, 'utf-8').trim() : '');
    return;
  }
  if (process.env.DEBATES_FILL_TEXT) {
    let debates = await fillRelations(file.debates, makeXApi());
    debates = process.env.DEBATES_DRY_RUN ? debates : await fillTranslations(debates);
    fs.writeFileSync(OUTPUT, JSON.stringify({ ...file, updatedAt: new Date().toISOString(), debates }, null, 2), 'utf-8');
    console.log(`Filled originals/translations for ${debates.length} debates`);
    return;
  }
  const topic = process.env.DEBATES_TOPIC ? new RegExp(process.env.DEBATES_TOPIC, 'i') : null;
  const pending = topic
    ? [...digests].sort((a, b) => a.date.localeCompare(b.date))
    : digests.filter((d) => !processed.has(d.date)).sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_DIGESTS);
  if (pending.length === 0) {
    console.log('[SKIP] no unprocessed digests');
    return;
  }

  const inbox = readJson<{ items: NewsItem[] }>(INBOX, { items: [] }).items;
  const rootByTweetId = new Map(inbox.filter((i) => i.sourceType === 'twitter').map((i) => [tweetIdOf(i.url), i]));
  type Entry = DigestItem & { digestDate: string };
  const matches = (it: DigestItem) => !topic || topic.test(`${it.title} ${it.summary} ${it.why ?? ''}`);
  const items: Entry[] = pending.flatMap((d) =>
    d.sections
      .filter((s) => topic || /논쟁|담론/.test(s.heading))
      .flatMap((s) => s.items.filter(matches).map((it) => ({ ...it, digestDate: d.date }))),
  );
  if (topic) {
    // 인박스에서 주제에 맞는 트윗 스레드의 루트를 항목으로 추가 (다이제스트 항목이 이미 가리키는 스레드는 제외, 큰 스레드 순 4개)
    const coveredConv = new Set(items.map((it) => rootByTweetId.get(tweetIdOf(it.url))?.conversationId).filter(Boolean));
    const byConv = new Map<string, NewsItem[]>();
    for (const i of inbox) {
      if (i.sourceType !== 'twitter' || !i.conversationId || i.summary.startsWith('RT @') || !topic.test(i.summary)) continue;
      byConv.set(i.conversationId, [...(byConv.get(i.conversationId) ?? []), i]);
    }
    const roots = [...byConv.entries()]
      .filter(([conv]) => !coveredConv.has(conv))
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4)
      .map(([, tweets]) => [...tweets].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))[0]);
    items.push(
      ...roots.map((r) => ({ title: r.summary.slice(0, 80), summary: r.summary, url: r.url, source: `@${r.author}`, date: r.publishedAt.slice(0, 10), digestDate: r.publishedAt.slice(0, 10) })),
    );
  }
  // X 검색으로 항목 보강 (주제 모드 전용): 워치리스트 밖 인물의 발언까지 잡는다. RT·소규모 계정·주제 불일치 제외, 반응 많은 순.
  const searchQueries = topic && process.env.DEBATES_SEARCH ? process.env.DEBATES_SEARCH : null;
  const searchApi = searchQueries ? makeXApi() : null;
  if (topic && searchQueries && searchApi) {
    const minFollowers = Number(process.env.DEBATES_SEARCH_MIN_FOLLOWERS ?? 3000);
    // 기본 최근 60일: from: 검색은 주제 정규식을 안 거치므로 옛 트윗이 섞이지 않게 날짜로 자른다
    const since = process.env.DEBATES_SEARCH_SINCE ?? new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
    const limit = Number(process.env.DEBATES_SEARCH_LIMIT ?? 25);
    const known = new Set(items.map((it) => tweetIdOf(it.url)).filter(Boolean));
    const found = new Map<string, { fav: number; entry: Entry }>();
    for (const query of searchQueries.split(',').map((s) => s.trim()).filter(Boolean)) {
      const res = await searchApi('search', { query, search_type: query.startsWith('from:') ? 'Latest' : 'Top' });
      for (const tw of (res?.timeline as Array<Record<string, unknown>> | undefined) ?? []) {
        const id = String(tw.tweet_id ?? '');
        const handle = String(tw.screen_name ?? '');
        const text = String(tw.text ?? '');
        const info = (tw.user_info ?? {}) as Record<string, unknown>;
        const followers = Number(info.followers_count ?? 0);
        if (!id || !handle || text.startsWith('RT @') || known.has(id) || found.has(id)) continue;
        if (!query.startsWith('from:') && !accountInfo.has(handle.toLowerCase()) && followers < minFollowers) continue;
        if (!query.startsWith('from:') && !topic.test(text)) continue;
        profiles[handle.toLowerCase()] ??= { handle, name: String(info.name ?? handle), avatar: avatarLarge(info.avatar ? String(info.avatar) : undefined), followers, bio: info.description ? String(info.description) : undefined };
        const date = new Date(String(tw.created_at ?? '')).toISOString().slice(0, 10);
        if (date < since) continue;
        found.set(id, { fav: Number(tw.favorites ?? 0), entry: { title: text.slice(0, 80), summary: text, url: `https://x.com/${handle}/status/${id}`, source: `@${handle}`, date, digestDate: date } });
      }
    }
    const picked = [...found.values()].sort((a, b) => b.fav - a.fav).slice(0, limit);
    console.log(`  search: ${found.size} candidates → ${picked.length} entries`);
    items.push(...picked.map((p) => p.entry));
  }
  // 인박스에서 이미 사라진 옛 스레드는 루트 트윗 id를 직접 받아 되살린다 (주제 모드 전용)
  const extraApi = topic && process.env.DEBATES_EXTRA_TWEETS ? makeXApi() : null;
  if (extraApi) {
    for (const id of process.env.DEBATES_EXTRA_TWEETS!.split(',').map((s) => s.trim()).filter(Boolean)) {
      const tw = await extraApi('tweet', { id });
      const author = (tw?.author as Record<string, unknown> | undefined)?.screen_name;
      if (!tw || !author) continue;
      const quoted = tw.quoted as Record<string, unknown> | undefined;
      const quotedText = quoted ? ` [인용한 글 @${String((quoted.author as Record<string, unknown> | undefined)?.screen_name ?? '')}: ${fullText(quoted)}]` : '';
      const text = fullText(tw) + quotedText;
      const date = new Date(String(tw.created_at ?? '')).toISOString().slice(0, 10);
      items.push({ title: text.slice(0, 80), summary: text, url: `https://x.com/${String(author)}/status/${id}`, source: `@${String(author)}`, date, digestDate: date });
    }
  }
  const markProcessed = (debates: Debate[], profiles: Record<string, XProfile>) => {
    const out: DebatesFile = {
      updatedAt: new Date().toISOString(),
      processedDigests: topic ? file.processedDigests : [...processed, ...pending.map((d) => d.date)].sort(),
      debates,
    };
    fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2), 'utf-8');
    fs.writeFileSync(PROFILES, JSON.stringify(profiles, null, 2), 'utf-8');
  };
  if (items.length === 0) {
    console.log(topic ? '[SKIP] no items match the topic' : `[SKIP] ${pending.length} digest(s) have no debate items — marked processed`);
    if (!topic) markProcessed(file.debates, profiles);
    return;
  }

  const watchlist = new Set(accountInfo.keys());
  const xApi = makeXApi();
  const replyPages = Number(process.env.DEBATES_REPLY_PAGES ?? 1);
  const replyLimit = Number(process.env.DEBATES_REPLY_LIMIT ?? 8);
  const people = new Set<string>();
  const engagementByUrl = new Map<string, Engagement>();

  // 항목별 입력 블록: 다이제스트 요약 + 스레드 원문 + 답글 + 반응 수
  const blocks: string[] = [];
  for (const item of items) {
    const tweetId = tweetIdOf(item.url);
    const root = tweetId ? rootByTweetId.get(tweetId) : undefined;
    // 같은 트윗이 리트윗한 계정 아래 중복 저장돼 있을 수 있어 트윗 id 기준으로 하나만
    const seenIds = new Set<string>();
    const thread = (root?.conversationId ? inbox.filter((i) => i.conversationId === root.conversationId) : [])
      .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
      .filter((t) => {
        const id = tweetIdOf(t.url) ?? t.id;
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });
    let replies: ThreadReply[] = [];
    let engagement: Engagement | undefined;
    if (xApi && tweetId) {
      // 답글은 페이지(20건)를 여러 장 훑어 팔로워 많은 순으로 고르고, 인용 트윗(quoted_tweet_id 검색)도 같은 기준으로 합친다
      const fetched: ThreadReply[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < replyPages; page++) {
        const res = await xApi('latest_replies', { id: tweetId, ...(cursor ? { cursor } : {}) });
        fetched.push(...parseThreadReplies(res));
        cursor = res?.next_cursor ? String(res.next_cursor) : undefined;
        if (!cursor) break;
      }
      const quotes = parseThreadReplies(await xApi('search', { query: `quoted_tweet_id:${tweetId}`, search_type: 'Latest' })).map((r) => ({ ...r, text: `[인용] ${r.text}` }));
      const pool = [...fetched, ...quotes].filter((r) => r.id !== tweetId && !seenIds.has(r.id));
      replies = pickNotableReplies(pool, watchlist, { limit: replyLimit });
      engagement = toEngagement(await xApi('tweet', { id: tweetId }));
      if (engagement) engagementByUrl.set(item.url, engagement);
      for (const r of replies) {
        profiles[r.handle.toLowerCase()] ??= { handle: r.handle, name: r.name, avatar: r.avatar, followers: r.followers, bio: r.bio };
      }
    }
    for (const h of [...thread.map((t) => t.author), ...replies.map((r) => r.handle), ...(item.source.match(/@(\w+)/g) ?? [])]) people.add(h);
    const threadLines = thread.map((t) => `- [${t.publishedAt.slice(0, 10)}] @${t.author}: ${t.summary.replace(/\s+/g, ' ')} — ${t.url}`);
    const replyLines = replies.map((r) => `- [${r.date.slice(0, 10)}] @${r.handle} (${r.name}, 팔로워 ${r.followers}): ${r.text.replace(/\s+/g, ' ')} — ${r.url}`);
    // 프롬프트에 인용 트윗임을 알렸으니 텍스트 표식은 그대로 두되, 아래 라벨을 '답글·인용'으로 바꾼다
    blocks.push(
      `### [${item.digestDate}] ${item.title}\n` +
        `요약: ${item.summary}\n` +
        (item.why ? `함의: ${item.why}\n` : '') +
        `대표 링크: ${item.url} (${item.source})\n` +
        (threadLines.length ? `스레드 원문 트윗:\n${threadLines.join('\n')}\n` : '') +
        (replyLines.length ? `루트 트윗에 대한 답글과 인용 트윗 (팔로워 순, [인용]은 인용 트윗):\n${replyLines.join('\n')}\n` : '') +
        (engagement ? `반응: 좋아요 ${engagement.likes} · 리트윗 ${engagement.retweets} · 인용 ${engagement.quotes} · 답글 ${engagement.replies}\n` : ''),
    );
  }

  const active = file.debates.filter((d) => d.status === 'active' || d.status === 'cooling');
  const activeLines = active.map(
    (d) =>
      `- id: ${d.id} | ${d.title} | ` +
      d.positions.map((p) => `${p.stance}: ${p.label} (${p.holders.map((h) => h.handle ?? h.name).join(', ')})`).join(' / ') +
      `\n  요약: ${d.summary}`,
  );

  const hint = process.env.DEBATES_TOPIC_HINT ?? process.env.DEBATES_TOPIC;
  const contextFile = process.env.DEBATES_CONTEXT_FILE;
  const context = contextFile && fs.existsSync(contextFile) ? fs.readFileSync(contextFile, 'utf-8').trim() : '';
  const peopleLines = personLines(people, accountInfo, profiles);
  const prompt =
    `${EDITOR_PROMPT}\n\n오늘 날짜: ${today}\n\n` +
    (peopleLines.length ? `인물 정보 (소속·직책 판단 근거):\n${peopleLines.join('\n')}\n\n` : '') +
    (topic
      ? `이번 요청의 주제: ${hint}\n주제와 무관한 항목은 무시하고 이 주제에 해당하는 논쟁만 정리하세요. 같은 주제 안에서도 쟁점이 뚜렷이 다르면 레코드를 나눕니다.\n\n`
      : '') +
    (context ? `배경 자료 (사실 확인용. 인용과 url의 출처로는 쓰지 않습니다):\n${context}\n\n` : '') +
    (activeLines.length ? `활성 논쟁 목록 (같은 쟁점이면 id 재사용):\n${activeLines.join('\n')}\n\n` : '활성 논쟁 목록: 없음\n\n') +
    `다이제스트 논쟁 항목 (${items.length}건):\n\n${blocks.join('\n')}`;

  if (process.env.DEBATES_DRY_RUN) {
    console.log(prompt);
    return;
  }

  console.log(`Extracting debates from ${items.length} items across ${pending.length} digest(s) (headless claude)...`);
  const { debates: drafts } = DraftEnvelopeSchema.parse(extractJson(runClaude(prompt, 'opus')));

  let merged = mergeDebates(file.debates, drafts, today);

  // 아바타: 핸들이 있는데 캐시에 없는 인물만 프로필 1회 조회
  await fetchProfiles(merged.flatMap((d) => d.positions.flatMap((p) => p.holders.flatMap((h) => (h.handle ? [h.handle] : [])))), profiles, xApi);
  merged = applyProfiles(merged, profiles);

  merged = await fillRelations(merged, xApi);
  merged = await fillTranslations(merged);

  // 루트 트윗의 반응 수: 타임라인 트윗 중 반응이 가장 큰 것을 대표로 붙인다 (이미 있는 값보다 클 때만 교체)
  const weight = (e?: Engagement) => (e ? e.likes + e.retweets * 3 + e.quotes * 3 + e.replies : -1);
  merged = merged.map((d) => {
    const best = d.timeline
      .map((t) => ({ url: t.url, engagement: engagementByUrl.get(t.url) }))
      .filter((c): c is { url: string; engagement: Engagement } => Boolean(c.engagement))
      .sort((a, b) => weight(b.engagement) - weight(a.engagement))[0];
    return best && weight(best.engagement) > weight(d.engagement) ? { ...d, rootUrl: best.url, engagement: best.engagement } : d;
  });

  markProcessed(merged, profiles);
  const created = drafts.filter((dr) => !file.debates.some((d) => d.id === dr.id)).length;
  console.log(`Written ${merged.length} debates (${created} new, ${drafts.length - created} updated) to ${OUTPUT}`);
}

main().catch((error) => {
  console.warn('[WARN] extract-eth-debates failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
