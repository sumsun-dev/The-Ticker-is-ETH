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
import {
    articleLd,
    personLd,
    breadcrumbLd,
    faqLd,
    collectionPageLd,
    SITE_URL,
} from '../src/utils/structuredData';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const DATA = join(ROOT, 'src/data');
const ARTICLES = join(DATA, 'articles');
const SITE_NAME = 'ECK — Ethereum Collective Korea';
const DEFAULT_IMAGE = `${SITE_URL}/assets/eck-og.png`;
const BODY_MAX = 20000;

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
        // Keep image alt text (drop only the URL) so image-only posts still
        // contribute crawlable text to the shell.
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
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
const ethNews = readJson<{ fetchedAt: string; items: Array<{ title: string; url: string; summary?: string }> }>(
    join(DATA, 'eth-news-inbox.json'),
);
const ethDigests = readJson<{
    digests: Array<{
        date: string;
        title: string;
        intro: string;
        sections: Array<{ heading: string; items: Array<{ title: string; summary: string; url: string; source: string }> }>;
    }>;
}>(join(DATA, 'eth-digests.json'));
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
    { loc: '/news', changefreq: 'daily', priority: '0.8' },
    { loc: '/debates', changefreq: 'weekly', priority: '0.7' },
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

// NOTE: user-derived strings go through function replacements — a literal
// replacement string would corrupt output on `$&`/`$'` sequences in titles.
function setMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
    const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
    if (re.test(html)) return html.replace(re, (_m, p1: string, p2: string) => `${p1}${escAttr(content)}${p2}`);
    return html.replace('</head>', () => `    <meta ${attr}="${key}" content="${escAttr(content)}" />\n  </head>`);
}

interface ShellOptions {
    title: string;
    description: string;
    url: string;
    image: string;
    type: 'article' | 'profile' | 'website';
    publishedTime?: string;
    author?: string;
    jsonLd: object[];
    bodyHtml: string;
}

