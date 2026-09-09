/**
 * 텔레그램 채널(@thetickeriseth)에 올라온 글을 ECK LinkedIn 회사 페이지에 자동 게시 (맥 전용, launchd 30분 주기).
 *
 * 회사 명의 API 게시(w_organization_social)는 Community Management API 심사가 필요해, ai-secondbrain과 같은 방식으로
 * 로그인된 전용 크롬 프로필 + playwright로 페이지 관리자 화면에서 직접 올린다. 채널 글은 공개 웹 뷰(t.me/s/thetickeriseth)를 읽어
 * 새 글을 감지한다. 사진(앨범 전부)·동영상(mp4)을 함께 올린다. 본문에는 URL을 넣지 않고(외부 링크가 있는 글은 노출이 줄어든다) 링크는 모두 첫 댓글로 단다.
 * 다이제스트 글(사이트 링크로 판별)은 GitHub main의 eth-digests.json에서 풍부한 본문을 만든다. 게시한 글 id는 ~/.eck/linkedin-channel-seen.json.
 *
 * Usage:
 *   npx tsx scripts/local/linkedin-channel-post.ts --login        # 1회: 전용 프로필에 LinkedIn 로그인 (일반 크롬 창)
 *   npx tsx scripts/local/linkedin-channel-post.ts --check        # 로그인·관리자 권한·컴포저 확인 (게시 안 함)
 *   npx tsx scripts/local/linkedin-channel-post.ts --dry          # 새 글 감지·본문·댓글·사진까지만
 *   npx tsx scripts/local/linkedin-channel-post.ts                # 새 글 감지 → 게시 + 첫 댓글
 *   npx tsx scripts/local/linkedin-channel-post.ts --id=1560      # 특정 글 강제 (seen 무시)
 *   npx tsx scripts/local/linkedin-channel-post.ts --seed         # 현재 채널 글을 모두 본 것으로 기록 (백필 방지)
 *   npx tsx scripts/local/linkedin-channel-post.ts --id=1561 --comment-only  # 이미 올린 글에 첫 댓글만 다시
 * Env: LI_ORG (기본 110535025 = ECK 페이지 숫자 id) · LI_PROFILE_DIR (기본 ~/.eck/li-chrome, ~/.ai-secondbrain/li-chrome 재사용 가능)
 *      LI_HEADLESS=1 · TG_CHANNEL (기본 thetickeriseth) · ECK_REPO (기본 sumsun-dev/The-Ticker-is-ETH)
 *      TELEGRAM_BOT_TOKEN + LINKEDIN_ALERT_CHAT|VITALIK_ALERT_CHAT (알림 DM)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as dotenv from 'dotenv';
import { buildLinkedInPost, parseChannelPage, pickChannelPosts, type ChannelPost, type DigestLike, type LinkedInPost } from '../lib/linkedin-caption';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

const CHANNEL = process.env.TG_CHANNEL ?? 'thetickeriseth';
const REPO = process.env.ECK_REPO ?? 'sumsun-dev/The-Ticker-is-ETH';
const ORG = process.env.LI_ORG ?? '110535025';
const ADMIN_URL = `https://www.linkedin.com/company/${ORG}/admin/page-posts/published/`;
const HOME_DIR = join(homedir(), '.eck');
const PROFILE_DIR = process.env.LI_PROFILE_DIR ? process.env.LI_PROFILE_DIR.replace(/^~/, homedir()) : join(HOME_DIR, 'li-chrome');
/** 잠금은 프로필 디렉터리 옆에 둔다. ai-secondbrain 프로필을 같이 쓰면 그쪽 잠금(li-post.lock)과 같은 파일이 된다 */
const LOCK_DIR = join(dirname(PROFILE_DIR), 'li-post.lock');
const SEEN_FILE = join(HOME_DIR, 'linkedin-channel-seen.json');

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const LOGIN = process.argv.includes('--login');
const CHECK = process.argv.includes('--check');
const DRY = process.argv.includes('--dry');
const SEED = process.argv.includes('--seed');
const COMMENT_ONLY = process.argv.includes('--comment-only');
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

