/**
 * 기자 그룹방용 주간 브리프 — 그 주(월~일 KST) 텔레그램 채널(@thetickeriseth)에 올라온 메시지 전부를 모아
 * 헤드리스 claude로 한 주 흐름을 주제별로 정리한 심층 요약을 쓰고, im-not-ai 룰북(scripts/assets/humanize-quick-rules.md)으로 윤문한 뒤 텔레그램 그룹에 보낸다(최대 2통). 일요일 저녁 크론(run-eth-digest.sh weekly).
 * 보낸 호는 src/data/weekly-briefs.json에 남겨 같은 주를 두 번 보내지 않는다.
 *
 * env: TELEGRAM_BOT_TOKEN · WEEKLY_CHAT(그룹 chat id, -100…) · WEEKLY_MODEL(기본 opus)
 *      WEEKLY_SOURCE_CHANNEL(읽을 채널, 기본 thetickeriseth)
 *      WEEKLY_PREVIEW_CHAT(검수용 DM chat id: 여기로 보내고 송출 기록은 남기지 않음)
 *      WEEKLY_END=YYYY-MM-DD(구간 마지막 날, 기본 오늘 KST) · WEEKLY_DRY_RUN=1(생성해서 출력만, 송출·저장 없음)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { runClaude } from './lib/claude';
import { humanizeTexts, normalizeTerms } from './lib/humanize';
import { decodeEntities, parseChannelPage, type ChannelPost } from './lib/linkedin-caption';
import {
  BriefSchema,
  extractUrls,
  fitMessages,
  keepKnownSources,
  kstDate,
  weekPosts,
  weekWindow,
  type Brief,
} from './lib/weekly-brief';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATA = path.resolve(process.cwd(), 'src/data');
const OUTPUT = path.join(DATA, 'weekly-briefs.json');
const MODEL = process.env.WEEKLY_MODEL ?? 'opus';
const CHANNEL = process.env.WEEKLY_SOURCE_CHANNEL ?? 'thetickeriseth';

type Sent = { start: string; end: string; sentAt: string; messageIds: number[]; brief: unknown };

const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const promptFor = (w: { start: string; end: string }) => `당신은 ECK(Ethereum Collective Korea)의 보도 지원 에디터입니다.
아래는 ${w.start}~${w.end} 한 주 동안 ECK 텔레그램 채널(The Ticker is ETH)에 올라온 메시지 전부입니다. 다이제스트, 코어 개발자 콜 정리, 논쟁, 짧은 글 등이 섞여 있습니다.
이것으로 기자에게 보내는 「주간 심층 요약」을 씁니다. 한 사건만 다루지 말고, 한 주 동안 채널에서 다룬 흐름 전체를 주제별로 정리합니다. 독자는 이더리움 전문가가 아닌 기자입니다.

원칙:
- 문장은 "~습니다". 메시지에 있는 사실만 씁니다. 수치, EIP 번호, 날짜, 고유명사는 메시지 그대로. 없는 사실, 전망, 평가는 만들지 않습니다.
- 발언 인용(따옴표)은 메시지에 그 사람의 말로 나온 것만.
- 여러 날 이어진 같은 이야기(예: 한 업그레이드를 둘러싼 콜과 논쟁)는 하나의 주제로 묶어 날짜 순서대로 흐름을 보여 줍니다.
- 중요도 순으로 주제를 씁니다. 주제 수는 내용에 맞게: 소식이 적은 주는 3~4개, 많은 주는 8개까지. 큰 주제는 3~5문장, 작은 주제는 1~2문장. 채널에서 다룬 소식을 빠뜨리지 않습니다.
- 전문 용어는 처음 나올 때 쉬운 말로 풉니다. 가격·시세는 싣지 않습니다. 대시(—)와 이모지 금지. 번역투 금지.
- 인명은 통용 한글 표기가 확실할 때만 한글, 아니면 영문. 첫 등장에 소속.
- 주제마다 근거 메시지 링크(https://t.me/${CHANNEL}/번호)를 1~3개 달고, 메시지 안의 ECK 사이트 링크가 있으면 하나 더 답니다. url은 입력에 나온 것만.

구성:
- title: 이번 주를 한 줄로 (사실형)
- overview: 이번 주 흐름 2~3문장
- topics: [{ heading: 주제 제목(사실형, 25자 안쪽), text: 본문, sources: [{label, url}] }]
- upcoming: 메시지에 나온 다음 주 이후 일정 "MM.DD 내용" (없으면 빈 배열)
- 전체 공백 포함 7,000자 안쪽 (텔레그램 메시지 2통).

JSON 객체 하나만 출력합니다:
{"title":"","overview":"","topics":[{"heading":"","text":"","sources":[{"label":"","url":""}]}],"upcoming":[""]}`;

/** im-not-ai 룰북으로 문장만 윤문한다. 출처·날짜·구조는 그대로 */
function humanize(brief: Brief): Brief {
  const texts = [brief.title, brief.overview, ...brief.topics.flatMap((t) => [t.heading, t.text]), ...brief.upcoming];
  const out = humanizeTexts(texts, '기자에게 보내는 주간 심층 요약("~습니다" 존댓말)', (p) => runClaude(p, MODEL));
  let k = 2;
  return {
    title: out[0],
    overview: out[1],
    topics: brief.topics.map((t) => ({ ...t, heading: out[k++], text: out[k++] })),
    upcoming: brief.upcoming.map(() => out[k++]),
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in response');
  return JSON.parse(trimmed.slice(start, end + 1));
}

/** 링크는 "텍스트 (url)" 로 남기는 채널 글 HTML → 평문 */
const toText = (html: string): string =>
  decodeEntities(
    html
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_m, h: string, t: string) => `${t.replace(/<[^>]+>/g, '')} (${h})`)
      .replace(/<[^>]+>/g, ''),
  ).trim();

