/**
 * 빌드 후처리: 데이터로부터 SEO/AEO/GEO 자산을 자동 생성한다.
 *
 *  vite build → dist/ → tsx scripts/generate-seo.ts
 *    1) dist/sitemap.xml          : 정적 라우트 + 전체 콘텐츠/멤버 URL
 *    2) dist/<route>/index.html   : 라우트별 메타 + JSON-LD + 크롤러용 본문이 박힌 정적 shell
 *    3) dist/llms.txt             : 생성형 엔진(LLM)용 사이트 개요 + 콘텐츠 인덱스
 *
 * three.js/Privy 를 렌더하지 않고 데이터만 읽으므로 SSG 충돌이 없다.
 * 새 콘텐츠가 sync 되면 다음 빌드에서 자동 포함된다.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockMembers, mockContributors } from '../src/data/mockData';
import { articleLd, personLd, breadcrumbLd, SITE_URL } from '../src/utils/structuredData';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const DATA = join(ROOT, 'src/data');
const ARTICLES = join(DATA, 'articles');
const SITE_NAME = 'ECK — Ethereum Collective Korea';
const DEFAULT_IMAGE = `${SITE_URL}/assets/ethereum-korea-logo-dark.png`;
const BODY_MAX = 1500;

// ── helpers ────────────────────────────────────────────────
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s = '') => esc(s).replace(/"/g, '&quot;');

function readJson<T>(p: string): T {
    return JSON.parse(readFileSync(p, 'utf8')) as T;
}

/** 마크다운/HTML → 평문 (크롤러 본문용) */
function toPlainText(src: string): string {
    return src
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[#>*_`~|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, BODY_MAX);
}

interface ContentItem {
    id: string;
    title: string;
    author: string;
    date: string;
    category: string;
    summary: string;
    thumbnailUrl?: string;
    html?: string; // 뉴스 본문(html)
}

// ── 데이터 로드 ─────────────────────────────────────────────
const research = readJson<ContentItem[]>(join(DATA, 'research-index.json'));
const newsFeed = readJson<{ items: Array<Record<string, string>> }>(join(DATA, 'news-feed.json'));
const newsItems: ContentItem[] = (newsFeed.items || []).map((n) => ({
    id: `news-${n.id}`,
    title: n.title,
    author: n.author,
    date: (n.published || '').split('T')[0],
    category: 'Weekly Report',
    summary: n.summary,
    thumbnailUrl: '',
    html: n.content,
}));
const contents: ContentItem[] = [...research, ...newsItems];

const members = [...mockMembers, ...mockContributors];

// ── 1) sitemap.xml ─────────────────────────────────────────
interface SitemapEntry {
    loc: string;
    lastmod?: string;
    changefreq: string;
    priority: string;
}

function toIso(date: string): string | undefined {
    if (!date) return undefined;
    const d = date.includes('-') ? date : date.replace(/\./g, '-');
    return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : undefined;
}

const staticRoutes: SitemapEntry[] = [
    { loc: '/', changefreq: 'weekly', priority: '1.0' },
    { loc: '/about', changefreq: 'monthly', priority: '0.8' },
    { loc: '/contents', changefreq: 'daily', priority: '0.9' },
    { loc: '/team', changefreq: 'monthly', priority: '0.7' },
    { loc: '/contributors', changefreq: 'weekly', priority: '0.7' },
    { loc: '/ecosystem', changefreq: 'monthly', priority: '0.7' },
    { loc: '/events', changefreq: 'weekly', priority: '0.7' },
];

const contentEntries: SitemapEntry[] = contents.map((c) => ({
    loc: `/contents/${c.id}`,
    lastmod: toIso(c.date),
    changefreq: 'monthly',
    priority: '0.6',
}));

const memberEntries: SitemapEntry[] = members.map((m) => ({
    loc: `/${m.memberType === 'core' ? 'team' : 'contributors'}/${m.id}`,
    changefreq: 'monthly',
    priority: '0.5',
}));

const allEntries = [...staticRoutes, ...contentEntries, ...memberEntries];

const sitemapXml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    allEntries
        .map(
            (e) =>
                `  <url>\n    <loc>${SITE_URL}${e.loc}</loc>\n` +
                (e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : '') +
                `    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
        )
        .join('\n') +
    '\n</urlset>\n';

writeFileSync(join(DIST, 'sitemap.xml'), sitemapXml);

// ── 2) HTML shell 생성 ──────────────────────────────────────
const template = readFileSync(join(DIST, 'index.html'), 'utf8');

function setMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
    const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
    if (re.test(html)) return html.replace(re, `$1${escAttr(content)}$2`);
    return html.replace('</head>', `    <meta ${attr}="${key}" content="${escAttr(content)}" />\n  </head>`);
}

interface ShellOptions {
    title: string;
    description: string;
    url: string;
    image: string;
    type: 'article' | 'profile';
    publishedTime?: string;
    author?: string;
    jsonLd: object[];
    bodyHtml: string;
}

function buildShell(o: ShellOptions): string {
    const fullTitle = `${o.title} | ${SITE_NAME}`;
    let html = template;
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(fullTitle)}</title>`);
    html = setMeta(html, 'name', 'description', o.description);
    html = setMeta(html, 'property', 'og:title', fullTitle);
    html = setMeta(html, 'property', 'og:description', o.description);
    html = setMeta(html, 'property', 'og:url', o.url);
    html = setMeta(html, 'property', 'og:type', o.type);
    html = setMeta(html, 'property', 'og:image', o.image);
    html = setMeta(html, 'name', 'twitter:title', fullTitle);
    html = setMeta(html, 'name', 'twitter:description', o.description);
    html = setMeta(html, 'name', 'twitter:image', o.image);
    html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escAttr(o.url)}" />`);

    const extra: string[] = [];
    if (o.publishedTime) extra.push(`<meta property="article:published_time" content="${escAttr(o.publishedTime)}" />`);
    if (o.author) extra.push(`<meta property="article:author" content="${escAttr(o.author)}" />`);
    extra.push(`<script type="application/ld+json">${JSON.stringify(o.jsonLd)}</script>`);
    html = html.replace('</head>', `    ${extra.join('\n    ')}\n  </head>`);

    html = html.replace('<div id="root"></div>', `<div id="root">${o.bodyHtml}</div>`);
    return html;
}