/* ── 데이터: 채널 웹 뷰, GitHub main의 다이제스트, 사진 ─────────────────── */
async function fetchChannel(): Promise<ChannelPost[]> {
  const res = await fetch(`https://t.me/s/${CHANNEL}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`t.me/s/${CHANNEL} HTTP ${res.status}`);
  return parseChannelPage(await res.text(), CHANNEL);
}

function fetchDigests(): DigestLike[] {
  try {
    const raw = execFileSync('gh', ['api', '-H', 'Accept: application/vnd.github.raw', `/repos/${REPO}/contents/src/data/eth-digests.json`], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    return (JSON.parse(raw) as { digests: DigestLike[] }).digests;
  } catch (e) {
    log(`다이제스트 데이터 조회 실패 (채널 본문으로 대체): ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    return [];
  }
}

interface Media {
  dir: string;
  photos: string[];
  video?: string;
}

/** 채널 글의 미디어를 임시 디렉터리에 받는다. 앨범은 전부, 동영상은 mp4 (LinkedIn 한도 5GB, 3초 이상) */
async function fetchMedia(post: LinkedInPost, id: number): Promise<Media> {
  const dir = join(tmpdir(), `eck-li-${id}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const download = async (url: string, file: string) => {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`media HTTP ${res.status}: ${url.slice(0, 80)}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return file;
  };
  const photos: string[] = [];
  for (const [i, url] of post.photos.entries()) {
    const ext = /\.png(\?|$)/.test(url) ? 'png' : 'jpg';
    photos.push(await download(url, join(dir, `photo-${id}-${String(i).padStart(2, '0')}.${ext}`)));
  }
  const video = post.video ? await download(post.video, join(dir, `video-${id}.mp4`)) : undefined;
  return { dir, photos, ...(video ? { video } : {}) };
}

const loadSeen = (): number[] => (existsSync(SEEN_FILE) ? (JSON.parse(readFileSync(SEEN_FILE, 'utf-8')) as number[]) : []);
function recordSeen(ids: number[]) {
  mkdirSync(HOME_DIR, { recursive: true });
  writeFileSync(SEEN_FILE, JSON.stringify([...new Set([...loadSeen(), ...ids])].sort((a, b) => a - b)));
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
    viewport: { width: 1280, height: 1400 },
    locale: 'ko-KR',
    chromiumSandbox: true,
    // 실제 macOS 키체인으로 쿠키 복호화 — 일반 크롬 창에서 한 로그인과 세션 공유
    ignoreDefaultArgs: ['--enable-automation', '--use-mock-keychain'],
  });
}

// 관리자 > 페이지 게시물 화면 셀렉터 (2026-09-09 실측). 한/영 UI 모두 대응
const SHARE_BOX = '.share-box-feed-entry__closed-share-box';
const MODAL = '.share-box-v2__modal';
const RE_PHOTO = /사진 등록|Add a photo/i;
const RE_VIDEO = /동영상 등록|동영상|Add a video/i;
const RE_TEXT = /글 올리기|글쓰기|Start a post|Create a post/i;
const RE_NEXT = /^\s*(다음|Next)\s*$/;
const POST_BTN = 'button.share-actions__primary-action';
const FIRST_POST = '[data-urn^="urn:li:activity"], .feed-shared-update-v2';
const COMMENT_FORM = 'form.comments-comment-box__form';
const COMMENT_SUBMIT = 'button.comments-comment-box__submit-button, button.comments-comment-box__submit-button--cr';

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof launch>>['newPage']>>;

