/**
 * ECK LinkedIn 회사 페이지에 다이제스트 자동 게시 (맥 전용, launchd 30분 주기).
 *
 * 회사 명의 API 게시(w_organization_social)는 Community Management API 심사가 필요해, ai-secondbrain과 같은 방식으로
 * 로그인된 전용 크롬 프로필 + playwright로 페이지 관리자 화면에서 직접 올린다. 게시할 다이제스트는 GitHub main의
 * eth-digests.json(러너가 커밋)에서 고르고, 커버는 라이브 사이트에서 받는다. 게시한 날짜는 ~/.eck/linkedin-seen.json에 기록.
 *
 * Usage:
 *   npx tsx scripts/local/linkedin-digest-post.ts --login          # 1회: 전용 프로필에 LinkedIn 로그인 (일반 크롬 창)
 *   npx tsx scripts/local/linkedin-digest-post.ts --check          # 로그인·페이지 관리자 권한·컴포저 확인 (게시 안 함)
 *   npx tsx scripts/local/linkedin-digest-post.ts --dry            # 대상 감지·캡션·커버까지만
 *   npx tsx scripts/local/linkedin-digest-post.ts                  # 새 다이제스트 감지 → 게시
 *   npx tsx scripts/local/linkedin-digest-post.ts --date=2026-09-06  # 특정 호 강제 (seen 무시)
 * Env: LI_ORG (기본 110535025 = ECK 페이지 숫자 id. 관리자 URL은 vanity 이름으로 열리지 않는다) · LI_PROFILE_DIR (기본 ~/.eck/li-chrome, ai-secondbrain 프로필 ~/.ai-secondbrain/li-chrome 재사용 가능)
 *      LI_HEADLESS=1 · ECK_REPO (기본 sumsun-dev/The-Ticker-is-ETH) · TELEGRAM_BOT_TOKEN + LINKEDIN_ALERT_CHAT|VITALIK_ALERT_CHAT (알림 DM)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as dotenv from 'dotenv';
import { formatDigestCaption, pickDigestsToPost, type DigestLike } from '../lib/linkedin-caption';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

const SITE = 'https://ethcollective.xyz';
const REPO = process.env.ECK_REPO ?? 'sumsun-dev/The-Ticker-is-ETH';
const ORG = process.env.LI_ORG ?? '110535025';
const ADMIN_URL = `https://www.linkedin.com/company/${ORG}/admin/page-posts/published/`;
const HOME_DIR = join(homedir(), '.eck');
const PROFILE_DIR = process.env.LI_PROFILE_DIR ? process.env.LI_PROFILE_DIR.replace(/^~/, homedir()) : join(HOME_DIR, 'li-chrome');
/** 잠금은 프로필 디렉터리 옆에 둔다. ai-secondbrain 프로필을 같이 쓰면 그쪽 잠금(li-post.lock)과 같은 파일이 된다 */
const LOCK_DIR = join(dirname(PROFILE_DIR), 'li-post.lock');
const SEEN_FILE = join(HOME_DIR, 'linkedin-seen.json');

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const LOGIN = process.argv.includes('--login');
const CHECK = process.argv.includes('--check');
const DRY = process.argv.includes('--dry');
const HEADLESS = process.env.LI_HEADLESS === '1';
const log = (m: string) => process.stdout.write(`[eck-li] ${m}\n`);

/* ── 알림: 텔레그램 DM, 안 되면 macOS 알림센터 ────────────────────────── */
async function notify(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.LINKEDIN_ALERT_CHAT ?? process.env.VITALIK_ALERT_CHAT;
  if (token && chat) {
    const ok = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    })
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) return;
  }
  try {
    execFileSync('osascript', ['-e', `display notification ${JSON.stringify(text.slice(0, 200))} with title "ECK LinkedIn"`]);
  } catch {
    /* 알림센터 불가 */
  }
}

