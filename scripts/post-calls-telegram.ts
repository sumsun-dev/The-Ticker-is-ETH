/**
 * 코어 개발자 콜 브리프를 텔레그램으로 — src/data/eth-calls.json의 레코드에서 커버·캡션·발언 정리를 만들어 보낸다 (LLM 호출 없음).
 * 레코드는 extract-eth-calls.ts가 만들므로 사이트(/calls)와 메시지 내용이 같다. 콜 하나 = 사진(커버+결정 브리프) + 답글(누가 무슨 말을 했나).
 *
 * env: TELEGRAM_BOT_TOKEN · CALLS_CHAT(받을 chat id, 필수) · CALLS(콜 id 쉼표 목록, 예 acde-244,acdc-186; 없으면 최근 14일 정리된 콜 중 CALLS_POST_SINCE 이후이고 아직 안 올린 것(telegramMessageId 없음) 최대 3개, 올린 뒤 id 기록)
 *      CALLS_DRY_RUN=1(캡션 출력·커버 렌더만) · CALLS_REPLY_TO=<message_id>(이미 보낸 브리프에 발언 정리만 답글로)
 */
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { CALL_SERIES, callLabel, coverSpecOf, fitCaption, plainLength, renderDiscussionParts, type CallRecord, type CallStatus, type CallsFile } from './lib/eth-calls';
import { coverAssets, renderHtml, type CoverAssets } from './lib/cover';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const FILE = path.resolve(process.cwd(), 'src/data/eth-calls.json');
const OUT_DIR = path.resolve(process.cwd(), '.cache/call-covers');

