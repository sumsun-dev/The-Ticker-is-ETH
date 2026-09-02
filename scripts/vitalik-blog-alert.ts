/**
 * 비탈릭 블로그 새 글 감지 → 헤드리스 claude 상세 분석 → 오너 텔레그램 DM 발송.
 *
 * VPS 크론 매시 실행. 새 글이 없으면 RSS 확인만 하고 종료(claude 호출 없음).
 * 상태 파일로 기발송 글을 추적하며, 상태 파일이 없는 첫 실행은 현재 글 전체를
 * 발송 없이 기록만 한다(과거 글 폭탄 방지).
 *
 * Env: TELEGRAM_BOT_TOKEN (필수), VITALIK_ALERT_CHAT (필수 — DM chat id)
 * 실행: npx tsx scripts/vitalik-blog-alert.ts [--test]
 *   --test: 상태와 무관하게 최신 글 1건을 분석·발송 (상태에도 기록)
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
const CHUNK_LIMIT = 3_500; // 텔레그램 4096자 제한 아래 여유

const ANALYSIS_PROMPT = `당신은 ECK(Ethereum Collective Korea)의 시니어 리서치 에디터입니다.
비탈릭 부테린이 블로그에 새 글을 올렸습니다. 이더리움을 진지하게 따라가는 한국어 독자
(리서처·빌더)를 위해 이 글의 디테일한 분석을 작성하세요.

구성 (섹션 제목은 ▎로 시작, 섹션 사이 빈 줄):
▎세 줄 요약 — 글의 핵심을 세 문장으로
▎핵심 주장과 논리 — 글의 전개를 따라 주장·근거·제안을 상세히 정리 (가장 길게)
▎기술적 배경 — 이해에 필요한 개념, 선행 논의, 관련 EIP·업그레이드 연결
▎생태계 함의 — 무엇이 달라지는지, 누가 영향을 받는지
▎예상 쟁점 — 반론이 나올 지점과 논쟁 구도 예측

원칙:
- 원문 문장을 복사하지 않고 재작성합니다. 수치·용어는 정확하게, 핵심 용어는 원어 병기.
- 사실과 비탈릭의 주장을 구분하고, 과장·투자 조언 금지.
- 텔레그램 메시지로 발송되므로 마크다운 문법 없이 플레인 텍스트로만 씁니다.
- 전체 2500~4000자.

응답은 분석 본문만 출력하세요. 인사말·메타 설명 없이.

=== 글 제목 ===
{TITLE}

=== 본문 ===
{CONTENT}`;

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

function loadSeen(): Set<string> | null {
  try {
    return new Set(JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as string[]);
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
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  if (posts.length === 0) throw new Error('feed returned no entries');

  const seen = loadSeen();
  if (seen === null && !isTest) {
    saveSeen(new Set(posts.map((p) => p.url)));
    console.log(`First run: recorded ${posts.length} existing posts, nothing sent.`);
    return;
  }

  const seenSet = seen ?? new Set<string>();
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
    const header = `🟣 비탈릭 새 글 분석${isTest ? ' (테스트)' : ''}\n${post.title}\n${post.url}`;
    const parts = chunk(`${header}\n\n${analysis}`);
    for (let i = 0; i < parts.length; i++) {
      await sendDm(token, chatId, parts[i], i === 0);
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
