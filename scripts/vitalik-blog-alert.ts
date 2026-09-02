/**
 * 비탈릭 블로그 새 글 감지 → 헤드리스 claude 상세 분석 → 오너 DM 검수 → 승인 시 채널 게시.
 *
 * VPS 크론 5분마다 실행. 매 실행에서 두 가지를 처리한다:
 *   1) DM 버튼 응답 폴링(getUpdates): 승인이면 채널 게시, 거절이면 폐기
 *   2) 피드에서 새 글 감지: 분석 생성 후 오너 DM으로 미리보기 + 승인/거절 버튼 발송
 * 새 글도 버튼 응답도 없으면 HTTP 두 번으로 끝난다(claude 호출 없음).
 *
 * 상태 파일이 없는 첫 실행은 현재 글 전체를 발송 없이 기록만 한다(과거 글 폭탄 방지).
 *
 * Env: TELEGRAM_BOT_TOKEN (필수), VITALIK_ALERT_CHAT (필수 — 오너 DM chat id),
 *      TELEGRAM_CHANNEL (기본 thetickeriseth — 승인 시 게시 대상)
 * 실행: npx tsx scripts/vitalik-blog-alert.ts [--test]
 *   --test: 상태와 무관하게 최신 글 1건을 분석해 DM 검수 흐름을 태운다
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { parseFeed, type NewsItem } from './lib/eth-news';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const FEED_URL = 'https://vitalik.eth.limo/feed.xml';
const STATE_FILE = process.env.VITALIK_ALERT_STATE ?? path.join(os.homedir(), '.eck-vitalik-seen.json');
const MAX_POSTS_PER_RUN = 2;
const MAX_CONTENT_CHARS = 60_000;
const CHUNK_LIMIT = 3_500; // 텔레그램 4096자 제한 아래 여유

const ANALYSIS_PROMPT = `당신은 ECK(Ethereum Collective Korea)의 시니어 리서치 에디터입니다.
비탈릭 부테린이 블로그에 새 글을 올렸습니다. 이더리움을 진지하게 따라가는 한국어 독자
(리서처·빌더)를 위해 이 글의 디테일한 분석을 작성하세요.

구성 (섹션 제목은 ▎로 시작해 아래 다섯 제목을 그대로 쓰고, 섹션 사이 빈 줄):
▎세 줄 요약 (글의 핵심을 세 문장으로)
▎핵심 주장과 논리 (글의 전개를 따라 주장·근거·제안을 상세히 정리, 가장 길게)
▎기술적 배경 (이해에 필요한 개념, 선행 논의, 관련 EIP·업그레이드 연결)
▎생태계 함의 (무엇이 달라지는지, 누가 영향을 받는지)
▎예상 쟁점 (반론이 나올 지점과 논쟁 구도 예측)
괄호 안은 작성 지침이므로 출력하는 섹션 제목에는 포함하지 않습니다.

원칙:
- 원문 문장을 복사하지 않고 재작성합니다. 수치·용어는 정확하게, 핵심 용어는 원어 병기.
- 사실과 비탈릭의 주장을 구분하고, 과장·투자 조언 금지.
- 설명 위주로 씁니다: 개념·용어가 등장할 때마다 독자가 따로 검색하지 않아도 되도록
  한두 문장으로 풀어서 설명하고, 압축된 나열보다 차근차근 서술하는 문장을 우선합니다.
  "왜 이 문제가 어려운지", "이 제안이 기존 방식과 무엇이 다른지"를 친절하게 짚어주세요.
- 대시(—) 구두점은 쓰지 않습니다. 한국어에서 잘 쓰지 않는 표기이므로 쉼표나 완결된
  문장으로 자연스럽게 풀어 씁니다. 이모지도 쓰지 않습니다.
- 텔레그램 메시지로 발송되므로 마크다운 문법 없이 플레인 텍스트로만 씁니다.
- 전체 3000~5000자.

응답은 분석 본문만 출력하세요. 인사말·메타 설명 없이.

=== 글 제목 ===
{TITLE}

=== 본문 ===
{CONTENT}`;

interface PendingItem {
  title: string;
  url: string;
  analysis: string;
}

interface State {
  seen: string[];
  /** getUpdates 오프셋 — 처리한 업데이트 재수신 방지 */
  offset: number;
  /** 승인 대기 중인 분석 (key = url 해시, 버튼 callback_data로 사용) */
  pending: Record<string, PendingItem>;
}

/** 피드가 죽은 vitalik.ca 도메인으로 링크를 내보내므로 eth.limo 미러로 교체 */
function normalizeUrl(url: string): string {
  return url.replace('://vitalik.ca/', '://vitalik.eth.limo/');
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function keyOf(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 12);
}

function loadState(): State | null {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    if (Array.isArray(raw)) return { seen: raw, offset: 0, pending: {} }; // 구버전 마이그레이션
    return raw as State;
  } catch {
    return null; // 첫 실행
  }
}

function saveState(state: State): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

async function tg(token: string, method: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as { ok: boolean; result?: any; description?: string };
  if (!body.ok) throw new Error(`${method} failed: ${body.description}`);
  return body.result;
}

async function fetchPostText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'eck-vitalik-alert/1.0' } });
  if (!res.ok) throw new Error(`post fetch HTTP ${res.status}`);
  return stripHtml(await res.text()).slice(0, MAX_CONTENT_CHARS);
}

