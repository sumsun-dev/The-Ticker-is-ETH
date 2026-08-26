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

function coverHtml(digest: Digest, logoDataUri: string): string {
  // 커버 메인은 한 줄 헤드라인 (shortTitle, 폰트는 렌더 시 실측 조정)
  const headline = digest.shortTitle ?? digest.title;
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
    /* 텍스트 존은 오른쪽 로고 존(360px)을 침범하지 않는다 */
    .wrap { position: relative; height: 100%; padding: 64px 360px 64px 72px; display: flex; flex-direction: column; }
    .eyebrow { font-size: 20px; font-weight: 700; letter-spacing: .22em; color: #629FFF; }
    .date { margin-top: 14px; font-size: 24px; color: rgba(255,255,255,.55); font-weight: 400; }
    .mid { margin-top: auto; margin-bottom: auto; }
    /* 한 줄 유지 — 렌더 시 실측으로 폰트 최대화 (로고 존 침범 없음) */
    .title { white-space: nowrap; font-size: 78px;
      font-weight: 800; line-height: 1.2; letter-spacing: -.015em;
      background: linear-gradient(100deg, #fff 30%, #629FFF 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .foot { display: flex; align-items: center; gap: 18px; font-size: 22px; color: rgba(255,255,255,.6); }
    .foot b { color: #A086FC; font-weight: 700; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.25); }
    .logo { position: absolute; right: 56px; top: 50%; transform: translateY(-50%); width: 260px; height: 260px;
      filter: drop-shadow(0 12px 40px rgba(0,0,0,.5)); }
  </style></head><body>
    <div class="glow"></div><div class="glow2"></div><div class="grid"></div>
    <img class="logo" src="${logoDataUri}" alt="" />
    <div class="wrap">
      <div>
        <div class="eyebrow">ECK · DAILY ETHEREUM DIGEST</div>
        <div class="date">${esc(dateLabel)}</div>
      </div>
      <div class="mid">
        <div class="title">${esc(headline)}</div>
      </div>
      <div class="foot">
        <span>전체 보기</span><span class="dot"></span>
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

  const logoPath = path.resolve(process.cwd(), 'public/assets/eck-logo.png');
  const logoDataUri = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`;

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
    await page.setContent(coverHtml(digest, logoDataUri), { waitUntil: 'networkidle' });
    // 타이틀을 텍스트 존 폭에 맞춰 실측으로 최대 크기 조정 (한 줄 보장)
    await page.evaluate(() => {
      const el = document.querySelector('.title') as HTMLElement;
      let size = 78;
      el.style.fontSize = `${size}px`;
      while (size > 40 && el.scrollWidth > el.clientWidth) {
        size -= 2;
        el.style.fontSize = `${size}px`;
      }
    });
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