const TAG_COLOR: Record<CallStatus, string> = {
  SFI: '#62D2A2',
  CFI: '#629FFF',
  PFI: '#C9A0FF',
  DFI: '#8A90A3',
  보류: '#F0B24A',
  확정: '#5EEAD4',
  일정: '#5EEAD4',
  기타: '#8A90A3',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 콜 전용 커버: 다크 배경, 시리즈 필 + 회차 워터마크, 두 줄 헤드라인, 리드, 결정 칩 */
function callCoverHtml(call: CallRecord, assets: CoverAssets): string {
  const spec = coverSpecOf(call);
  const series = CALL_SERIES[call.series] ?? { pill: call.series.toUpperCase(), name: 'Core Dev Call' };
  const date = call.date.replace(/-/g, '.');
  const lines = spec.headline.split(/\\n|\n/).map((l) => l.trim()).filter(Boolean);
  const tags = spec.tags.map((t) => `<span class="tag"><i style="background:${TAG_COLOR[t.status]}"></i>${esc(t.label)}<b>${esc(t.status)}</b></span>`).join('');
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
    <div class="num">#${call.number}</div>
    <div class="wrap">
      <div class="head"><span class="pill">${esc(series.pill)}</span><span class="series">${esc(series.name)}</span><span class="date">${esc(date)}</span></div>
      <div class="body">
        <div class="title">${lines.map((l, i) => `<span class="tline${i === 0 && lines.length > 1 ? ' hl' : ''}">${esc(l)}</span>`).join('')}</div>
        ${spec.lead ? `<div class="lead">${esc(spec.lead)}</div>` : ''}
        <div class="tags">${tags}</div>
      </div>
      <div class="foot"><div class="brand"><img src="${assets.logoDataUri}" alt="" /><span>ECK<b>Core Dev Call Brief</b></span></div><span class="src">forkcast.org · ethcollective.xyz/calls</span></div>
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

async function telegram(token: string, method: string, body: FormData | Record<string, unknown>): Promise<number | undefined> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    ...(body instanceof FormData ? { body } : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const json = (await res.json()) as { ok?: boolean; description?: string; result?: { message_id?: number } };
  if (!json.ok) throw new Error(`telegram ${res.status}: ${json.description ?? 'unknown error'}`);
  return json.result?.message_id;
}

/** 채널 브리프 시작일. 자동 실행은 이 날짜 이후 콜만 올린다 (첫 채널 브리프 ACDT #95, 2026-09-09 게시) */
const CALLS_POST_SINCE = process.env.CALLS_POST_SINCE ?? '2026-09-07';

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.CALLS_CHAT;
  const dryRun = Boolean(process.env.CALLS_DRY_RUN);
  if (!dryRun && (!token || !chat)) {
    console.log('[SKIP] TELEGRAM_BOT_TOKEN and CALLS_CHAT are required (or set CALLS_DRY_RUN=1)');
    return;
  }
  const file = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as CallsFile;
  const wanted = process.env.CALLS?.split(',').map((s) => s.trim()).filter(Boolean);
  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  // 자동 실행(CALLS 없음): 채널 브리프를 시작한 날 이후의 콜 중 아직 안 올린 것만. 그 전 콜은 사이트에만 둔다
  const pool = wanted
    ? wanted.map((id) => file.calls.find((c) => c.id === id)).filter((c): c is CallRecord => Boolean(c))
    : file.calls.filter((c) => c.date >= cutoff && c.date >= CALLS_POST_SINCE && !c.telegramMessageId).slice(0, 3);
  // 오래된 콜부터 보내 시간순으로 읽히게
  const selected = pool.filter((c) => c.kind === 'full').sort((a, b) => a.date.localeCompare(b.date));
  if (selected.length === 0) {
    console.log('[SKIP] no summarized calls selected (run extract-eth-calls.ts first)');
    return;
  }
  const assets = coverAssets();
  const replyTo = process.env.CALLS_REPLY_TO ? Number(process.env.CALLS_REPLY_TO) : undefined;

  for (const call of selected) {
    const discussion = call.topics.length > 0 ? renderDiscussionParts(call) : [];
    // 사이트 링크는 브리프 맨 아래 한 번: 토론 메시지가 있으면 그 끝에, 없으면 캡션 끝에
    const caption = fitCaption(call, 1024, { link: discussion.length === 0 });
    const outFile = path.join(OUT_DIR, `${call.id}.png`);
    if (dryRun) {
      const rendered = await renderHtml(callCoverHtml(call, assets), outFile, fitCallCover);
      console.log(`\n${caption}\n[cover] ${rendered ? outFile : '(not rendered)'} · caption ${plainLength(caption)}자`);
      discussion.forEach((d, i) => console.log(`\n---- discussion ${i + 1}/${discussion.length} (${plainLength(d)}자)\n${d}`));
      continue;
    }
    if (replyTo) {
      if (discussion.length === 0) throw new Error(`${call.id}: no discussion to reply with`);
      for (const text of discussion) {
        const id = await telegram(token!, 'sendMessage', { chat_id: chat, parse_mode: 'HTML', text, disable_web_page_preview: true, reply_to_message_id: replyTo });
        console.log(`  sent discussion for ${callLabel(call)} (message ${id})`);
      }
      continue;
    }
    const rendered = await renderHtml(callCoverHtml(call, assets), outFile, fitCallCover);
    let photoId: number | undefined;
    if (rendered) {
      const form = new FormData();
      form.append('chat_id', chat!);
      form.append('parse_mode', 'HTML');
      form.append('photo', new Blob([fs.readFileSync(outFile)], { type: 'image/png' }), path.basename(outFile));
      form.append('caption', caption);
      photoId = await telegram(token!, 'sendPhoto', form);
    } else {
      photoId = await telegram(token!, 'sendMessage', { chat_id: chat, parse_mode: 'HTML', text: caption, disable_web_page_preview: true });
    }
    console.log(`  sent ${callLabel(call)} (message ${photoId})`);
    if (photoId) {
      // 올린 콜은 기록해 다음 자동 실행에서 다시 올리지 않는다 (러너가 eth-calls.json을 커밋)
      file.calls = file.calls.map((c) => (c.id === call.id ? { ...c, telegramMessageId: photoId } : c));
      fs.writeFileSync(FILE, `${JSON.stringify(file, null, 2)}\n`);
    }
    for (const text of discussion) {
      const id = await telegram(token!, 'sendMessage', { chat_id: chat, parse_mode: 'HTML', text, disable_web_page_preview: true, reply_to_message_id: photoId });
      console.log(`  sent discussion (message ${id})`);
    }
  }
}

main().catch((error) => {
  console.warn('[WARN] post-calls-telegram failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
