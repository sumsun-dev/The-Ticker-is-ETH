// One-off: generate the social OG card (1200x630) in the homepage hero style,
// plus a square schema.org Organization logo.
// Run: node scripts/generate-og.mjs
//
// Latin text (overline + big italic ECK title) is rendered as opentype.js
// vector paths from bundled Inter TTFs so the exact Inter 900 Black Italic
// glyphs appear regardless of system fonts. The Korean subtitle is rendered
// via a librsvg <text> element using "Apple SD Gothic Neo" (system font),
// since opentype.js cannot parse macOS .ttc collections.
import sharp from 'sharp';
import opentype from 'opentype.js';
import fs from 'node:fs';

const W = 1200;
const H = 630;

// Hero palette (src/index.css / tailwind.config.js)
const BG = '#050508';
const ACCENT = '#629FFF'; // brand.accent — the E / C / K letters
const TEXT = '#F5F5FA'; // text-primary — rest of the title
const MUTED = '#9ca3af'; // text-muted — overline
const SUBTLE = '#d1d5db'; // text-secondary — Korean subtitle
const GLOW = '#2D5FBF'; // brand.primary — radial glow

const FONT_DIR = 'node_modules/@expo-google-fonts/inter';
const titleFont = opentype.parse(
  fs.readFileSync(`${FONT_DIR}/900Black_Italic/Inter_900Black_Italic.ttf`).buffer,
);
const overlineFont = opentype.parse(
  fs.readFileSync(`${FONT_DIR}/500Medium/Inter_500Medium.ttf`).buffer,
);

// --- helpers -------------------------------------------------------------

// Render a string char-by-char with optional extra tracking between glyphs.
// Returns { d: combined path data, width: total advance incl. tracking }.
function trackedPath(font, text, x, y, size, tracking = 0, color = TEXT) {
  let cx = x;
  let d = '';
  for (const ch of text) {
    const p = font.getPath(ch, cx, y, size);
    d += p.toPathData(2);
    cx += font.getAdvanceWidth(ch, size) + tracking;
  }
  const width = cx - x - (text.length ? tracking : 0);
  return { path: `<path d="${d}" fill="${color}"/>`, width };
}

// Render a title line made of colored runs ([{text,color}, ...]).
// Returns { svg, width }.
function runLine(font, runs, x, y, size, tracking = 0) {
  let cx = x;
  let svg = '';
  for (const run of runs) {
    const { path, width } = trackedPath(font, run.text, cx, y, size, tracking, run.color);
    svg += path;
    cx += width + tracking; // tracking gap between runs too
  }
  return { svg, width: cx - x - tracking };
}

function measureRuns(font, runs, size, tracking = 0) {
  let w = 0;
  for (const run of runs) {
    for (const ch of run.text) w += font.getAdvanceWidth(ch, size) + tracking;
  }
  return w;
}

// --- layout --------------------------------------------------------------

// Logo on the right, vertically centered.
const logoH = 380;
const logoRaw = await sharp('tie_logo_no_background.png')
  .trim()
  .resize({ height: logoH })
  .toBuffer();
const { width: lw, height: lh } = await sharp(logoRaw).metadata();
const logoRightMargin = 80;
const logoX = W - logoRightMargin - lw;
const logoY = Math.round((H - lh) / 2);

const leftX = 80;
const textMaxW = logoX - 48 - leftX; // gap before logo

// Title lines: E/C/K highlighted in accent.
const line1 = [
  { text: 'E', color: ACCENT },
  { text: 'THEREUM', color: TEXT },
];
const line2 = [
  { text: 'C', color: ACCENT },
  { text: 'OLLECTIVE ', color: TEXT },
  { text: 'K', color: ACCENT },
  { text: 'OREA', color: TEXT },
];

// Fit the widest line into textMaxW (cap at 92px).
const TITLE_TRACK = -1;
let titleSize = 92;
const widest = Math.max(
  measureRuns(titleFont, line1, titleSize, TITLE_TRACK),
  measureRuns(titleFont, line2, titleSize, TITLE_TRACK),
);
if (widest > textMaxW) titleSize = Math.floor((titleSize * textMaxW) / widest);

const lineGap = Math.round(titleSize * 0.92);

// Vertical block: overline, title1, title2, korean.
const overlineSize = 21;
const overlineTrack = 7;
const koreanSize = 33;

const blockTop = 168;
const overlineY = blockTop;
const title1Y = overlineY + 64 + titleSize;
const title2Y = title1Y + lineGap;
const koreanY = title2Y + 60 + koreanSize * 0.2;

const overline = trackedPath(
  overlineFont,
  'ETHEREUM COLLECTIVE KOREA',
  leftX + 2,
  overlineY,
  overlineSize,
  overlineTrack,
  MUTED,
);
const t1 = runLine(titleFont, line1, leftX, title1Y, titleSize, TITLE_TRACK);
const t2 = runLine(titleFont, line2, leftX, title2Y, titleSize, TITLE_TRACK);

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="28%" cy="38%" r="70%">
      <stop offset="0%" stop-color="${GLOW}" stop-opacity="0.32"/>
      <stop offset="55%" stop-color="${GLOW}" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="${GLOW}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${overline.path}
  ${t1.svg}
  ${t2.svg}
  <text x="${leftX + 3}" y="${koreanY}" font-family="Apple SD Gothic Neo, sans-serif"
        font-size="${koreanSize}" font-weight="500" fill="${SUBTLE}">한국 이더리움 생태계의 콜렉티브.</text>
</svg>`;

await sharp(Buffer.from(svg))
  .composite([{ input: logoRaw, left: logoX, top: logoY }])
  .png()
  .toFile('public/assets/eck-og.png');

const out = await sharp('public/assets/eck-og.png').metadata();
console.log(`generated public/assets/eck-og.png ${out.width}x${out.height} (titleSize=${titleSize})`);

// --- square, transparent logo for schema.org Organization "logo" ---------
const S = 512;
const sqLogo = await sharp('tie_logo_no_background.png')
  .trim()
  .resize({ height: Math.round(S * 0.86) })
  .toBuffer();
const { width: sw, height: sh } = await sharp(sqLogo).metadata();
await sharp({
  create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: sqLogo, left: Math.round((S - sw) / 2), top: Math.round((S - sh) / 2) }])
  .png()
  .toFile('public/assets/eck-logo.png');
console.log(`generated public/assets/eck-logo.png ${S}x${S}`);