function buildShell(o: ShellOptions): string {
    const fullTitle = o.title ? `${o.title} | ${SITE_NAME}` : SITE_NAME;
    let html = template;
    html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(fullTitle)}</title>`);
    html = setMeta(html, 'name', 'description', o.description);
    html = setMeta(html, 'property', 'og:title', fullTitle);
    html = setMeta(html, 'property', 'og:description', o.description);
    html = setMeta(html, 'property', 'og:url', o.url);
    html = setMeta(html, 'property', 'og:type', o.type);
    html = setMeta(html, 'property', 'og:image', o.image);
    html = setMeta(html, 'name', 'twitter:title', fullTitle);
    html = setMeta(html, 'name', 'twitter:description', o.description);
    html = setMeta(html, 'name', 'twitter:image', o.image);
    html = html.replace(/<link rel="canonical"[^>]*>/, () => `<link rel="canonical" href="${escAttr(o.url)}" />`);

    const extra: string[] = [];
    if (o.publishedTime) extra.push(`<meta property="article:published_time" content="${escAttr(o.publishedTime)}" />`);
    if (o.author) extra.push(`<meta property="article:author" content="${escAttr(o.author)}" />`);
    extra.push(`<script type="application/ld+json">${JSON.stringify(o.jsonLd)}</script>`);
    html = html.replace('</head>', () => `    ${extra.join('\n    ')}\n  </head>`);

    html = html.replace('<div id="root"></div>', () => `<div id="root">${o.bodyHtml}</div>`);
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

// ── 2.5) 정적 페이지 shell (홈 + 핵심 페이지) ───────────────
const sortedContents = [...contents].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

const liLink = (href: string, label: string) => `<li><a href="${escAttr(href)}">${esc(label)}</a></li>`;
const ul = (items: string[]) => `<ul>${items.join('')}</ul>`;

const recentLinks = ul(sortedContents.slice(0, 24).map((c) => liLink(`/contents/${c.id}`, c.title)));
const coreLinks = ul(mockMembers.map((m) => liLink(`/team/${m.id}`, m.name)));
const contribLinks = ul(mockContributors.slice(0, 40).map((m) => liLink(`/contributors/${m.id}`, m.name)));

const ECK_FAQ = [
    {
        q: 'ECK(Ethereum Collective Korea)는 무엇인가요?',
        a: 'ECK는 한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다. 이더리움 리서치, 뉴스, 주간 리포트, 커뮤니티 이니셔티브를 한국어로 제공합니다.',
    },
    {
        q: '어떤 콘텐츠를 제공하나요?',
        a: '이더리움 관련 리서치, 단신(Short), 주간 리포트, 큐레이션 뉴스를 제공합니다. 모든 콘텐츠는 /contents 에서 볼 수 있습니다.',
    },
    {
        q: '누가 운영하나요?',
        a: '코어팀과 다수의 커뮤니티 기여자가 함께 운영합니다. 멤버는 /team 과 /contributors 에서 확인할 수 있습니다.',
    },
];

interface StaticPage {
    path: string;
    title: string;
    description: string;
    bodyHtml: string;
    jsonLd: object[];
}

const staticPages: StaticPage[] = [
    {
        path: '',
        title: '',
        description:
            'ECK(Ethereum Collective Korea)는 한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다. 이더리움 리서치, 뉴스, 주간 리포트를 한국어로 제공합니다.',
        bodyHtml:
            `<h1>Ethereum Collective Korea (ECK)</h1>` +
            `<p>한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다. 리서치, 뉴스, 주간 리포트, 커뮤니티 이니셔티브를 한국어로 제공합니다.</p>` +
            `<nav><a href="/about">About</a> · <a href="/contents">Contents</a> · <a href="/team">Core Team</a> · <a href="/contributors">Contributors</a> · <a href="/ecosystem">Ecosystem</a> · <a href="/events">Events</a></nav>` +
            `<h2>최근 콘텐츠</h2>${recentLinks}<p><a href="/contents">모든 콘텐츠 보기 →</a></p>`,
        jsonLd: [],
    },
    {
        path: 'about',
        title: 'About',
        description: 'ECK(Ethereum Collective Korea)의 미션과 비전 — 한국 이더리움 생태계를 위한 공공재.',
        bodyHtml:
            `<h1>About — Ethereum Collective Korea</h1>` +
            `<p>ECK는 한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다. 리서치와 콘텐츠로 이더리움 지식을 한국어로 전하고, 커뮤니티 기여자들과 함께 생태계를 키웁니다.</p>` +
            `<h2>자주 묻는 질문</h2>` +
            ECK_FAQ.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') +
            `<p><a href="/contents">콘텐츠 보기</a> · <a href="/team">팀 보기</a></p>`,
        jsonLd: [faqLd(ECK_FAQ)],
    },
    {
        path: 'contents',
        title: 'Contents',
        description: `이더리움 리서치, 뉴스, 주간 리포트 ${contents.length}건. Ethereum Collective Korea가 한국어로 큐레이션합니다.`,
        bodyHtml:
            `<h1>Contents</h1>` +
            `<p>이더리움 리서치, 단신, 주간 리포트, 뉴스 등 총 ${contents.length}건의 콘텐츠를 제공합니다.</p>` +
            `<h2>최근 콘텐츠</h2>${recentLinks}`,
        jsonLd: [
            collectionPageLd({
                name: 'Contents',
                url: '/contents',
                description: '이더리움 리서치·뉴스·주간 리포트',
                items: sortedContents.slice(0, 50).map((c) => ({ name: c.title, url: `/contents/${c.id}` })),
            }),
        ],
    },
    {
        path: 'news',
        title: 'Ethereum News',
        description: ethDigests.digests[0]
            ? `${ethDigests.digests[0].date} 데일리 다이제스트 — ${ethDigests.digests[0].title}`
            : '이더리움 공식 블로그·리서치 포럼·핵심 트위터·커뮤니티 소식을 매일 한국어 다이제스트로 정리합니다.',
        bodyHtml:
            `<h1>Ethereum News</h1>` +
            `<p>이더리움 공식 블로그, 리서치 포럼(ethresear.ch, Ethereum Magicians), 핵심 트위터 계정, 커뮤니티 소식을 매일 수집해 한국어 다이제스트로 정리합니다.</p>` +
            ethDigests.digests.slice(0, 3).map((d) =>
                `<h2>${esc(d.date)} — ${esc(d.title)}</h2><p>${esc(d.intro)}</p>` +
                d.sections.map((s) =>
                    `<h3>${esc(s.heading)}</h3><ul>` +
                    s.items.map((it) => `<li><a href="${escAttr(it.url)}">${esc(it.title)}</a> (${esc(it.source)}) — ${esc(it.summary)}</li>`).join('') +
                    `</ul>`,
                ).join(''),
            ).join(''),
        jsonLd: [
            collectionPageLd({
                name: 'Ethereum News',
                url: '/news',
                description: '이더리움 소식 데일리 한국어 다이제스트',
                items: (ethDigests.digests[0]?.sections ?? [])
                    .flatMap((s) => s.items)
                    .map((it) => ({ name: it.title, url: it.url })),
            }),
        ],
    },
    {
        path: 'team',
        title: 'Core Team',
        description: 'Ethereum Collective Korea 코어팀 멤버 소개.',
        bodyHtml: `<h1>Core Team</h1><p>ECK 코어팀 멤버입니다.</p>${coreLinks}`,
        jsonLd: [
            collectionPageLd({
                name: 'Core Team',
                url: '/team',
                description: 'ECK 코어팀',
                items: mockMembers.map((m) => ({ name: m.name, url: `/team/${m.id}` })),
            }),
        ],
    },
    {
        path: 'contributors',
        title: 'Contributors',
        description: 'Ethereum Collective Korea 커뮤니티 기여자 목록.',
        bodyHtml: `<h1>Contributors</h1><p>ECK 커뮤니티에 기여하는 분들입니다.</p>${contribLinks}`,
        jsonLd: [
            collectionPageLd({
                name: 'Contributors',
                url: '/contributors',
                description: 'ECK 기여자',
                items: mockContributors.slice(0, 100).map((m) => ({ name: m.name, url: `/contributors/${m.id}` })),
            }),
        ],
    },
    {
        path: 'ecosystem',
        title: 'Ecosystem',
        description: '한국 이더리움 생태계 — 프로젝트, 팀, 커뮤니티를 탐색합니다.',
        bodyHtml: `<h1>Ecosystem</h1><p>한국 이더리움 생태계의 프로젝트와 팀, 커뮤니티를 소개합니다.</p>`,
        jsonLd: [],
    },
    {
        path: 'events',
        title: 'Events',
        description: 'Ethcon Korea 등 이더리움 이벤트 일정과 소식.',
        bodyHtml: `<h1>Events</h1><p>Ethcon Korea를 비롯한 이더리움 이벤트 소식을 전합니다.</p>`,
        jsonLd: [],
    },
];

let staticPagesCount = 0;
for (const sp of staticPages) {
    const fullUrl = sp.path === '' ? `${SITE_URL}/` : `${SITE_URL}/${sp.path}`;
    const html = buildShell({
        title: sp.title,
        description: sp.description,
        url: fullUrl,
        image: DEFAULT_IMAGE,
        type: 'website',
        jsonLd: sp.jsonLd,
        bodyHtml: sp.bodyHtml,
    });
    if (sp.path === '') writeFileSync(join(DIST, 'index.html'), html);
    else writePage(sp.path, html);
    staticPagesCount++;
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
    `- [Ethereum News](${SITE_URL}/news): 이더리움 최신 소식 데일리 피드 (${ethNews.items.length}건)\n` +
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

// llms-full.txt: 전체 콘텐츠 인덱스(제목·URL·요약) — GEO 심화
const llmsFull =
    `# ${SITE_NAME} — 전체 콘텐츠 인덱스\n\n` +
    `> 전체 ${sortedContents.length}건. 각 항목 본문은 해당 URL에서 확인하세요.\n\n` +
    sortedContents
        .map(
            (c) =>
                `## ${c.title}\n${SITE_URL}/contents/${c.id}\n${c.author} · ${c.date} · ${c.category}\n${(c.summary || '').slice(0, 300)}\n`,
        )
        .join('\n');
