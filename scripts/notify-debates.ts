/**
 * 논쟁 DM 알림·승인 — 새 논쟁을 오너 DM으로 알리고, 버튼 응답을 받아 사이트 노출 여부를 반영한다.
 *
 * 흐름: 추출 직후(러너) 새 논쟁 DM 발송 → 오너가 [사이트에 노출]/[노출 안 함] 클릭
 *       → 5분 크론이 getUpdates로 받아 eth-debates.json의 publish에 기록하고 커밋·푸시 → 10분 내 배포.
 * 참여 10명 이상은 그대로 자동 노출이고, 버튼은 그 판단을 뒤집는 용도다 (2026-09-16 오너 결정).
 *
 * 실행: npx tsx scripts/notify-debates.ts [--commit] [--test]
 *   --commit: 변경이 있으면 커밋·푸시까지 (VPS 크론용)
 *   --test:   상태와 무관하게 최신 논쟁 1건을 발송
 * Env: TELEGRAM_BOT_TOKEN(필수) · DEBATES_ALERT_CHAT 또는 VITALIK_ALERT_CHAT(필수, 오너 DM chat id)
 *      DEBATES_ALERT_STATE(상태 파일 경로, 기본 ~/.eck-debate-alerts.json)
 * 상태 파일이 없는 첫 실행은 현재 논쟁 전체를 발송 없이 기록만 한다 (과거 논쟁 폭탄 방지).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { MIN_PARTICIPANTS, holderCount, isShown, parseDecision, setPublish, unnotified, type Debate, type DebatesFile } from './lib/eth-debates';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const FILE = path.resolve(process.cwd(), 'src/data/eth-debates.json');
const STATE_FILE = process.env.DEBATES_ALERT_STATE ?? path.join(os.homedir(), '.eck-debate-alerts.json');
const SITE = 'https://ethcollective.xyz';
/** 한 번에 보낼 최대 건수. 밀린 논쟁이 많아도 DM이 쏟아지지 않게 */
const MAX_PER_RUN = 5;

interface State {
  /** 이미 DM으로 알린 논쟁 id */
  notified: string[];
  /** getUpdates 오프셋 — 처리한 업데이트 재수신 방지 */
  offset: number;
}

interface CallbackQuery {
  id: string;
  data?: string;
  message?: { chat: { id: number }; message_id: number };
}

function readState(): State | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as Partial<State>;
  return { notified: raw.notified ?? [], offset: raw.offset ?? 0 };
}

const writeState = (state: State) => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 응답용 호출(answerCallbackQuery 등)은 실패해도 실행을 멈추지 않는다.
 *  버튼을 늦게 누르면 텔레그램이 'query is too old'로 거절하는데, 그 때문에 결정 반영과 offset 저장까지 날리면
 *  같은 업데이트를 영원히 다시 받는다 (2026-09-16 실측). */
async function tgQuiet(token: string, method: string, body: unknown): Promise<void> {
  try {
    await tg(token, method, body);
  } catch (error) {
    console.warn(`  [WARN] ${(error as Error).message}`);
  }
}

async function tg<T>(token: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`${method} failed: ${json.description ?? res.status}`);
  return json.result as T;
}

function messageOf(debate: Debate): string {
  const count = holderCount(debate);
  const lines = [
    '<b>새 논쟁</b>',
    `<b>${esc(debate.title)}</b>`,
    `${esc(debate.category)} · 참여 ${count}명 · ${debate.status}`,
    '',
    esc(debate.summary),
  ];
  if (debate.keyPoints[0]) lines.push('', `쟁점: ${esc(debate.keyPoints[0])}`);
  if (debate.rootUrl) lines.push('', `원문: ${debate.rootUrl}`);
  lines.push(
    '',
    isShown(debate)
      ? `참여 ${MIN_PARTICIPANTS}명 이상이라 사이트에 올라갑니다. ${SITE}/debates/${debate.id}`
      : `참여 ${MIN_PARTICIPANTS}명 미만이라 기본값은 비노출입니다.`,
  );
  return lines.join('\n');
}

