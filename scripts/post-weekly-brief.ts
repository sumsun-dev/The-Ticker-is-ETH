/**
 * 기자 그룹방용 주간 브리프 — 한 주(월~일) 동안 사이트에 올라온 다이제스트·코어 콜·논쟁·Short 글을 모아
 * 헤드리스 claude로 사실 위주 브리프를 쓰고, im-not-ai 룰북(scripts/assets/humanize-quick-rules.md)으로 윤문한 뒤 텔레그램 그룹에 보낸다. 일요일 저녁 크론(run-eth-digest.sh weekly).
 * 보낸 호는 src/data/weekly-briefs.json에 남겨 같은 주를 두 번 보내지 않는다.
 *
 * env: TELEGRAM_BOT_TOKEN · WEEKLY_CHAT(그룹 chat id, -100…) · WEEKLY_MODEL(기본 fable)
 *      WEEKLY_PREVIEW_CHAT(검수용 DM chat id: 여기로 보내고 송출 기록은 남기지 않음)
 *      WEEKLY_END=YYYY-MM-DD(구간 마지막 날, 기본 오늘 KST) · WEEKLY_DRY_RUN=1(생성해서 출력만, 송출·저장 없음)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { runClaude } from './lib/claude';
import { humanizeTexts, normalizeTerms } from './lib/humanize';
import {
  BriefSchema,
  SITE,
  extractUrls,
  briefBlocks,
  fitOneMessage,
  inWindow,
  keepKnownSources,
  normDate,
  splitMessages,
  weekWindow,
  type Brief,
} from './lib/weekly-brief';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATA = path.resolve(process.cwd(), 'src/data');
const OUTPUT = path.join(DATA, 'weekly-briefs.json');
const MODEL = process.env.WEEKLY_MODEL ?? 'fable';
const ARTICLE_CHARS = 2500;

type Sent = { start: string; end: string; sentAt: string; messageIds: number[]; brief: Brief };

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf-8')) as T;
const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const PROMPT = `당신은 ECK(Ethereum Collective Korea)의 홍보 담당 에디터입니다.
아래는 이번 주(월~일) ECK 사이트에 올라온 콘텐츠입니다. 이것으로 기자들에게 보내는 주간 브리프를 작성하세요.
독자는 이더리움 전문가가 아닌 기자이고, 브리프 내용을 그대로 인용하거나 확인해 기사로 옮깁니다.

작성 원칙:
- 문장은 "~습니다", "~했습니다" 존댓말로 끝냅니다.
- 사실만 씁니다. 누가, 무엇을, 언제 했는지. 해석, 평가, 전망, 수사("구호에서 측정값으로" 같은 표현)는 쓰지 않습니다.
- 날짜를 꼭 적습니다. 시각이 입력에 있으면 UTC와 한국시간을 함께 씁니다.
- 수치, EIP 번호, 고유명사는 입력 그대로 둡니다. 입력에 없는 사실은 만들지 않습니다.
- 전문 용어는 처음 나올 때 쉬운 말로 풉니다 (예: CFI는 "검토 대상", 실행 지연은 "확정까지의 대기 시간").
- 인명은 통용되는 한글 표기가 확실할 때만 한글로, 아니면 영문 그대로 씁니다. 소속을 함께 적습니다 (예: 이더리움재단(EF) 연구원 저스틴 드레이크).
- 가격, 시세, 등락률은 싣지 않습니다.
- 대시(—) 구두점과 이모지는 쓰지 않습니다. 번역투("~를 통해", "~에 있어서", "결론적으로", "시사하는 바가 크다")를 피하고 짧고 평이한 문장으로 씁니다.
- 같은 사건이 다이제스트, 콜 요약, Short 글에 겹쳐 나오면 하나로 합칩니다.

구성:
- headline: 이번 주 가장 중요한 사실 1~2문장.
- sections: heading은 "프로토콜 · 코어 개발", "업계 동향", "커뮤니티 논쟁" 중 하나. 각각 최대 2개 항목, 중요한 순서대로. 해당 소식이 없으면 섹션을 뺍니다.
- 항목 하나에는 사건 하나만 담습니다. 서로 다른 회사나 프로젝트의 소식을 한 항목으로 묶지 않습니다.
- 항목: title은 사실형 제목, date는 사건 날짜 "MM.DD"(예: "10.06", 모르면 ""), summary는 2문장, 공백 포함 200자 안쪽. EIP 번호를 길게 나열하지 말고 핵심만 씁니다.
- sources는 항목당 최대 2개 (원문 1개 + ECK 해설 1개가 기본).
- sources: 원문(X, Forkcast, 공식 발표)을 먼저, ECK 해설 링크를 뒤에. label은 짧게 (예: "Forkcast 회의록", "ECK 해설", "@EthCoordinate"). url은 반드시 입력에 나온 URL만 씁니다.
- upcoming: 입력에 나온 다음 주 이후 일정만 "MM.DD 내용" 형태로. 없으면 빈 배열.
- 전체 분량은 공백 포함 2500자 안쪽. 텔레그램 메시지 하나에 들어가야 하므로 이 한도를 꼭 지킵니다.

JSON 객체 하나만 출력합니다:
{"headline": "...", "sections": [{"heading": "...", "items": [{"title": "...", "date": "...", "summary": "...", "sources": [{"label": "...", "url": "..."}]}]}], "upcoming": ["..."]}`;

/** im-not-ai 룰북으로 문장만 윤문한다. 출처·날짜·구조는 그대로 */
function humanize(brief: Brief): Brief {
  const items = brief.sections.flatMap((s) => s.items);
  const texts = [brief.headline, ...items.flatMap((i) => [i.title, i.summary]), ...brief.upcoming];
  const out = humanizeTexts(texts, '기자에게 보내는 보도자료형 주간 브리프("~습니다" 존댓말)', (p) => runClaude(p, MODEL));
  let k = 1;
  return {
    headline: out[0],
    sections: brief.sections.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, title: out[k++], summary: out[k++] })) })),
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

