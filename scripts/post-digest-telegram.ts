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
  const lines = [
    `<b>${esc(digest.title)}</b>`,
    `${digest.date} · ECK 데일리 이더리움 다이제스트`,
    '',
    esc(digest.intro),
  ];
  for (const section of digest.sections) {
    lines.push('', `<b>${esc(section.heading)}</b>`);
    for (const item of section.items) {
      lines.push(`· <a href="${item.url}">${esc(item.title)}</a> — ${esc(item.source)}`);
    }
  }
  lines.push('', `전체 요약 보기 → ${SITE_NEWS_URL}`);
  return lines.join('\n').slice(0, 4096);
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
  if (digest.telegramMessageId) {
    console.log(`[SKIP] digest ${digest.date} already posted (message ${digest.telegramMessageId})`);
    return;
  }

  // DIGEST_PREVIEW_CHAT: 채널 대신 지정 chat으로 미리보기 전송 (송출 기록 안 함)
  const previewChat = process.env.DIGEST_PREVIEW_CHAT;
  const chatId = previewChat ?? `@${channel}`;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatMessage(digest),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const body = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
  if (!body.ok || !body.result) {
    throw new Error(`sendMessage failed: ${body.description ?? res.status}`);
  }

  if (previewChat) {
    console.log(`Preview sent to ${previewChat} (message ${body.result.message_id}) — not recorded`);
    return;
  }

  digest.telegramMessageId = body.result.message_id;
  fs.writeFileSync(DIGESTS, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Posted digest ${digest.date} to @${channel} (message ${body.result.message_id})`);
}

main().catch((error) => {
  console.warn('[WARN] post-digest-telegram failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