/** 버튼. callback_data는 64바이트 제한이라 접두사를 짧게 쓴다 */
const keyboardOf = (debate: Debate) => ({
  inline_keyboard: [[
    { text: '사이트에 노출', callback_data: `p:${debate.id}` },
    { text: '노출 안 함', callback_data: `h:${debate.id}` },
  ]],
});

/** 버튼 응답을 모아 publish에 반영. 바뀐 논쟁 목록을 주고, 응답이 없으면 null */
async function applyCallbacks(token: string, state: State, debates: Debate[]): Promise<Debate[] | null> {
  const updates = await tg<Array<{ update_id: number; callback_query?: CallbackQuery }>>(token, 'getUpdates', {
    offset: state.offset,
    timeout: 0,
    allowed_updates: ['callback_query'],
  });
  let next: Debate[] | null = null;
  for (const update of updates) {
    state.offset = update.update_id + 1;
    const cb = update.callback_query;
    const decision = parseDecision(cb?.data);
    if (!cb || !decision) continue;
    const { id, publish } = decision;
    if (!(next ?? debates).some((d) => d.id === id)) {
      await tgQuiet(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: '없는 논쟁입니다' });
      continue;
    }
    next = setPublish(next ?? debates, id, publish);
    await tgQuiet(token, 'answerCallbackQuery', {
      callback_query_id: cb.id,
      text: publish ? '사이트에 노출합니다' : '노출하지 않습니다',
    });
    if (cb.message) {
      // 버튼을 지워 같은 논쟁을 두 번 누르지 않게 한다
      await tgQuiet(token, 'editMessageReplyMarkup', {
        chat_id: cb.message.chat.id,
        message_id: cb.message.message_id,
        reply_markup: { inline_keyboard: [] },
      });
    }
    console.log(`  ${id} → ${publish ? '노출' : '비노출'}`);
  }
  return next;
}

function commitAndPush(): void {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf-8' });
  git('add', 'src/data/eth-debates.json');
  if (!git('diff', '--cached', '--name-only').trim()) return;
  git('commit', '-m', 'chore: 논쟁 사이트 노출 승인 반영 [automated]');
  git('pull', '--rebase', '--autostash', 'origin', 'main');
  git('push', 'origin', 'main');
  console.log('  커밋·푸시 완료');
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.DEBATES_ALERT_CHAT ?? process.env.VITALIK_ALERT_CHAT;
  if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN and DEBATES_ALERT_CHAT (or VITALIK_ALERT_CHAT) are required');

  const file = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as DebatesFile;
  const test = process.argv.includes('--test');
  const state = readState();

  if (!state) {
    writeState({ notified: file.debates.map((d) => d.id), offset: 0 });
    console.log(`[INIT] ${file.debates.length}건을 발송 없이 기록했습니다 (${STATE_FILE})`);
    return;
  }

  const updated = await applyCallbacks(token, state, file.debates);
  // 발송 단계에서 실패해도 처리한 업데이트를 다시 받지 않도록 offset을 먼저 저장한다
  writeState(state);
  if (updated) {
    fs.writeFileSync(FILE, JSON.stringify({ ...file, debates: updated }, null, 2), 'utf-8');
    if (process.argv.includes('--commit')) commitAndPush();
  }

  const debates = updated ?? file.debates;
  const targets = test ? debates.slice(0, 1) : unnotified(debates, state.notified).slice(0, MAX_PER_RUN);
  for (const debate of targets) {
    await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: messageOf(debate),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: keyboardOf(debate),
    });
    if (!test) state.notified.push(debate.id);
    console.log(`  DM 발송: ${debate.id}`);
  }
  writeState(state);
  if (!targets.length) console.log('[SKIP] 새로 알릴 논쟁 없음');
}

main().catch((error) => {
  console.error(`[ERROR] notify-debates: ${(error as Error).message}`);
  process.exit(1);
});