/** 이번 주 입력 텍스트와 그 안에 나온 URL 목록 */
function collectInput(w: { start: string; end: string }): { input: string; urls: Set<string> } {
  const parts: string[] = [];

  const { digests } = readJson<{ digests: { date: string; title: string; sections: { heading: string; items: { title: string; summary: string; url: string; source: string; date: string }[] }[] }[] }>('eth-digests.json');
  for (const d of digests.filter((d) => inWindow(d.date, w))) {
    parts.push(`## 다이제스트 ${d.date}: ${d.title}\nECK 해설: ${SITE}/news?date=${d.date}`);
    for (const s of d.sections) {
      for (const i of s.items) parts.push(`- [${s.heading}] ${i.title} (${i.date}, ${i.source})\n  ${i.summary}\n  원문: ${i.url}`);
    }
  }

  const { calls } = readJson<{ calls: { id: string; date: string; title: string; forkcastUrl?: string; summary?: string; intro?: string; decisions?: unknown; targets?: unknown }[] }>('eth-calls.json');
  for (const c of calls.filter((c) => inWindow(c.date, w))) {
    parts.push(
      `## 코어 개발자 콜 ${c.date}: ${c.title}\n원문: ${c.forkcastUrl ?? ''}\nECK 해설: ${SITE}/calls/${c.id}\n${c.summary ?? c.intro ?? ''}\n결정: ${JSON.stringify(c.decisions ?? [])}\n일정: ${JSON.stringify(c.targets ?? [])}`,
    );
  }

  const { debates } = readJson<{ debates: { id: string; title: string; summary: string; lastActivity: string; rootUrl: string; publish?: boolean }[] }>('eth-debates.json');
  for (const d of debates.filter((d) => inWindow(d.lastActivity, w))) {
    // 사이트에 노출된 논쟁만 ECK 페이지 링크가 살아 있다
    const eck = d.publish ? `\nECK 해설: ${SITE}/debates/${d.id}` : '';
    parts.push(`## 논쟁 (최근 활동 ${d.lastActivity}): ${d.title}\n원문: ${d.rootUrl}${eck}\n${d.summary}`);
  }

  const research = readJson<{ id: string; title: string; author: string; date: string; category: string }[]>('research-index.json');
  for (const r of research.filter((r) => inWindow(r.date, w) && r.category !== 'Research')) {
    const file = path.join(DATA, 'articles', `${r.id}.md`);
    const body = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8').replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim() : '';
    if (body.length < 80) continue; // 이미지만 올린 글
    parts.push(`## Short ${normDate(r.date)} (${r.author}): ${r.title}\nECK 해설: ${SITE}/contents/${r.id}\n${body.slice(0, ARTICLE_CHARS)}`);
  }

  const input = parts.join('\n\n');
  return { input, urls: new Set(extractUrls(input)) };
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

  const { input, urls } = collectInput(w);
  if (!input) {
    console.log(`[SKIP] no content in ${w.start} ~ ${w.end}`);
    return;
  }
  const raw = runClaude(`${PROMPT}\n\n# 이번 주 콘텐츠 (${w.start} ~ ${w.end})\n\n${input}`, MODEL);
  const { brief: draft, dropped } = keepKnownSources(BriefSchema.parse(extractJson(raw)), urls);
  for (const url of dropped) console.warn(`[WARN] 입력에 없는 출처 링크를 뺐습니다: ${url}`);

  const { brief, dropped: cut } = fitOneMessage(normalizeTerms(humanize(draft)), w);
  for (const title of cut) console.warn(`[WARN] 한 메시지에 맞추려고 뺀 항목: ${title}`);
  // fitOneMessage로 대개 한 개. 일정·핵심만으로도 넘치는 드문 경우를 위한 안전장치
  const messages = splitMessages(briefBlocks(brief, w));
  if (dryRun) {
    console.log(messages.join('\n\n----- (다음 메시지) -----\n\n'));
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