/* ── 데이터: GitHub main의 다이제스트, 라이브 커버 ─────────────────────── */
function fetchDigests(): DigestLike[] {
  const raw = execFileSync('gh', ['api', '-H', 'Accept: application/vnd.github.raw', `/repos/${REPO}/contents/src/data/eth-digests.json`], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  return (JSON.parse(raw) as { digests: Array<DigestLike & { coverImage?: string }> }).digests;
}

async function fetchCover(digest: DigestLike & { coverImage?: string }): Promise<string | null> {
  if (!digest.coverImage) return null;
  const res = await fetch(`${SITE}${digest.coverImage}`);
  if (!res.ok) return null;
  const dir = join(tmpdir(), `eck-li-${digest.date}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `cover-${digest.date}.png`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

const loadSeen = (): string[] => (existsSync(SEEN_FILE) ? (JSON.parse(readFileSync(SEEN_FILE, 'utf-8')) as string[]) : []);
function recordSeen(date: string) {
  mkdirSync(HOME_DIR, { recursive: true });
  writeFileSync(SEEN_FILE, JSON.stringify([...new Set([...loadSeen(), date])].sort(), null, 2));
}

/* ── 브라우저 ───────────────────────────────────────────────────────── */
/** 전용 프로필을 잡고 있는 크롬을 정리한다. 맥 크롬은 창을 닫아도 살아 있어 두 번째 실행이 기존 세션으로 넘어가며 자동화가 죽는다 */
async function killProfileChrome() {
  try {
    const pids = execFileSync('pgrep', ['-f', `user-data-dir=${PROFILE_DIR}`], { encoding: 'utf-8' }).split('\n').filter(Boolean);
    if (pids.length) {
      execFileSync('kill', pids);
      log(`전용 프로필 크롬 종료 (${pids.length}개)`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch {
    /* 실행 중 아님 */
  }
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) rmSync(join(PROFILE_DIR, f), { force: true });
}

async function launch(headless: boolean) {
  await killProfileChrome();
  const { chromium } = await import('playwright-core');
  return chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless,
    viewport: { width: 1280, height: 950 },
    locale: 'ko-KR',
    chromiumSandbox: true,
    // 실제 macOS 키체인으로 쿠키 복호화 — 일반 크롬 창에서 한 로그인과 세션 공유
    ignoreDefaultArgs: ['--enable-automation', '--use-mock-keychain'],
  });
}

// 관리자 > 페이지 게시물 화면의 셀렉터 (ai-secondbrain 2026-08-23 실측과 같음). 한/영 UI 모두 대응
const SHARE_BOX = '.share-box-feed-entry__closed-share-box';
const MODAL = '.share-box-v2__modal';
const RE_START = /사진 등록|Add a photo/i;
const RE_NEXT = /^\s*(다음|Next)\s*$/;
const POST_BTN = 'button.share-actions__primary-action';

async function postToLinkedIn(caption: string, image: string) {
  const ctx = await launch(HEADLESS);
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const start = page.locator(SHARE_BOX).getByRole('button', { name: RE_START }).first();
    await start.waitFor({ timeout: 30_000 }).catch(() => {
      throw new Error('게시 버튼 없음. 로그인이 풀렸거나 페이지 관리자가 아님 (--login 재실행)');
    });
    await start.click();

    const modal = page.locator(MODAL).first();
    await modal.waitFor({ timeout: 20_000 });
    const input = modal.locator('input[type=file]').first();
    await input.waitFor({ state: 'attached', timeout: 15_000 });
    await input.setInputFiles([image]);
    const next = modal.getByRole('button', { name: RE_NEXT }).first();
    await next.waitFor({ timeout: 120_000 });
    await page.waitForTimeout(1500);
    await next.click();

    // fill()은 Quill 상태에 안 잡혀 본문 없이 게시된다 → insertText로 정식 input 이벤트
    const editor = modal.locator('.ql-editor[contenteditable="true"]').first();
    await editor.waitFor({ timeout: 20_000 });
    await editor.click();
    await page.keyboard.insertText(caption);
    await page.waitForTimeout(1500);
    const post = modal.locator(POST_BTN).first();
    const handle = await post.elementHandle();
    await page.waitForFunction((el) => el && el.getAttribute('aria-disabled') !== 'true' && !(el as HTMLButtonElement).disabled, handle, { timeout: 60_000 });
    await post.click();

    await page
      .locator(MODAL)
      .waitFor({ state: 'detached', timeout: 60_000 })
      .catch(async () => {
        log('경고: 컴포저가 안 닫힘. 페이지에서 직접 확인 필요');
        await notify('LinkedIn ECK 페이지 게시 검증 실패. 페이지에서 확인해 주세요.');
      });
  } finally {
    await ctx.close();
  }
}

async function checkMode() {
  const ctx = await launch(HEADLESS);
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(3000);
    const start = page.locator(SHARE_BOX).getByRole('button', { name: RE_START }).first();
    const ok = await start.waitFor({ timeout: 20_000 }).then(() => true, () => false);
    const shot = join(tmpdir(), 'eck-li-check.png');
    await page.screenshot({ path: shot });
    log(ok ? '게시 버튼 확인. 로그인과 관리자 권한 정상' : '게시 버튼 없음. 로그인 또는 관리자 권한 확인 필요');
    log(`현재 URL: ${page.url()}\n스크린샷: ${shot}`);
    if (!ok) process.exitCode = 1;
  } finally {
    await ctx.close();
  }
}

function loginMode() {
  mkdirSync(PROFILE_DIR, { recursive: true });
  // 자동화 플래그가 붙은 창은 로그인 단계에서 막힐 수 있어, 로그인만은 일반 크롬 창을 전용 프로필로 띄운다
  execFileSync('open', ['-na', 'Google Chrome', '--args', `--user-data-dir=${PROFILE_DIR}`, '--no-first-run', 'https://www.linkedin.com/login']);
  log(`일반 크롬 창(전용 프로필 ${PROFILE_DIR})을 열었습니다. ECK 페이지 관리자 계정으로 로그인한 뒤 창을 닫으세요.`);
  log('이후 --check로 확인하고, launchd가 이 로그인으로 자동 게시합니다.');
}

function acquireLock(): boolean {
  mkdirSync(dirname(LOCK_DIR), { recursive: true });
  try {
    mkdirSync(LOCK_DIR);
    return true;
  } catch {
    try {
      if (Date.now() - statSync(LOCK_DIR).mtimeMs > 30 * 60_000) {
        rmSync(LOCK_DIR, { recursive: true, force: true });
        mkdirSync(LOCK_DIR);
        return true;
      }
    } catch {
      /* fallthrough */
    }
    return false;
  }
}

async function main() {
  if (LOGIN) return loginMode();
  if (CHECK) return checkMode();
  if (!acquireLock()) return log('다른 인스턴스 실행 중. skip');
  let current: string | null = null;
  try {
    const forced = arg('date');
    const digests = fetchDigests();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    const targets = forced ? digests.filter((d) => d.date === forced) : pickDigestsToPost(digests, loadSeen(), today);
    if (targets.length === 0) return log('게시할 새 다이제스트 없음');
    for (const digest of targets) {
      current = digest.date;
      const cover = await fetchCover(digest);
      if (!cover) {
        log(`${digest.date}: 커버가 아직 라이브에 없음. 다음 폴링까지 대기`);
        continue;
      }
      const caption = formatDigestCaption(digest, `${SITE}/news?date=${digest.date}`);
      log(`${digest.date}: 게시 시작${DRY ? ' (dry)' : ''} · 캡션 ${caption.length}자 · ${cover}`);
      if (DRY) {
        log(`\n${caption}\n`);
        continue;
      }
      await postToLinkedIn(caption, cover);
      recordSeen(digest.date);
      log(`${digest.date}: LinkedIn 게시 완료`);
      await notify(`LinkedIn ECK 페이지에 다이제스트 ${digest.date} 게시 완료\n${SITE}/news?date=${digest.date}`);
      rmSync(dirname(cover), { recursive: true, force: true });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`실패: ${msg}`);
    await notify(`LinkedIn ECK 페이지 게시 실패 (${current ?? '대상 미상'})\n${msg.slice(0, 300)}`);
    process.exitCode = 1;
  } finally {
    rmSync(LOCK_DIR, { recursive: true, force: true });
  }
}

main();
