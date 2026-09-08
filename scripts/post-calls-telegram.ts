/**
 * 코어 개발자 콜 브리프를 텔레그램으로 — 콜 하나에 커버 이미지 한 장과 캡션 한 개 (sendPhoto).
 * Forkcast 기록(feed.xml → GitHub 아티팩트)을 받아 헤드리스 claude가 콜마다 헤드라인·리드·결정 칩·캡션을 쓰고,
 * 콜 전용 커버 템플릿(다크, 사이트 브랜드 톤)으로 렌더한 뒤 보낸다.
 *
 * env: TELEGRAM_BOT_TOKEN · CALLS_CHAT(받을 chat id, 필수) · CALLS(콜 id 쉼표 목록, 예 acde-244,acdc-186; 없으면 최근 14일 결정 있는 콜 최대 5개)
 *      CALLS_MODEL(기본 fable) · CALLS_DRY_RUN=1(캡션 출력·커버 렌더만, 발송 안 함)
 *      CALLS_REUSE=1(직전 드라이런의 브리프 JSON(.cache/call-covers/<id>.json)을 다시 써서, 검토한 캡션 그대로 발송)
 *      CALLS_REPLY_TO=<message_id>(이미 보낸 브리프 메시지에 발언 정리만 답글로 붙인다. 커버·캡션은 다시 보내지 않음)
 *
 * 메시지는 콜당 두 개: (1) 커버 + 결정 브리프 캡션, (2) 자막(transcript)·노트·채팅을 읽고 쓴 "누가 무슨 말을 했나" 답글.
 */
import { execFileSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { forkcastArtifactBase, forkcastToItem, parseForkcastFeed, type NewsItem } from './lib/eth-news';
import { extractJson } from './lib/eth-debates';
import { coverAssets, renderHtml, type CoverAssets } from './lib/cover';
import callSpeakers from '../src/data/call-speakers.json';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MODEL = process.env.CALLS_MODEL ?? 'fable';
const OUT_DIR = path.resolve(process.cwd(), '.cache/call-covers');
const USER_AGENT = 'eck-news-bot/1.0 (+https://ethcollective.xyz)';
const CAPTION_MAX = 1024; // 텔레그램 sendPhoto caption 상한 (엔티티 파싱 후 기준)

const SERIES: Record<string, { pill: string; name: string }> = {
  acde: { pill: 'ACDE', name: 'All Core Devs · Execution' },
  acdc: { pill: 'ACDC', name: 'All Core Devs · Consensus' },
  acdt: { pill: 'ACDT', name: 'All Core Devs · Testing' },
};

const TAG_STATUS = ['SFI', 'CFI', 'DFI', '보류', '일정'] as const;
const TAG_COLOR: Record<(typeof TAG_STATUS)[number], string> = {
  SFI: '#62D2A2',
  CFI: '#629FFF',
  DFI: '#8A90A3',
  보류: '#F0B24A',
  일정: '#C9A0FF',
};

const BriefSchema = z.object({
  headline: z.string().min(2).max(40),
  lead: z.string().min(4).max(60),
  tags: z
    .array(z.object({ label: z.string().min(2).max(24), status: z.enum(TAG_STATUS) }))
    .min(1)
    .transform((a) => a.slice(0, 4)),
  caption: z.string().min(100).max(1600),
  /** 두 번째 메시지(발언 정리). 자막이 없으면 비어 있다 */
  discussion: z.string().optional(),
});
type Brief = z.infer<typeof BriefSchema>;
const DiscussionSchema = z.object({ text: z.string().min(200).max(6000) });
const MESSAGE_MAX = 4096; // 텔레그램 sendMessage text 상한

/** 자막 표기 → 실명·소속. src/data/call-speakers.json이 원본(확인된 소속만). 목록에 없으면 모델이 소속을 적지 않는다 */
const SPEAKERS: Record<string, string> = Object.fromEntries(
  Object.entries(callSpeakers.speakers as Record<string, { name: string; org?: string; role?: string; handle?: string }>).map(([label, s]) => {
    const org = [s.org, s.role].filter(Boolean).join(', ');
    return [label, org ? `${s.name} (${org})` : s.name];
  }),
);

const PROMPT = `당신은 ECK(Ethereum Collective Korea)의 리서치 에디터입니다. 아래는 Forkcast(EF Protocol Support)가 기록한 이더리움 코어 개발자 콜 하나의 공식 기록입니다. 프로토콜 개발을 매주 따라가지는 않는 한국어 독자가 3분 안에 "무엇이 결정됐고 왜 중요한지"를 이해하도록 텔레그램 브리프를 쓰세요.

출력은 JSON 하나만: {"headline": "...", "lead": "...", "tags": [{"label": "...", "status": "..."}], "caption": "..."}

- headline: 커버 헤드라인. 이 콜에서 가장 중요한 결정 하나를 두 줄로, 줄바꿈은 \\n. 각 줄 공백 포함 12자 이내. 콜 이름과 날짜는 넣지 않는다. 예: "EIP-8141 프레임\\n헤고타 포함 확정"
- lead: 헤드라인 아래 한 문장, 40자 이내. 그 결정이 무엇을 뜻하는지 쉬운 말로.
- tags: 커버 하단 결정 칩 3~4개, 중요한 순. label은 "EIP-번호 짧은이름" 꼴로 16자 이내. status는 기록의 결과에 맞춰 하나만: SFI(포함 확정) | CFI(포함 검토) | DFI(후보에서 제외, dropped·not taken up·declined) | 보류(다음 포크로 미룸, deferred) | 일정(날짜 칩, label은 "세폴리아 9/28"처럼).
- caption: 텔레그램 HTML(<b>, <a>만 사용). 엔티티를 뺀 본문 950자 이내. 아래 틀을 그대로 따른다. 빈 줄은 한 줄만.

<b>{콜 약칭} #{번호} · {M월 D일}</b>
{이 콜이 어떤 모임인지 한 줄}

<b>한 줄 요약</b>
{가장 중요한 결정과 그 의미를 한 문장}

<b>결정된 것</b>
· {EIP 번호와 짧은 이름}: {무엇이 결정됐는지 한 문장}. {그게 무슨 뜻인지 쉬운 말 한 문장}
(3~4개, 중요한 순)

<b>일정</b>
· {날짜와 이벤트. 확정인지 제안인지 구분}

<b>왜 중요한가</b>
{2문장 이내. 사용자·개발자·L2에 어떤 변화를 뜻하는지}

<b>용어</b> {이 캡션에 쓰인 약어와 이름 2~4개를 "용어: 뜻" 꼴로 " · "로 이어 한 줄로. 예: SFI: 포함 확정 · devnet: 개발용 테스트넷}

<a href="{콜 URL}">Forkcast 기록</a>{영상 URL이 있으면 " · " 뒤에 <a href="영상 URL">영상</a>}

규칙:
- 콜 약칭: ACDE는 실행 계층(EL) 클라이언트 개발자 격주 콜, ACDC는 합의 계층(CL) 콜, ACDT는 테스트 콜.
- EIP 번호·포크 이름·상태(SFI/CFI/DFI)·날짜·숫자는 원문 그대로. 기록에 없는 사실을 만들지 않는다.
- SFI는 "포함 확정(Scheduled for Inclusion)", CFI는 "포함 검토(Considered for Inclusion)", DFI는 "포함 제외(Declined for Inclusion)"로 처음 한 번 풀어 쓴다.
- 포크 이름은 한국어 표기 뒤에 원어 병기: 글램스터담(Glamsterdam), 헤고타(Hegota). 두 번째부터는 한국어만.
- 전문 용어는 처음 나올 때 통용 한국어에 원어 병기. 예: 히스토리 만료(history expiry), 프레임(Frames), 챔피언(champion, 제안을 책임지고 밀어붙이는 담당자).
- 문체는 '~했다', '~된다'의 서술체(경어 아님). 대시(—)와 이모지, 마크다운 기호 금지.
- 해석은 '한 줄 요약'과 '왜 중요한가'에만 넣고, 나머지는 기록에 있는 사실만 쓴다.`;

function runClaude(prompt: string): string {
  const raw = execFileSync('claude', ['-p', prompt, '--output-format', 'json', '--model', MODEL], {
    encoding: 'utf-8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
    env: { ...process.env, CLAUDECODE: undefined },
  });
  const envelope = JSON.parse(raw) as { result?: string; is_error?: boolean };
  if (envelope.is_error || !envelope.result) throw new Error(`headless claude (${MODEL}) returned an error`);
  return envelope.result;
}

const plainLength = (html: string) => html.replace(/<[^>]+>/g, '').length;

function brief(item: NewsItem): Brief {
  const input = `${PROMPT}\n\n콜 기록:\n${item.summary}\nURL: ${item.url}`;
  let out = BriefSchema.parse(extractJson(runClaude(input)));
  if (plainLength(out.caption) > CAPTION_MAX) {
    console.log(`  caption ${plainLength(out.caption)}자, 줄여서 다시 씀`);
    out = BriefSchema.parse(extractJson(runClaude(`${input}\n\n직전 출력의 caption이 ${plainLength(out.caption)}자로 상한을 넘었다. 같은 틀을 지키되 본문을 900자 이내로 줄여라.`)));
    if (plainLength(out.caption) > CAPTION_MAX) throw new Error(`caption still too long (${plainLength(out.caption)})`);
  }
  return out;
}

const DISCUSSION_PROMPT = `당신은 ECK(Ethereum Collective Korea)의 리서치 에디터입니다. 아래는 이더리움 코어 개발자 콜 하나의 발화자별 자막(transcript), 정리 노트, 채팅 로그입니다. 결정 사항 브리프는 이미 따로 보냈으니, 이 메시지는 "누가 어떤 입장에서 무슨 말을 했는지", 즉 논의의 흐름과 인물별 입장에 집중합니다. 한국어 독자가 콜을 안 듣고도 토론의 결을 이해하게 쓰세요.

출력은 JSON 하나만: {"text": "..."}
text는 텔레그램 HTML(<b>, <i>, <a>만 사용). 엔티티를 뺀 본문 3,300자 이내. 아래 틀을 따른다. 빈 줄은 한 줄만.

<b>{콜 약칭} #{번호} · 누가 무슨 말을 했나</b>
{실제로 의견이 오간 주제가 몇 개였고 가장 길게 다룬 주제가 무엇인지 한 문장}

<b>{주제}</b>
{이 주제가 무엇이고 왜 지금 논의됐는지 한 문장}
· <b>{이름}</b>{소속이 확실하면 " (소속)"}: {그 사람의 입장과 근거를 한두 문장으로. 누구 의견에 동의하거나 반박했는지 있으면 밝힌다}
· (그 주제에서 발언한 사람 2~5명)
<i>"{그 주제에서 가장 핵심적인 한 문장을 직역에 가깝게 번역}"</i> ({이름}, {hh:mm:ss})

(주제는 2~4개. 사회자의 진행 발언, 단순 상태 보고는 뺀다. 의견 차이나 새 정보가 있었던 주제만 고른다.)

<b>남은 것</b>
{누가 무엇을 맡기로 했고 다음 콜까지 무엇이 열려 있는지 한두 문장}

규칙:
- 이름은 자막 표기를 아래 목록의 실명으로 바꾼다. 소속은 아래 목록에 있거나 자막 표기·채팅에 명시된 경우("Chris - Base", "Iván | ethrex"처럼)에만 적는다. 그 밖에는 소속을 적지 않는다. 추측 금지.
- 자막에 없는 발언을 만들지 않는다. 인용은 자막 문장을 옮기되 말버릇(um, 반복)은 정리한다. 타임스탬프는 그 발언의 자막 시각.
- 자막에서 철자가 흔들리거나 음차로만 나오는 이름(예: Helkemin/Helcomind)은 쓰지 않고 역할로 대신한다(예: EIP-8360 제안자).
- EIP 번호, 숫자, 날짜는 원문 그대로. 전문 용어는 처음 한 번 통용 한국어에 원어 병기. 포크 이름은 글램스터담(Glamsterdam), 헤고타(Hegota).
- 문체는 '~했다', '~된다'의 서술체(경어 아님). 대시(—)와 이모지, 마크다운 기호 금지.

알려진 참가자:
${Object.entries(SPEAKERS)
  .map(([k, v]) => `- ${k} → ${v}`)
  .join('\n')}`;

/** VTT 자막 → "[hh:mm:ss] 이름: 발언" 줄. 같은 사람의 연속 큐는 한 줄로 합쳐 토큰을 아낀다 */
function compressVtt(vtt: string): string {
  const blocks: { t: string; who: string; text: string }[] = [];
  for (const cue of vtt.split(/\n\n+/)) {
    const m = /(\d{2}:\d{2}:\d{2})\.\d+ --> [^\n]+\n([\s\S]+)/.exec(cue);
    if (!m) continue;
    const line = m[2].replace(/\s*\n\s*/g, ' ').trim();
    const sp = /^([^:]{1,40}):\s*(.*)$/.exec(line);
    const who = sp ? sp[1].trim() : '?';
    const text = sp ? sp[2] : line;
    const last = blocks[blocks.length - 1];
    if (last && last.who === who) last.text = `${last.text} ${text}`;
    else blocks.push({ t: m[1], who, text });
  }
  return blocks.map((b) => `[${b.t}] ${b.who}: ${b.text}`).join('\n');
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

/** 자막·노트·채팅을 모아 발언 정리 입력을 만든다. 자막이 없으면 null */
async function discussionInput(base: string): Promise<string | null> {
  const vtt = (await fetchText(`${base}/transcript_corrected.vtt`)) ?? (await fetchText(`${base}/transcript.vtt`));
  if (!vtt) return null;
  const notes = (await fetchText(`${base}/notes.json`)) ?? '';
  const chat = ((await fetchText(`${base}/chat.txt`)) ?? '')
    .split('\n')
    .filter((l) => !/Reacted to|Removed a/.test(l) && l.length > 24)
    .slice(0, 150)
    .join('\n');
  return `정리 노트(JSON):\n${notes.slice(0, 20_000)}\n\n자막:\n${compressVtt(vtt).slice(0, 160_000)}\n\n채팅:\n${chat}`;
}

function discussion(item: NewsItem, input: string): string {
  const prompt = `${DISCUSSION_PROMPT}\n\n콜: ${item.title}\nURL: ${item.url}\n\n${input}`;
  let out = DiscussionSchema.parse(extractJson(runClaude(prompt))).text;
  if (plainLength(out) > MESSAGE_MAX) {
    console.log(`  discussion ${plainLength(out)}자, 줄여서 다시 씀`);
    out = DiscussionSchema.parse(extractJson(runClaude(`${prompt}\n\n직전 출력의 text가 ${plainLength(out)}자로 상한을 넘었다. 같은 틀을 지키되 3,000자 이내로 줄여라.`))).text;
    if (plainLength(out) > MESSAGE_MAX) throw new Error(`discussion still too long (${plainLength(out)})`);
  }
  return out;
}

/** 주제 단락의 발언자 줄과 인용을 펼침형 인용(blockquote expandable)으로 묶어 접는다. 제목과 소개 한 줄만 보이고 나머지는 "더 보기". 두 번 적용해도 안전 */
function collapseTopics(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => {
      if (para.includes('<blockquote')) return para;
      const lines = para.split('\n');
      const i = lines.findIndex((l) => l.startsWith('· '));
      if (i < 1) return para;
      return [...lines.slice(0, i), `<blockquote expandable>${lines.slice(i).join('\n')}</blockquote>`].join('\n');
    })
    .join('\n\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 콜 전용 커버: 다크 배경, 시리즈 필 + 회차 워터마크, 두 줄 헤드라인, 리드, 결정 칩 */
function callCoverHtml(item: NewsItem, b: Brief, assets: CoverAssets): string {
  const [, seriesKey = '', num = ''] = /^forkcast:([a-z]+)-(\d+)$/.exec(item.id) ?? [];
  const series = SERIES[seriesKey] ?? { pill: seriesKey.toUpperCase(), name: 'Core Dev Call' };
  const date = item.publishedAt.slice(0, 10).replace(/-/g, '.');
  const lines = b.headline.split(/\\n|\n/).map((l) => l.trim()).filter(Boolean);
  const tags = b.tags
    .map((t) => `<span class="tag"><i style="background:${TAG_COLOR[t.status]}"></i>${esc(t.label)}<b>${esc(t.status)}</b></span>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Pretendard'; src: url('${assets.fontDataUri}') format('woff2-variations'); font-weight: 45 920; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1200px; height: 630px; overflow: hidden; position: relative; background: #0A0A12; color: #F2F4FA;
      font-family: 'Pretendard', 'Noto Sans CJK KR', 'Apple SD Gothic Neo', sans-serif; }
    .glow { position: absolute; width: 1000px; height: 1000px; border-radius: 50%; right: -380px; top: -520px;
      background: radial-gradient(circle, rgba(45,95,191,.42) 0%, rgba(45,95,191,0) 62%); }
    .grid { position: absolute; inset: 0;
      background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
      background-size: 60px 60px; -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,.9), rgba(0,0,0,.15)); }
    .num { position: absolute; right: 48px; top: -34px; font-size: 320px; font-weight: 900; letter-spacing: -.06em; line-height: 1;
      color: rgba(255,255,255,.055); font-variant-numeric: tabular-nums; }
    .wrap { position: relative; height: 100%; padding: 50px 64px 0; display: flex; flex-direction: column; }
    .head { display: flex; align-items: center; gap: 16px; }
    .pill { background: #2D5FBF; color: #fff; font-weight: 800; font-size: 22px; letter-spacing: .08em; padding: 8px 14px; border-radius: 6px; }
    .series { font-size: 20px; color: #9AA3B8; letter-spacing: .06em; font-weight: 600; }
    .date { margin-left: auto; font-size: 20px; color: #9AA3B8; letter-spacing: .06em; font-variant-numeric: tabular-nums; }
    .body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding-right: 60px; }
    .title { font-size: 84px; font-weight: 850; line-height: 1.12; letter-spacing: -.03em; }
    .tline { display: block; white-space: nowrap; }
    .tline.hl { color: #629FFF; }
    .lead { margin-top: 20px; font-size: 27px; color: #B8C0D4; font-weight: 500; white-space: nowrap; }
    .tags { display: flex; gap: 12px; margin-top: 34px; white-space: nowrap; overflow: hidden; }
    .tag { display: inline-flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.05);
      border-radius: 999px; padding: 9px 18px 9px 14px; font-size: 21px; font-weight: 600; flex: none; }
    .tag i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .tag b { color: #9AA3B8; font-size: 16px; font-weight: 700; letter-spacing: .08em; margin-left: 4px; }
    .foot { position: relative; margin-top: auto; border-top: 1px solid rgba(255,255,255,.1); padding: 18px 0 26px; display: flex; align-items: center;
      font-size: 17px; color: #7A8499; letter-spacing: .04em; }
    .brand { display: flex; align-items: center; gap: 12px; color: #F2F4FA; font-weight: 700; }
    .brand img { width: 30px; height: 30px; }
    .brand span b { color: #7A8499; font-weight: 500; margin-left: 10px; }
    .src { margin-left: auto; }
  </style></head><body>
    <div class="glow"></div><div class="grid"></div>
    <div class="num">#${esc(num)}</div>
    <div class="wrap">
      <div class="head"><span class="pill">${esc(series.pill)}</span><span class="series">${esc(series.name)}</span><span class="date">${esc(date)}</span></div>
      <div class="body">
        <div class="title">${lines.map((l, i) => `<span class="tline${i === 0 && lines.length > 1 ? ' hl' : ''}">${esc(l)}</span>`).join('')}</div>
        <div class="lead">${esc(b.lead)}</div>
        <div class="tags">${tags}</div>
      </div>
      <div class="foot"><div class="brand"><img src="${assets.logoDataUri}" alt="" /><span>ECK<b>Core Dev Call Brief</b></span></div><span class="src">forkcast.org · ethcollective.xyz</span></div>
    </div>
  </body></html>`;
}

/** 브라우저 안에서 실행: 헤드라인·리드가 폭을 넘으면 줄이고, 칩은 넘치는 것부터 뗀다 */
function fitCallCover() {
  const box = document.querySelector('.title') as HTMLElement;
  const lines = Array.from(document.querySelectorAll('.tline')) as HTMLElement[];
  let size = 84;
  while (size > 44 && lines.some((l) => l.scrollWidth > l.clientWidth)) {
    size -= 2;
    box.style.fontSize = `${size}px`;
  }
  const lead = document.querySelector('.lead') as HTMLElement | null;
  let leadSize = 27;
  while (lead && leadSize > 18 && lead.scrollWidth > lead.clientWidth) {
    leadSize -= 1;
    lead.style.fontSize = `${leadSize}px`;
  }
  const tags = document.querySelector('.tags') as HTMLElement | null;
  while (tags && tags.children.length > 1 && tags.scrollWidth > tags.clientWidth) tags.lastElementChild?.remove();
}

async function fetchCalls(): Promise<{ item: NewsItem; base: string }[]> {
  const res = await fetch('https://forkcast.org/feed.xml', { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`forkcast feed HTTP ${res.status}`);
  const calls = parseForkcastFeed(await res.text());
  const getJson = async (url: string) => {
    try {
      const r = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
      return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const items: { item: NewsItem; base: string }[] = [];
  for (const call of calls) {
    const base = forkcastArtifactBase(call);
    const [tldr, decisions, config] = await Promise.all([getJson(`${base}/tldr.json`), getJson(`${base}/key_decisions.json`), getJson(`${base}/config.json`)]);
    items.push({ item: forkcastToItem(call, tldr, decisions, config), base });
  }
  return items;
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.CALLS_CHAT;
  const dryRun = Boolean(process.env.CALLS_DRY_RUN);
  if (!dryRun && (!token || !chat)) {
    console.log('[SKIP] TELEGRAM_BOT_TOKEN and CALLS_CHAT are required (or set CALLS_DRY_RUN=1)');
    return;
  }

  const all = await fetchCalls();
  const wanted = process.env.CALLS?.split(',').map((s) => s.trim()).filter(Boolean);
  const cutoff = Date.now() - 14 * 86_400_000;
  const selected = wanted
    ? wanted.map((id) => all.find((c) => c.item.id === `forkcast:${id}`)).filter((c): c is { item: NewsItem; base: string } => Boolean(c))
    : all.filter((c) => /핵심 결정/.test(c.item.title) && Date.parse(c.item.publishedAt) >= cutoff).slice(0, 5);
  if (selected.length === 0) {
    console.log('[SKIP] no calls selected');
    return;
  }
  // 오래된 콜부터 보내 시간순으로 읽히게
  selected.sort((a, b) => a.item.publishedAt.localeCompare(b.item.publishedAt));
  const assets = coverAssets();

  for (const { item, base } of selected) {
    console.log(`Briefing ${item.title} (${process.env.CALLS_REUSE ? 'cached' : MODEL})...`);
    const outFile = path.join(OUT_DIR, `${item.id.replace(/[^a-z0-9-]/gi, '_')}.png`);
    const briefFile = outFile.replace(/\.png$/, '.json');
    const cached = process.env.CALLS_REUSE && fs.existsSync(briefFile) ? BriefSchema.parse(JSON.parse(fs.readFileSync(briefFile, 'utf-8'))) : null;
    const base0 = cached ?? brief(item);
    let b: Brief = base0;
    if (!b.discussion) {
      const input = await discussionInput(base);
      if (input) {
        console.log(`  discussion from transcript (${MODEL})...`);
        b = { ...b, discussion: discussion(item, input) };
      } else console.log('  no transcript, discussion skipped');
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(briefFile, JSON.stringify(b, null, 2));
    const rendered = await renderHtml(callCoverHtml(item, b, assets), outFile, fitCallCover);
    if (dryRun) {
      console.log(`\n${b.caption}\n[cover] ${rendered ? outFile : '(not rendered)'} · caption ${plainLength(b.caption)}자`);
      if (b.discussion) console.log(`\n---- discussion (${plainLength(b.discussion)}자)\n${collapseTopics(b.discussion)}`);
      continue;
    }
    const replyTo = process.env.CALLS_REPLY_TO ? Number(process.env.CALLS_REPLY_TO) : undefined;
    if (replyTo) {
      if (!b.discussion) throw new Error('CALLS_REPLY_TO set but no discussion to send');
      await sendDiscussion(token!, chat!, b.discussion, replyTo);
      continue;
    }
    const form = new FormData();
    form.append('chat_id', chat!);
    form.append('parse_mode', 'HTML');
    if (rendered) {
      form.append('photo', new Blob([fs.readFileSync(outFile)], { type: 'image/png' }), path.basename(outFile));
      form.append('caption', b.caption);
    } else {
      form.append('text', b.caption);
      form.append('disable_web_page_preview', 'true');
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/${rendered ? 'sendPhoto' : 'sendMessage'}`, { method: 'POST', body: form });
    const body = (await res.json()) as { ok?: boolean; description?: string; result?: { message_id?: number } };
    if (!body.ok) throw new Error(`telegram ${res.status}: ${body.description ?? 'unknown error'}`);
    console.log(`  sent ${item.title} (message ${body.result?.message_id})`);
    if (b.discussion) await sendDiscussion(token!, chat!, b.discussion, body.result?.message_id);
  }
}

async function sendDiscussion(token: string, chat: string, text: string, replyTo?: number) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, parse_mode: 'HTML', text: collapseTopics(text), disable_web_page_preview: true, reply_to_message_id: replyTo }),
  });
  const body = (await res.json()) as { ok?: boolean; description?: string; result?: { message_id?: number } };
  if (!body.ok) throw new Error(`telegram ${res.status}: ${body.description ?? 'unknown error'}`);
  console.log(`  sent discussion (message ${body.result?.message_id})`);
}

main().catch((error) => {
  console.warn('[WARN] post-calls-telegram failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
