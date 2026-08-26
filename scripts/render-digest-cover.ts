/**
 * 다이제스트 커버 이미지 렌더러 — HTML 카드를 헤드리스 크로미엄으로 PNG(1200×630) 캡처.
 * ai-secondbrain 카드뉴스와 동일한 스택(playwright-core + 외부 크로미엄 바이너리).
 *
 * 출력: public/assets/digests/{date}.png + 다이제스트에 coverImage 경로 기록.
 * 크로미엄: CHROMIUM_PATH → ~/.cache/ms-playwright → macOS Chrome → 리눅스 시스템 경로.
 */
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
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

function coverHtml(digest: Digest, logoDataUri: string, fontDataUri: string): string {
  // 짧은 헤드라인을 레퍼런스처럼 2줄로 — 1줄째 네이비, 2줄째 그라디언트.
  // 쉼표가 있으면 쉼표에서 분할(쉼표 제거), 없으면 중앙에 가까운 공백에서 분할.
  const headline = (digest.shortTitle ?? digest.title).trim();
  let line1 = headline;
  let line2 = '';
  const commaIdx = headline.indexOf(',');
  if (commaIdx > 0) {
    line1 = headline.slice(0, commaIdx).trim();
    line2 = headline.slice(commaIdx + 1).trim();
  } else {
    const mid = Math.floor(headline.length / 2);
    let best = -1;
    for (let i = 0; i < headline.length; i++) {
      if (headline[i] === ' ' && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    }
    if (best > 0) {
      line1 = headline.slice(0, best).trim();
      line2 = headline.slice(best + 1).trim();
    }
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face {
      font-family: 'Pretendard';
      src: url('${fontDataUri}') format('woff2-variations');
      font-weight: 45 920;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px; height: 630px; overflow: hidden; position: relative;
      background: #F7F8FC;
      font-family: 'Pretendard', 'Noto Sans CJK KR', 'Apple SD Gothic Neo', sans-serif;
      color: #16203B;
    }
    .tint1 { position: absolute; width: 900px; height: 900px; border-radius: 50%; top: -500px; left: -200px;
      background: radial-gradient(circle, rgba(120,150,230,.14) 0%, transparent 65%); }
    .tint2 { position: absolute; width: 700px; height: 700px; border-radius: 50%; bottom: -420px; left: -180px;
      background: radial-gradient(circle, rgba(230,120,100,.13) 0%, transparent 65%); }
    .tint3 { position: absolute; width: 800px; height: 800px; border-radius: 50%; bottom: -450px; right: -200px;
      background: radial-gradient(circle, rgba(100,130,230,.14) 0%, transparent 65%); }
    .mono { font-family: 'IBM Plex Mono', 'SF Mono', ui-monospace, monospace; }
    .wrap { position: relative; height: 100%; padding: 52px 64px 0; display: flex; flex-direction: column; }
    .head { display: flex; align-items: center; }
    .brand { display: flex; align-items: center; gap: 16px; }
    .brand img { width: 46px; height: 46px; }
    .brand span { font-size: 26px; font-weight: 800; letter-spacing: -.01em; }
    /* 텍스트 존은 오른쪽 로고 존을 침범하지 않는다 */
    .body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding-right: 340px; }
    .title { font-size: 92px; font-weight: 850; line-height: 1.16; letter-spacing: -.025em; color: #16203B; }
    .tline { white-space: nowrap; }
    .tline.accent { background: linear-gradient(95deg, #D65A4E 0%, #8B5CF6 55%, #2D5FBF 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .sub { margin-top: 30px; font-size: 25px; font-weight: 500; color: #4A5570; white-space: nowrap; }
    /* 로고 무대: 컬러 오브 + 다이아 아웃라인 에코 */
    .stage { position: absolute; right: 28px; top: 47%; transform: translateY(-50%);
      width: 330px; height: 430px; }
    .orb1 { position: absolute; width: 220px; height: 220px; border-radius: 50%; top: -30px; right: -40px;
      background: radial-gradient(circle, rgba(170,84,60,.20) 0%, transparent 68%); }
    .orb2 { position: absolute; width: 260px; height: 260px; border-radius: 50%; bottom: -50px; left: -60px;
      background: radial-gradient(circle, rgba(45,95,191,.18) 0%, transparent 68%); }
    .ring { position: absolute; left: 50%; top: 50%; border-radius: 44px; }
    .ring1 { width: 300px; height: 300px; transform: translate(-50%,-50%) rotate(45deg);
      border: 1.6px solid rgba(192,138,78,.35); }
    .ring2 { width: 400px; height: 400px; transform: translate(-50%,-50%) rotate(45deg);
      border: 1.4px solid rgba(45,95,191,.18); border-radius: 60px; }
    .logo { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 265px;
      filter: drop-shadow(0 18px 36px rgba(22,32,59,.22)); }
    .foot { position: relative; margin-top: auto; border-top: 1px solid #DCE1EC; padding: 20px 0 26px;
      display: flex; align-items: center; justify-content: flex-end;
      font-size: 17px; letter-spacing: .18em; color: #7A8499; }
    .foot b { color: #16203B; }
  </style></head><body>
    <div class="tint1"></div><div class="tint2"></div><div class="tint3"></div>
    <div class="stage">
      <div class="orb1"></div><div class="orb2"></div>
      <div class="ring ring2"></div><div class="ring ring1"></div>
      <img class="logo" src="${logoDataUri}" alt="" />
    </div>
    <div class="wrap">
      <div class="head">
        <div class="brand"><img src="${logoDataUri}" alt="" /><span>ECK — Daily Ethereum Digest</span></div>
      </div>
      <div class="body">
        <div class="title">
          <div class="tline">${esc(line1)}</div>
          ${line2 ? `<div class="tline accent">${esc(line2)}</div>` : ''}
        </div>
        ${digest.subTitle ? `<div class="sub">${esc(digest.subTitle)}</div>` : ''}
      </div>
      <div class="foot mono">
        <span><b>ethcollective.xyz/news</b></span>
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
  if (digest.coverImage?.startsWith(publicPath) && existsSync(outFile)) {
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
  const fontPath = path.resolve(process.cwd(), 'scripts/assets/PretendardVariable.woff2');
  const fontDataUri = `data:font/woff2;base64,${readFileSync(fontPath).toString('base64')}`;

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
    await page.setContent(coverHtml(digest, logoDataUri, fontDataUri), { waitUntil: 'networkidle' });
    await page.evaluateHandle('document.fonts.ready');
    // 두 줄 모두 텍스트 존 폭에 맞춰 실측으로 최대 크기 조정
    await page.evaluate(() => {
      const box = document.querySelector('.title') as HTMLElement;
      const lines = Array.from(document.querySelectorAll('.tline')) as HTMLElement[];
      let size = 92;
      box.style.fontSize = `${size}px`;
      while (size > 40 && lines.some((l) => l.scrollWidth > l.clientWidth)) {
        size -= 2;
        box.style.fontSize = `${size}px`;
      }
    });
    await page.screenshot({ path: outFile, type: 'png' });
  } finally {
    await browser.close();
  }

  // 같은 파일명 덮어쓰기 시 CDN/브라우저 캐시 무효화를 위해 콘텐츠 해시 쿼리를 붙인다
  const hash = createHash('md5').update(readFileSync(outFile)).digest('hex').slice(0, 8);
  digest.coverImage = `${publicPath}?v=${hash}`;
  writeFileSync(DIGESTS, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Rendered cover ${outFile} and linked as ${publicPath}`);
}

main().catch((error) => {
  console.warn('[WARN] render-digest-cover failed:', error instanceof Error ? error.message : error);
  process.exit(0);
});