async function publish(page: Page, post: LinkedInPost, media: Media) {
  await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const box = page.locator(SHARE_BOX);
  const kind = media.video ? 'video' : media.photos.length ? 'photo' : 'text';
  const start = box.getByRole('button', { name: kind === 'video' ? RE_VIDEO : kind === 'photo' ? RE_PHOTO : RE_TEXT }).first();
  await start.waitFor({ timeout: 30_000 }).catch(() => {
    throw new Error('게시 버튼 없음. 로그인이 풀렸거나 페이지 관리자가 아님 (--login 재실행)');
  });
  await start.click();
  const modal = page.locator(MODAL).first();
  await modal.waitFor({ timeout: 20_000 });
  if (kind !== 'text') {
    // 미디어 에디터의 file input은 숨겨져 있지만 setInputFiles는 DOM input이면 동작한다. 앨범은 한 번에 여러 장
    const input = modal.locator('input[type=file]').first();
    await input.waitFor({ state: 'attached', timeout: 15_000 });
    await input.setInputFiles(kind === 'video' ? [media.video!] : media.photos);
    if (kind === 'video') {
      // '다음' 버튼은 업로드 전에도 보인다. 업로드 전에 넘어가 게시하면 컴포저만 닫히고 글이 생기지 않는다(2026-09-09 실측).
      // 편집 화면에 <video> 미리보기가 생기고 진행 문구(업로드 중·처리 중·%)가 사라질 때까지 기다린다 (최대 5분)
      const deadline = Date.now() + 300_000;
      while (Date.now() < deadline) {
        const text = await modal.innerText();
        const ready = (await modal.locator('video').count()) > 0 && !/업로드 중|처리 중|uploading|processing|\d+%/i.test(text);
        if (ready) break;
        await page.waitForTimeout(5000);
      }
      await page.waitForTimeout(3000);
    } else {
      await page.waitForTimeout(1000 * Math.max(1, media.photos.length)); // 썸네일 생성 여유 (장당 1초)
    }
    // 편집 화면 → '다음'. 편집 화면 없이 바로 본문 에디터가 뜨는 경우도 있어 둘 다 기다린다
    const next = modal.getByRole('button', { name: RE_NEXT }).first();
    const editorEarly = modal.locator('.ql-editor[contenteditable="true"]').first();
    const which = await Promise.race([next.waitFor({ timeout: 120_000 }).then(() => 'next' as const), editorEarly.waitFor({ timeout: 120_000 }).then(() => 'editor' as const)]);
    if (which === 'next') await next.click();
  }
  // fill()은 Quill 상태에 안 잡혀 본문 없이 게시된다 → insertText로 정식 input 이벤트
  const editor = modal.locator('.ql-editor[contenteditable="true"]').first();
  await editor.waitFor({ timeout: 20_000 });
  await editor.click();
  await page.keyboard.insertText(post.body);
  await page.waitForTimeout(1500);
  const btn = modal.locator(POST_BTN).first();
  const handle = await btn.elementHandle();
  await page.waitForFunction((el) => el && el.getAttribute('aria-disabled') !== 'true' && !(el as HTMLButtonElement).disabled, handle, { timeout: 60_000 });
  await btn.click();
  await page.locator(MODAL).waitFor({ state: 'detached', timeout: 60_000 }).catch(() => {
    throw new Error('컴포저가 닫히지 않음. 페이지에서 직접 확인 필요');
  });
  // 동영상은 서버 처리 뒤에야 목록에 뜬다. 댓글 단계가 목록에서 글을 찾을 때까지 재시도하므로 여기서는 잠시만 기다린다
  await page.waitForTimeout(kind === 'video' ? 30_000 : 5000);
}

/**
 * 방금 올린 글에 첫 댓글. 목록 앞쪽 항목들에서 본문 첫 줄로 찾는다(퍼가기 항목이나 처리 중인 동영상 글 때문에 첫 항목이 아닐 수 있고,
 * 동영상은 처리 뒤에야 목록에 뜨므로 최대 6회, 30초 간격으로 다시 찾는다)
 */
async function addFirstComment(page: Page, post: LinkedInPost) {
  const marker = post.body.split('\n')[0].slice(0, 40);
  let first: ReturnType<Page['locator']> | null = null;
  let text = '';
  for (let attempt = 0; attempt < 6 && !first; attempt++) {
    if (attempt > 0) await page.waitForTimeout(30_000);
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(5000);
    const posts = page.locator(FIRST_POST);
    const n = Math.min(await posts.count(), 6);
    for (let i = 0; i < n; i++) {
      const t = await posts.nth(i).innerText();
      // 퍼가기 항목(머리에 "퍼옴")은 건너뛴다
      if (t.includes(marker) && !/퍼옴|reposted/i.test(t.split('\n').slice(0, 6).join(' '))) {
        first = posts.nth(i);
        text = t;
        break;
      }
    }
  }
  if (!first) throw new Error(`목록에서 방금 올린 글을 찾지 못함 (기대: ${marker})`);
  if (text.includes('텔레그램 채널 The Ticker is ETH')) return log('첫 댓글 이미 있음');
  await first.getByRole('button', { name: /댓글|comment/i }).first().click();
  const form = first.locator(COMMENT_FORM).first();
  const editor = form.locator('.ql-editor').first();
  await editor.waitFor({ timeout: 15_000 });
  await editor.click();
  await page.keyboard.insertText(post.comment);
  await page.waitForTimeout(1500);
  const submit = form.locator(COMMENT_SUBMIT).first();
  await submit.waitFor({ timeout: 15_000 });
  await submit.click();
  await page.waitForTimeout(4000);
  if (!(await first.innerText()).includes('텔레그램 채널 The Ticker is ETH')) throw new Error('첫 댓글이 보이지 않음');
}

