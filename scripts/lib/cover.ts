/**
 * 커버 이미지(1200×630) 렌더러 — HTML 카드를 헤드리스 크로미엄으로 캡처.
 * 다이제스트 커버(render-digest-cover.ts)와 코어 개발자 콜 브리프(post-calls-telegram.ts)가 같이 쓴다.
 * 크로미엄: CHROMIUM_PATH → ~/.cache/ms-playwright → macOS Chrome → 리눅스 시스템 경로.
 */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import * as path from 'path';

export interface CoverSpec {
  /** 한 줄 헤드라인 (폭에 맞춰 크기가 줄어든다, 16자 안팎 권장) */
  headline: string;
  subTitle?: string;
  /** 좌상단 브랜드 라벨 */
  brand?: string;
  /** 우하단 푸터 */
  foot?: string;
}

export function resolveChromium(): string | null {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  for (const cache of [path.join(homedir(), '.cache', 'ms-playwright'), path.join(homedir(), 'Library', 'Caches', 'ms-playwright')]) {
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

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function coverHtml(spec: CoverSpec, logoDataUri: string, fontDataUri: string): string {
  const brand = spec.brand ?? 'ECK — Daily Ethereum Digest';
  const foot = spec.foot ?? 'ethcollective.xyz/news';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Pretendard'; src: url('${fontDataUri}') format('woff2-variations'); font-weight: 45 920; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1200px; height: 630px; overflow: hidden; position: relative; background: #F7F8FC;
      font-family: 'Pretendard', 'Noto Sans CJK KR', 'Apple SD Gothic Neo', sans-serif; color: #16203B; }
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
    .body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding-right: 340px; }
    .title { font-size: 92px; font-weight: 850; line-height: 1.16; letter-spacing: -.025em; color: #16203B; }
    .tline { white-space: nowrap; }
    .tline.accent { background: linear-gradient(95deg, #D65A4E 0%, #8B5CF6 55%, #2D5FBF 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .sub { margin-top: 30px; font-size: 25px; font-weight: 500; color: #4A5570; white-space: nowrap; }
    .stage { position: absolute; right: 28px; top: 47%; transform: translateY(-50%); width: 330px; height: 430px; }
    .orb1 { position: absolute; width: 220px; height: 220px; border-radius: 50%; top: -30px; right: -40px;
      background: radial-gradient(circle, rgba(170,84,60,.20) 0%, transparent 68%); }
    .orb2 { position: absolute; width: 260px; height: 260px; border-radius: 50%; bottom: -50px; left: -60px;
      background: radial-gradient(circle, rgba(45,95,191,.18) 0%, transparent 68%); }
    .ring { position: absolute; left: 50%; top: 50%; border-radius: 44px; }
    .ring1 { width: 300px; height: 300px; transform: translate(-50%,-50%) rotate(45deg); border: 1.6px solid rgba(192,138,78,.35); }
    .ring2 { width: 400px; height: 400px; transform: translate(-50%,-50%) rotate(45deg); border: 1.4px solid rgba(45,95,191,.18); border-radius: 60px; }
    .logo { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 265px; filter: drop-shadow(0 18px 36px rgba(22,32,59,.22)); }
    .foot { position: relative; margin-top: auto; border-top: 1px solid #DCE1EC; padding: 20px 0 26px; display: flex; align-items: center;
      justify-content: flex-end; font-size: 17px; letter-spacing: .18em; color: #7A8499; }
    .foot b { color: #16203B; }
  </style></head><body>
    <div class="tint1"></div><div class="tint2"></div><div class="tint3"></div>
    <div class="stage">
      <div class="orb1"></div><div class="orb2"></div>
      <div class="ring ring2"></div><div class="ring ring1"></div>
      <img class="logo" src="${logoDataUri}" alt="" />
    </div>
    <div class="wrap">
      <div class="head"><div class="brand"><img src="${logoDataUri}" alt="" /><span>${esc(brand)}</span></div></div>
      <div class="body">
        <div class="title"><div class="tline accent">${esc(spec.headline.trim())}</div></div>
        ${spec.subTitle ? `<div class="sub">${esc(spec.subTitle)}</div>` : ''}
      </div>
      <div class="foot mono"><span><b>${esc(foot)}</b></span></div>
    </div>
  </body></html>`;
}

export interface CoverAssets {
  logoDataUri: string;
  fontDataUri: string;
}

export function coverAssets(): CoverAssets {
  return {
    logoDataUri: `data:image/png;base64,${readFileSync(path.resolve(process.cwd(), 'public/assets/eck-logo.png')).toString('base64')}`,
    fontDataUri: `data:font/woff2;base64,${readFileSync(path.resolve(process.cwd(), 'scripts/assets/PretendardVariable.woff2')).toString('base64')}`,
  };
}

/** 브라우저 안에서 실행: 헤드라인·부제가 텍스트 존 폭을 넘지 않게 실측으로 최대 크기 조정 */
function fitDigestCover() {
  const box = document.querySelector('.title') as HTMLElement;
  const lines = Array.from(document.querySelectorAll('.tline')) as HTMLElement[];
  let size = 92;
  box.style.fontSize = `${size}px`;
  while (size > 40 && lines.some((l) => l.scrollWidth > l.clientWidth)) {
    size -= 2;
    box.style.fontSize = `${size}px`;
  }
  const sub = document.querySelector('.sub') as HTMLElement | null;
  let subSize = 25;
  while (sub && subSize > 16 && sub.scrollWidth > sub.clientWidth) {
    subSize -= 1;
    sub.style.fontSize = `${subSize}px`;
  }
}

/** 완성된 HTML 문서를 1200×630 PNG로 캡처. fit은 페이지 안에서 실행되는 폰트 맞춤 함수(외부 참조 불가). 크로미엄이 없으면 false. */
export async function renderHtml(html: string, outFile: string, fit?: () => void): Promise<boolean> {
  const executablePath = resolveChromium();
  if (!executablePath) {
    console.warn('[WARN] no Chromium binary found (set CHROMIUM_PATH) — cover skipped');
    return false;
  }
  mkdirSync(path.dirname(outFile), { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluateHandle('document.fonts.ready');
    if (fit) await page.evaluate(fit);
    await page.screenshot({ path: outFile, type: 'png' });
  } finally {
    await browser.close();
  }
  return true;
}

/** 다이제스트 커버를 outFile(PNG)로 렌더. 크로미엄이 없으면 false. */
export async function renderCover(spec: CoverSpec, outFile: string): Promise<boolean> {
  const { logoDataUri, fontDataUri } = coverAssets();
  return renderHtml(coverHtml(spec, logoDataUri, fontDataUri), outFile, fitDigestCover);
}