writeFileSync(join(DIST, 'llms-full.txt'), llmsFull);

// ── 4) RSS 2.0 (dist/feed.xml) ─────────────────────────────
function toRfc822(date: string): string {
    const iso = date.includes('-') ? date : date.replace(/\./g, '-');
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toUTCString();
}

const feedItems = recent.slice(0, 50);
const rss =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
    '  <channel>\n' +
    `    <title>${esc(SITE_NAME)}</title>\n` +
    `    <link>${SITE_URL}/contents</link>\n` +
    `    <description>이더리움 리서치, 뉴스, 주간 리포트 — Ethereum Collective Korea</description>\n` +
    '    <language>ko</language>\n' +
    `    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />\n` +
    (feedItems[0]?.date ? `    <lastBuildDate>${toRfc822(feedItems[0].date)}</lastBuildDate>\n` : '') +
    feedItems
        .map((c) => {
            const link = `${SITE_URL}/contents/${c.id}`;
            const pub = toRfc822(c.date);
            return (
                '    <item>\n' +
                `      <title>${esc(c.title)}</title>\n` +
                `      <link>${link}</link>\n` +
                `      <guid isPermaLink="true">${link}</guid>\n` +
                (pub ? `      <pubDate>${pub}</pubDate>\n` : '') +
                (c.author ? `      <dc:creator>${esc(c.author)}</dc:creator>\n` : '') +
                (c.category ? `      <category>${esc(c.category)}</category>\n` : '') +
                `      <description>${esc(c.summary)}</description>\n` +
                '    </item>'
            );
        })
        .join('\n') +
    '\n  </channel>\n</rss>\n';

writeFileSync(join(DIST, 'feed.xml'), rss);

// ── 요약 출력 ───────────────────────────────────────────────
console.log(
    `[generate-seo] sitemap: ${allEntries.length} urls · static: ${staticPagesCount} · content shells: ${contentPages} · member shells: ${memberPages} · llms.txt: ${recent.length} · llms-full: ${sortedContents.length} · rss: ${feedItems.length}`,
);