/** 채널 웹 뷰를 ?before= 로 거슬러 올라가며 구간 글을 모아 입력 텍스트와 그 안의 URL 목록을 만든다. t.me 실패는 throw */
async function collectInput(w: { start: string; end: string }): Promise<{ input: string; urls: Set<string>; count: number }> {
  const all = new Map<number, ChannelPost>();
  let before: number | undefined;
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`https://t.me/s/${CHANNEL}${before ? `?before=${before}` : ''}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!r.ok) throw new Error(`t.me/s/${CHANNEL} responded ${r.status}`);
    const page = parseChannelPage(await r.text(), CHANNEL);
    if (!page.length) break;
    for (const p of page) all.set(p.id, p);
    before = page[0].id;
    if (page[0].date && kstDate(page[0].date) < w.start) break;
  }
  const posts = weekPosts([...all.values()], w);
  const input = posts
    .map((p) => `### 메시지 #${p.id} (${kstDate(p.date)}${p.replyTo ? `, #${p.replyTo}에 대한 답글` : ''}) https://t.me/${CHANNEL}/${p.id}\n${toText(p.html) || '(사진·영상만)'}`)
    .join('\n\n');
  return { input, urls: new Set(extractUrls(input)), count: posts.length };
}

async function send(token: string, chatId: string, text: string): Promise<number> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const body = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
  if (!body.ok || !body.result) throw new Error(`sendMessage failed: ${body.description ?? res.status}`);
  return body.result.message_id;
}

async function main() {
  const dryRun = Boolean(process.env.WEEKLY_DRY_RUN);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const previewChat = process.env.WEEKLY_PREVIEW_CHAT;
  const chatId = previewChat ?? process.env.WEEKLY_CHAT;
  if (!dryRun && (!token || !chatId)) {
    console.log('[SKIP] TELEGRAM_BOT_TOKEN or WEEKLY_CHAT not set — weekly brief skipped');
    return;
  }

  const w = weekWindow(process.env.WEEKLY_END ?? todayKst());
  const sent: Sent[] = fs.existsSync(OUTPUT) ? (JSON.parse(fs.readFileSync(OUTPUT, 'utf-8')) as { briefs: Sent[] }).briefs : [];
  if (!dryRun && !previewChat && sent.some((s) => s.start === w.start)) {
    console.log(`[SKIP] weekly brief ${w.start} ~ ${w.end} already sent`);
    return;
  }

  const { input, urls, count } = await collectInput(w);
  if (!count) {
    console.log(`[SKIP] no channel posts in ${w.start} ~ ${w.end}`);
    return;
  }
  console.log(`채널 글 ${count}건, 입력 ${input.length}자`);
  const raw = runClaude(`${promptFor(w)}\n\n# 채널 메시지\n\n${input}`, MODEL);
  const { brief: draft, dropped } = keepKnownSources(BriefSchema.parse(extractJson(raw)), urls);
  for (const url of dropped) console.warn(`[WARN] 입력에 없는 출처 링크를 뺐습니다: ${url}`);

  const { brief, messages, dropped: cut } = fitMessages(normalizeTerms(humanize(draft)), w, 2);
  for (const heading of cut) console.warn(`[WARN] 2통에 맞추려고 뺀 주제: ${heading}`);
  if (dryRun) {
    console.log(messages.map((m) => `[${m.length}자]\n${m}`).join('\n\n----- (다음 메시지) -----\n\n'));
    console.log(`\n메시지 ${messages.length}통: ${messages.map((m) => m.length).join(', ')}자`);
    return;
  }

  const messageIds: number[] = [];
  for (const text of messages) messageIds.push(await send(token!, chatId!, text));
  if (previewChat) {
    console.log(`Preview sent to ${previewChat} (${messageIds.join(', ')})`);
    return;
  }
  const record: Sent = { ...w, sentAt: new Date().toISOString(), messageIds, brief };
  fs.writeFileSync(OUTPUT, JSON.stringify({ briefs: [record, ...sent].slice(0, 52) }, null, 2), 'utf-8');
  console.log(`Sent weekly brief ${w.start} ~ ${w.end} to ${chatId} (${messageIds.join(', ')})`);
}

main().catch((error) => {
  console.warn('[WARN] post-weekly-brief failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