function writePage(routePath: string, html: string) {
    const dir = join(DIST, routePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
}

// 콘텐츠 상세
let contentPages = 0;
for (const item of contents) {
    const url = `${SITE_URL}/contents/${item.id}`;
    let body = '';
    if (item.html) {
        body = toPlainText(item.html);
    } else {
        const mdPath = join(ARTICLES, `${item.id}.md`);
        if (existsSync(mdPath)) body = toPlainText(readFileSync(mdPath, 'utf8'));
    }
    const bodyHtml =
        `<article>` +
        `<h1>${esc(item.title)}</h1>` +
        `<p>${esc(item.author)} · ${esc(item.date)} · ${esc(item.category)}</p>` +
        `<p>${esc(item.summary)}</p>` +
        (body ? `<div>${esc(body)}</div>` : '') +
        `<p><a href="/contents">← Contents</a></p>` +
        `</article>`;

    const html = buildShell({
        title: item.title,
        description: item.summary || item.title,
        url,
        image: item.thumbnailUrl ? (/^https?:/.test(item.thumbnailUrl) ? item.thumbnailUrl : `${SITE_URL}${item.thumbnailUrl}`) : DEFAULT_IMAGE,
        type: 'article',
        publishedTime: toIso(item.date),
        author: item.author,
        jsonLd: [
            articleLd(item),
            breadcrumbLd([
                { name: 'Home', url: '/' },
                { name: 'Contents', url: '/contents' },
                { name: item.title, url: `/contents/${item.id}` },
            ]),
        ],
        bodyHtml,
    });
    writePage(`contents/${item.id}`, html);
    contentPages++;
}

// 멤버 상세
let memberPages = 0;
for (const m of members) {
    const base = m.memberType === 'core' ? 'team' : 'contributors';
    const url = `${SITE_URL}/${base}/${m.id}`;
    const desc = `${m.role} · ${(m.bio ?? '').toString()}`.trim().slice(0, 200);
    const bodyHtml =
        `<article>` +
        `<h1>${esc(m.name)}</h1>` +
        `<p>${esc(m.role)}${m.period ? ` · ${esc(m.period)}` : ''}</p>` +
        (m.bio ? `<p>${esc(m.bio)}</p>` : '') +
        `<p><a href="/${base}">← ${base === 'team' ? 'Core Team' : 'Contributors'}</a></p>` +
        `</article>`;

    const html = buildShell({
        title: m.name,
        description: desc,
        url,
        image: m.avatarUrl ? (/^https?:/.test(m.avatarUrl) ? m.avatarUrl : `${SITE_URL}${m.avatarUrl}`) : DEFAULT_IMAGE,
        type: 'profile',
        jsonLd: [
            personLd(m),
            breadcrumbLd([
                { name: 'Home', url: '/' },
                { name: base === 'team' ? 'Core Team' : 'Contributors', url: `/${base}` },
                { name: m.name, url: `/${base}/${m.id}` },
            ]),
        ],
        bodyHtml,
    });
    writePage(`${base}/${m.id}`, html);
    memberPages++;
}

// ── 3) llms.txt ────────────────────────────────────────────
const recent = [...contents]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 80);

const llms =
    `# ${SITE_NAME}\n\n` +
    `> ECK(Ethereum Collective Korea)는 한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다. ` +
    `이더리움 리서치, 뉴스, 주간 리포트, 커뮤니티 이니셔티브를 제공합니다.\n\n` +
    `Site: ${SITE_URL}\nLanguage: Korean (ko), English (en)\n\n` +
    `## Sections\n` +
    `- [About](${SITE_URL}/about): 미션과 비전\n` +
    `- [Contents](${SITE_URL}/contents): 리서치·뉴스·주간 리포트 (${contents.length}건)\n` +
    `- [Core Team](${SITE_URL}/team): 코어팀 멤버\n` +
    `- [Contributors](${SITE_URL}/contributors): 기여자\n` +
    `- [Ecosystem](${SITE_URL}/ecosystem): 이더리움 생태계\n` +
    `- [Events](${SITE_URL}/events): 이벤트\n\n` +
    `## Recent Contents\n` +
    recent
        .map((c) => `- [${c.title}](${SITE_URL}/contents/${c.id})${c.summary ? `: ${c.summary.slice(0, 120)}` : ''}`)
        .join('\n') +
    '\n';

writeFileSync(join(DIST, 'llms.txt'), llms);

// ── 요약 출력 ───────────────────────────────────────────────
console.log(
    `[generate-seo] sitemap: ${allEntries.length} urls · content shells: ${contentPages} · member shells: ${memberPages} · llms.txt: ${recent.length} entries`,
);
