/**
 * 다이제스트 커버 이미지 렌더러 — HTML 카드를 헤드리스 크로미엄으로 PNG(1200×630) 캡처.
 * ai-secondbrain 카드뉴스와 동일한 스택(playwright-core + 외부 크로미엄 바이너리).
 *
 * 출력: public/assets/digests/{date}.png + 다이제스트에 coverImage 경로 기록.
 * 크로미엄: CHROMIUM_PATH → ~/.cache/ms-playwright → macOS Chrome → 리눅스 시스템 경로.
 */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import * as path from 'path';
import type { Digest } from './generate-eth-digest';

const DIGESTS = path.resolve(process.cwd(), 'src/data/eth-digests.json');
const OUT_DIR = path.resolve(process.cwd(), 'public/assets/digests');

function resolveChromium(): string | null {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = path.join(homedir(), '.cache', 'ms-playwright');
  try {
    const dirs = readdirSync(cache)
      .filter((d) => d.startsWith('chromium_headless_shell') || d.startsWith('chromium-'))
      .sort()
      .reverse();
    for (const d of dirs) {
      const base = path.join(cache, d);
      for (const sub of readdirSync(base)) {
        for (const p of [path.join(base, sub, 'chrome-headless-shell'), path.join(base, sub, 'chrome')]) {
          if (existsSync(p)) return p;
        }
      }
    }
  } catch {
    /* no cache */
  }
  for (const p of [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ]) {
    if (existsSync(p)) return p;
  }
  return null;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function coverHtml(digest: Digest): string {
  const itemCount = digest.sections.reduce((n, s) => n + s.items.length, 0);
  const dateLabel = new Date(`${digest.date}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px; height: 630px; overflow: hidden; position: relative;
      background: #050508;
      font-family: 'Noto Sans CJK KR', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Inter', sans-serif;
      color: #fff;
    }
    .glow { position: absolute; width: 700px; height: 700px; border-radius: 50%;
      background: radial-gradient(circle, rgba(45,95,191,.28) 0%, transparent 65%);
      top: -180px; right: -120px; }
    .glow2 { position: absolute; width: 500px; height: 500px; border-radius: 50%;
      background: radial-gradient(circle, rgba(160,134,252,.14) 0%, transparent 65%);
      bottom: -200px; left: -100px; }
    .grid { position: absolute; inset: 0; opacity: .5;
      background-image: linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
      background-size: 48px 48px; }
    .wrap { position: relative; height: 100%; padding: 64px 72px; display: flex; flex-direction: column; }
    .eyebrow { font-size: 20px; font-weight: 700; letter-spacing: .22em; color: #629FFF; }
    .date { margin-top: 14px; font-size: 24px; color: rgba(255,255,255,.55); font-weight: 400; }
    .title { margin-top: auto; margin-bottom: auto; max-width: 880px;
      font-size: 64px; font-weight: 800; line-height: 1.22; letter-spacing: -.015em; word-break: keep-all;
      background: linear-gradient(100deg, #fff 30%, #629FFF 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .title.long { font-size: 52px; }
    .foot { display: flex; align-items: center; gap: 18px; font-size: 22px; color: rgba(255,255,255,.6); }
    .foot b { color: #A086FC; font-weight: 700; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.25); }
    .eth { position: absolute; right: 84px; top: 50%; transform: translateY(-50%); }
  </style></head><body>
    <div class="glow"></div><div class="glow2"></div><div class="grid"></div>
    <svg class="eth" width="200" height="320" viewBox="0 0 256 417">
      <polygon fill="#629FFF" fill-opacity=".92" points="127.9,0 125.1,9.5 125.1,285.1 127.9,287.9 255.9,212.3"/>
      <polygon fill="#A086FC" fill-opacity=".92" points="127.9,0 0,212.3 127.9,287.9 127.9,154.2"/>
      <polygon fill="#629FFF" fill-opacity=".65" points="127.9,312.2 126.4,314.1 126.4,412.3 127.9,416.9 256,236.6"/>
      <polygon fill="#A086FC" fill-opacity=".65" points="127.9,416.9 127.9,312.2 0,236.6"/>
      <polygon fill="#2D5FBF" fill-opacity=".8" points="127.9,287.9 255.9,212.3 127.9,154.2"/>
      <polygon fill="#4a3f8f" fill-opacity=".8" points="0,212.3 127.9,287.9 127.9,154.2"/>
    </svg>
    <div class="wrap">
      <div>
        <div class="eyebrow">ECK · DAILY ETHEREUM DIGEST</div>
        <div class="date">${esc(dateLabel)}</div>
      </div>
      <div class="title ${digest.title.length > 28 ? 'long' : ''}">${esc(digest.title)}</div>
      <div class="foot">
        <span><b>${itemCount}</b>개 소식</span><span class="dot"></span>
        <span>ethcollective.xyz/news</span>
      </div>
    </div>
  </body></html>`;
}

async function main() {
  const data = JSON.parse(readFileSync(DIGESTS, 'utf-8')) as { digests: Digest[] };
  const digest = process.env.DIGEST_DATE
    ? data.digests.find((d) => d.date === process.env.DIGEST_DATE)
    : data.digests[0];
  if (!digest) {
    console.log('[SKIP] no digest to render');
    return;
  }

  const outFile = path.join(OUT_DIR, `${digest.date}.png`);
  const publicPath = `/assets/digests/${digest.date}.png`;
  if (digest.coverImage === publicPath && existsSync(outFile)) {
    console.log(`[SKIP] cover for ${digest.date} already rendered`);
    return;
  }

  const executablePath = resolveChromium();
  if (!executablePath) {
    console.warn('[WARN] no Chromium binary found (set CHROMIUM_PATH) — cover skipped');
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
    await page.setContent(coverHtml(digest), { waitUntil: 'networkidle' });
    await page.screenshot({ path: outFile, type: 'png' });
  } finally {
    await browser.close();
  }

  digest.coverImage = publicPath;
  writeFileSync(DIGESTS, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Rendered cover ${outFile} and linked as ${publicPath}`);
}

main().catch((error) => {
  console.warn('[WARN] render-digest-cover failed:', error instanceof Error ? error.message : error);
  process.exit(0);
});
