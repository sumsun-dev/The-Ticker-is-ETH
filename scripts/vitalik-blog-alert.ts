/**
 * 비탈릭 블로그 새 글 감지 → 헤드리스 claude 본문 해설 생성 → 오너 DM 발송.
 * 채널 게시는 오너가 DM 내용을 보고 수동으로 한다.
 *
 * VPS 크론 5분마다 실행. 새 글이 없으면 RSS 확인 한 번으로 끝난다(claude 호출 없음).
 * 상태 파일이 없는 첫 실행은 현재 글 전체를 발송 없이 기록만 한다(과거 글 폭탄 방지).
 *
 * Env: TELEGRAM_BOT_TOKEN (필수), VITALIK_ALERT_CHAT (필수, 오너 DM chat id)
 * 실행: npx tsx scripts/vitalik-blog-alert.ts [--test]
 *   --test: 상태와 무관하게 최신 글 1건을 분석해 DM으로 발송
 */
import { execFileSync } from 'node:child_process';
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
const CHUNK_LIMIT = 4_000; // 텔레그램 4096자 제한 아래 여유. 분량 준수 시 메시지 1개로 발송됨

const ANALYSIS_PROMPT = `당신은 ECK(Ethereum Collective Korea)의 시니어 리서치 에디터입니다.
비탈릭 부테린이 블로그에 새 글을 올렸습니다. 이더리움을 진지하게 따라가는 한국어 독자
(리서처·빌더)를 위해, 이 글을 읽지 않은 사람도 내용을 온전히 이해할 수 있는 해설을 작성하세요.

이 해설의 목적은 평가나 전망이 아니라 "본문 내용을 이해시키는 것"입니다.
글이 무엇을 말하는지 설명하는 데 분량의 거의 전부를 쓰세요.

구성 (섹션 제목은 ▎로 시작해 아래 제목을 그대로 쓰고, 섹션 사이 빈 줄):
▎세 줄 요약 (핵심을 세 문장으로. 반드시 한 문장마다 줄을 바꿔 정확히 세 줄로 쓰고,
  각 줄 앞에 "• "를 붙입니다. 각 문장은 한 줄에 들어올 만큼 짧고 명료하게,
  문단으로 이어 쓰지 않습니다.)
▎본문 요약 & 설명 (전체 분량의 8할 이상. 글의 전개 순서를 그대로 따라가며, 각 부분이
  무슨 이야기를 하는지 차근차근 요약하고 설명합니다. 글 안의 소제목 흐름대로 문단을
  나누고, 새 개념이 등장하면 그 자리에서 한두 문장으로 풀어 설명한 뒤 진행합니다. 글에
  나온 예시·수치·비유는 적극 활용해 재서술합니다. "왜 이 문제가 어려운지", "이 방식이
  기존과 무엇이 다른지"를 독자가 따라올 수 있게 짚어주세요.)
▎왜 중요한가 (마무리 한두 문단. 이 글이 이더리움 생태계에서 갖는 의미를 짧게.)
괄호 안은 작성 지침이므로 출력하는 섹션 제목에는 포함하지 않습니다.
쟁점 예측, 반론 전망, 별도의 배경 섹션은 만들지 않습니다. 배경 설명이 필요하면 본문
요약 & 설명 안에서 해당 대목에 붙입니다.

원칙:
- 원문 문장을 복사하지 않고 재작성합니다. 수치·용어는 정확하게, 핵심 용어는 원어 병기.
- 사실과 비탈릭의 주장을 구분하고, 과장·투자 조언 금지.
- 압축된 나열보다 차근차근 서술하는 설명형 문장을 우선합니다.
- AI 특유의 상투 문체를 피합니다: "~라고 할 수 있습니다", "~하는 것이 중요합니다",
  "주목할 필요가 있습니다", "결론적으로" 같은 형식적 마무리, 모든 문단을 비슷한 패턴으로
  시작하는 습관, "~에 있어서"나 "~를 통해"를 남용하는 번역투를 쓰지 않습니다.
  숙련된 한국어 에디터가 동료에게 설명하듯 담백하고 자연스러운 문장으로 씁니다.
  문장 길이에 변화를 주고, 하나 마나 한 수식어는 뺍니다.
- 대시(—) 구두점은 쓰지 않습니다. 한국어에서 잘 쓰지 않는 표기이므로 쉼표나 완결된
  문장으로 자연스럽게 풀어 씁니다. 이모지도 쓰지 않습니다.
- 텔레그램 메시지로 발송되므로 마크다운 문법 없이 플레인 텍스트로만 씁니다.
- 분량: 전체 2800~3500자. 텔레그램 메시지 1개에 담아야 하므로 3500자를 절대 넘기지
  않습니다. 분량이 부족하면 본문 요약 & 설명을 압축하되, 섹션 구성은 유지합니다.

응답은 해설 본문만 출력하세요. 인사말·메타 설명 없이.

=== 글 제목 ===
{TITLE}

=== 본문 ===
{CONTENT}`;

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

/** 구버전 상태(url 배열, 또는 승인 흐름 시절의 {seen,...} 객체) 모두 수용 */
function loadSeen(): Set<string> | null {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    return new Set((Array.isArray(raw) ? raw : raw.seen) as string[]);
  } catch {
    return null; // 첫 실행
  }
}

function saveSeen(seen: Set<string>): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify([...seen], null, 2), 'utf-8');
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

async function sendDm(token: string, chatId: string, text: string, preview: boolean): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: !preview,
    }),
  });
  const body = (await res.json()) as { ok: boolean; description?: string };
  if (!body.ok) throw new Error(`sendMessage failed: ${body.description}`);
}

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.VITALIK_ALERT_CHAT;
  if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN and VITALIK_ALERT_CHAT are required');
  const isTest = process.argv.includes('--test');

  const res = await fetch(FEED_URL, { headers: { 'user-agent': 'eck-vitalik-alert/1.0' } });
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  const posts = parseFeed(await res.text(), 'vitalik')
    .map((p) => ({ ...p, url: normalizeUrl(p.url) }))
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  if (posts.length === 0) throw new Error('feed returned no entries');

  const seen = loadSeen();
  if (seen === null && !isTest) {
    saveSeen(new Set(posts.map((p) => p.url)));
    console.log(`First run: recorded ${posts.length} existing posts, nothing sent.`);
    return;
  }

  // 첫 실행이 --test여도 기존 글 전체를 기록해 이후 크론의 과거 글 폭탄을 방지
  const seenSet = seen ?? new Set<string>(posts.map((p) => p.url));
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
    const header = `비탈릭 새 글 해설${isTest ? ' (테스트)' : ''}\n${post.title}`;
    const parts = chunk(`${header}\n\n${analysis}\n\n${post.url}`);
    // 링크가 마지막에 오므로 링크 미리보기는 마지막 메시지에서만 허용
    for (let i = 0; i < parts.length; i++) {
      await sendDm(token, chatId, parts[i], i === parts.length - 1);
    }
    seenSet.add(post.url);
    saveSeen(seenSet);
    console.log(`Sent ${parts.length} message(s) to ${chatId}.`);
  }
}

main().catch((error) => {
  console.warn('[WARN] vitalik-blog-alert failed:', error instanceof Error ? error.message : error);
  process.exit(0); // 크론에서 조용히 재시도
});
