/**
 * 최신 다이제스트를 텔레그램 채널에 송출한다 (@ticker_data_bot, Bot API).
 * 이미 송출된 다이제스트(telegramMessageId 존재)는 스킵 — 멱등.
 *
 * Env: TELEGRAM_BOT_TOKEN (필수), TELEGRAM_CHANNEL (기본 thetickeriseth)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type { Digest } from './generate-eth-digest';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DIGESTS = path.resolve(process.cwd(), 'src/data/eth-digests.json');
const SITE_NEWS_URL = 'https://ethcollective.xyz/news';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 텔레그램 4096자 제한에 맞춘 컴팩트 포맷 (항목은 제목+링크만) */
function formatMessage(digest: Digest): string {
  const lines = [`<b>${esc(digest.title)}</b>`, '', esc(digest.intro)];
  for (const section of digest.sections) {
    lines.push('', `<b>${esc(section.heading)}</b>`);
    for (const item of section.items) {
      lines.push(`· <a href="${item.url}">${esc(item.title)}</a> — ${esc(item.source)}`);
    }
  }
  lines.push('', `전체 요약 보기 → ${SITE_NEWS_URL}`);
  return lines.join('\n').slice(0, 4096);
}

/** 캡션에 싣는 핵심 구분 (이 키워드가 포함된 섹션만) */
const CAPTION_SECTION_KEYWORDS = ['인사이트', '프로토콜', '포럼', '논쟁', '발언'];

/**
 * sendPhoto 캡션 (1024자 제한) — 제목/날짜 + 핵심 구분별 볼드 소제목·불렛 링크.
 * 인트로 없음 (전문은 사이트에서).
 */
function formatCaption(digest: Digest): string {
  const tail = `\n\n전체 요약 보기 → ${SITE_NEWS_URL}`;
  const budget = 1024 - tail.length;

  // 텔레그램 1024자 제한은 '보이는 텍스트' 기준 — HTML 태그는 별도로 계산한다
  let caption = `<b>${esc(digest.title)}</b>`;
  let visible = digest.title.length;

  const coreSections = digest.sections.filter((s) =>
    CAPTION_SECTION_KEYWORDS.some((k) => s.heading.includes(k)),
  );
  for (const section of coreSections) {
    const headerVisible = `\n\n${section.heading}`.length;
    const firstVisible = `\n· ${section.items[0].title}`.length;
    // 소제목 + 첫 항목이 들어갈 자리가 없으면 그 구분부터 생략
    if (visible + headerVisible + firstVisible > budget) break;
    caption += `\n\n<b>${esc(section.heading)}</b>`;
    visible += headerVisible;
    for (const item of section.items) {
      const lineVisible = `\n· ${item.title}`.length;
      if (visible + lineVisible > budget) break;
      caption += `\n· <a href="${item.url}">${esc(item.title)}</a>`;
      visible += lineVisible;
    }
  }
  return caption + tail;
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[SKIP] TELEGRAM_BOT_TOKEN not set — telegram post skipped');
    return;
  }
  const channel = process.env.TELEGRAM_CHANNEL ?? 'thetickeriseth';

  const data = JSON.parse(fs.readFileSync(DIGESTS, 'utf-8')) as { digests: Digest[] };
  const digest = data.digests[0];
  if (!digest) {
    console.log('[SKIP] no digest to post');
    return;
  }
  // DIGEST_PREVIEW_CHAT: 채널 대신 지정 chat으로 미리보기 전송 (검수 모드 — 채널 송출 여부와 무관)
  const previewChat = process.env.DIGEST_PREVIEW_CHAT;
  if (!previewChat && digest.telegramMessageId) {
    console.log(`[SKIP] digest ${digest.date} already posted (message ${digest.telegramMessageId})`);
    return;
  }
  if (previewChat && digest.previewedAt && !process.env.DIGEST_FORCE_PREVIEW) {
    console.log(`[SKIP] digest ${digest.date} already previewed at ${digest.previewedAt}`);
    return;
  }
  // TELEGRAM_CHANNEL: @username 또는 숫자 chat_id(-100... 비공개 채널/그룹) 모두 지원
  const chatId = previewChat ?? (/^-?\d+$/.test(channel) ? channel : `@${channel}`);

  // 커버 이미지가 있으면 sendPhoto(커버 + 캡션), 없으면 텍스트 메시지로 폴백
  const coverFile = digest.coverImage
    ? path.resolve(process.cwd(), 'public', digest.coverImage.split('?')[0].replace(/^\//, ''))
    : null;

  let res: Response;
  if (coverFile && fs.existsSync(coverFile)) {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', new Blob([fs.readFileSync(coverFile)], { type: 'image/png' }), `${digest.date}.png`);
    form.append('caption', formatCaption(digest));
    form.append('parse_mode', 'HTML');
    res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
  } else {
    res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatMessage(digest),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  }
  const body = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
  if (!body.ok || !body.result) {
    throw new Error(`sendMessage failed: ${body.description ?? res.status}`);
  }

  if (previewChat) {
    digest.previewedAt = new Date().toISOString();
    fs.writeFileSync(DIGESTS, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Preview sent to ${previewChat} (message ${body.result.message_id})`);
    return;
  }

  digest.telegramMessageId = body.result.message_id;
  fs.writeFileSync(DIGESTS, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Posted digest ${digest.date} to ${chatId} (message ${body.result.message_id})`);
}

main().catch((error) => {
  console.warn('[WARN] post-digest-telegram failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