function analyze(post: NewsItem, content: string): string {
  const prompt = ANALYSIS_PROMPT.replace('{TITLE}', post.title).replace('{CONTENT}', content);
  const raw = execFileSync('claude', ['-p', prompt, '--output-format', 'json', '--model', 'opus'], {
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  });
  const envelope = JSON.parse(raw) as { result?: string; is_error?: boolean };
  if (envelope.is_error || !envelope.result) throw new Error('headless claude returned an error');
  return envelope.result.trim();
}

/** 문단 경계 기준으로 텔레그램 길이 제한에 맞게 분할 */
function chunk(text: string): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const para of text.split('\n\n')) {
    const next = current ? `${current}\n\n${para}` : para;
    if (next.length > CHUNK_LIMIT && current) {
      chunks.push(current);
      current = para;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function sendChunks(token: string, chatId: string, text: string): Promise<void> {
  const parts = chunk(text);
  for (let i = 0; i < parts.length; i++) {
    await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: parts[i],
      disable_web_page_preview: i !== 0,
    });
  }
}

function channelChatId(): string {
  const channel = process.env.TELEGRAM_CHANNEL ?? 'thetickeriseth';
  return /^-?\d+$/.test(channel) ? channel : `@${channel}`;
}

/** DM 버튼 응답 처리: 승인이면 채널 게시, 거절이면 폐기 */
async function pollCallbacks(token: string, ownerChat: string, state: State): Promise<void> {
  const updates: any[] = await tg(token, 'getUpdates', {
    offset: state.offset,
    timeout: 0,
    allowed_updates: ['callback_query'],
  });

  for (const update of updates) {
    state.offset = update.update_id + 1;
    const cb = update.callback_query;
    if (!cb?.data || String(cb.message?.chat?.id) !== ownerChat) continue;

    const [action, key] = String(cb.data).split(':');
    const item = state.pending[key];
    if (!item) {
      await tg(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: '만료된 항목입니다' });
      continue;
    }

    if (action === 'pub') {
      await sendChunks(token, channelChatId(), `비탈릭 새 글 분석\n${item.title}\n${item.url}\n\n${item.analysis}`);
      await tg(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: '채널에 게시했습니다' });
      await tg(token, 'editMessageText', {
        chat_id: ownerChat,
        message_id: cb.message.message_id,
        text: `승인 완료, 채널에 게시했습니다.\n${item.title}`,
      });
      console.log(`Published "${item.title}" to ${channelChatId()}.`);
    } else {
      await tg(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: '게시하지 않습니다' });
      await tg(token, 'editMessageText', {
        chat_id: ownerChat,
        message_id: cb.message.message_id,
        text: `거절 처리했습니다. 게시하지 않습니다.\n${item.title}`,
      });
      console.log(`Rejected "${item.title}".`);
    }
    delete state.pending[key];
  }
}

/** 새 글 감지: 분석 생성 후 DM 미리보기 + 승인/거절 버튼 발송 */
async function detectAndPreview(token: string, ownerChat: string, state: State, isTest: boolean): Promise<void> {
  const res = await fetch(FEED_URL, { headers: { 'user-agent': 'eck-vitalik-alert/1.0' } });
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  const posts = parseFeed(await res.text(), 'vitalik')
    .map((p) => ({ ...p, url: normalizeUrl(p.url) }))
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  if (posts.length === 0) throw new Error('feed returned no entries');

  const seenSet = new Set(state.seen);
  const targets = isTest
    ? [posts[0]]
    : posts.filter((p) => !seenSet.has(p.url)).slice(0, MAX_POSTS_PER_RUN);
  if (targets.length === 0) {
    console.log('No new posts.');
    return;
  }

  for (const post of targets) {
    console.log(`Analyzing "${post.title}" (${post.url})...`);
    const content = await fetchPostText(post.url);
    const analysis = analyze(post, content);
    const key = keyOf(post.url);

    await sendChunks(
      token,
      ownerChat,
      `비탈릭 새 글 분석 검수${isTest ? ' (테스트)' : ''}\n${post.title}\n${post.url}\n\n${analysis}`,
    );
    await tg(token, 'sendMessage', {
      chat_id: ownerChat,
      text: '위 분석을 채널에 게시할까요?',
      reply_markup: {
        inline_keyboard: [[
          { text: '승인', callback_data: `pub:${key}` },
          { text: '거절', callback_data: `rej:${key}` },
        ]],
      },
    });

    state.pending[key] = { title: post.title, url: post.url, analysis };
    seenSet.add(post.url);
    state.seen = [...seenSet];
    saveState(state);
    console.log(`Preview sent to ${ownerChat}, awaiting approval (key ${key}).`);
  }
}

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ownerChat = process.env.VITALIK_ALERT_CHAT;
  if (!token || !ownerChat) throw new Error('TELEGRAM_BOT_TOKEN and VITALIK_ALERT_CHAT are required');
  const isTest = process.argv.includes('--test');

  let state = loadState();
  if (state === null) {
    // 첫 실행: 기존 글 전체를 기록만 하고 발송하지 않는다 (--test는 이어서 검수 흐름 실행)
    const res = await fetch(FEED_URL, { headers: { 'user-agent': 'eck-vitalik-alert/1.0' } });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    const posts = parseFeed(await res.text(), 'vitalik').map((p) => normalizeUrl(p.url));
    state = { seen: posts, offset: 0, pending: {} };
    saveState(state);
    console.log(`First run: recorded ${posts.length} existing posts.`);
    if (!isTest) return;
  }

  await pollCallbacks(token, ownerChat, state);
  saveState(state);
  await detectAndPreview(token, ownerChat, state, isTest);
}

main().catch((error) => {
  console.warn('[WARN] vitalik-blog-alert failed:', error instanceof Error ? error.message : error);
  process.exit(0); // 크론에서 조용히 재시도
});