async function postToLinkedIn(post: LinkedInPost, media: Media) {
  const ctx = await launch(HEADLESS);
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await publish(page, post, media);
    await addFirstComment(page, post).catch(async (e) => {
      log(`댓글 실패: ${e instanceof Error ? e.message : e}`);
      await notify(`LinkedIn 게시는 됐지만 첫 댓글(링크) 달기에 실패했습니다. 직접 달아 주세요.\n${post.comment}`);
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
    const ok = await page.locator(SHARE_BOX).getByRole('button', { name: RE_PHOTO }).first().waitFor({ timeout: 20_000 }).then(() => true, () => false);
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
  if (SEED) {
    const posts = await fetchChannel();
    recordSeen(posts.map((p) => p.id));
    return log(`채널 글 ${posts.length}건을 본 것으로 기록 (최신 ${posts[posts.length - 1]?.id})`);
  }
  if (!acquireLock()) return log('다른 인스턴스 실행 중. skip');
  let current: number | null = null;
  try {
    const forced = arg('id') ? Number(arg('id')) : null;
    const posts = await fetchChannel();
    const targets = forced ? posts.filter((p) => p.id === forced) : pickChannelPosts(posts, loadSeen(), new Date());
    if (targets.length === 0) return log('게시할 새 글 없음');
    const digests = fetchDigests();
    for (const ch of targets) {
      current = ch.id;
      // 이 글에 달린 답글(브리프 토론 메시지 등)의 링크는 첫 댓글로 합친다
      const post = buildLinkedInPost(ch, digests, undefined, posts.filter((p) => p.replyTo === ch.id));
      const media = await fetchMedia(post, ch.id);
      const mediaDesc = media.video ? `동영상 ${(statSync(media.video).size / 1e6).toFixed(1)}MB` : media.photos.length ? `사진 ${media.photos.length}장` : '미디어 없음';
      log(`#${ch.id}${post.digestDate ? ` (다이제스트 ${post.digestDate})` : ''}: 게시 시작${DRY ? ' (dry)' : ''} · 본문 ${post.body.length}자 · ${mediaDesc}`);
      if (DRY) {
        log(`\n--- 본문\n${post.body}\n--- 첫 댓글\n${post.comment}\n--- 미디어\n${[...media.photos, media.video].filter(Boolean).join('\n')}\n`);
        continue;
      }
      if (COMMENT_ONLY) {
        const ctx = await launch(HEADLESS);
        try {
          await addFirstComment(ctx.pages()[0] ?? (await ctx.newPage()), post);
          log(`#${ch.id}: 첫 댓글 완료`);
        } finally {
          await ctx.close();
        }
        rmSync(media.dir, { recursive: true, force: true });
        continue;
      }
      await postToLinkedIn(post, media);
      recordSeen([ch.id]);
      log(`#${ch.id}: LinkedIn 게시 완료 (${mediaDesc})`);
      await notify(`LinkedIn ECK 페이지에 채널 글 #${ch.id} 게시 완료 (${mediaDesc})\n${post.body.split('\n')[0].slice(0, 80)}`);
      rmSync(media.dir, { recursive: true, force: true });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`실패: ${msg}`);
    await notify(`LinkedIn ECK 페이지 게시 실패 (#${current ?? '?'})\n${msg.slice(0, 300)}`);
    process.exitCode = 1;
  } finally {
    rmSync(LOCK_DIR, { recursive: true, force: true });
  }
}

main();
