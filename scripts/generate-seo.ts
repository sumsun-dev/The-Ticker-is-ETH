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
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockMembers, mockContributors } from '../src/data/mockData';
import {
    articleLd,
    personLd,
    breadcrumbLd,
    faqLd,
    collectionPageLd,
    videoObjectLd,
    ek1GenesisEventLd,
    SITE_URL,
} from '../src/utils/structuredData';
// 노출 판정은 사이트와 같은 함수를 써야 SEO와 화면이 어긋나지 않는다
import { isPublishable, participantCount } from '../src/utils/debates';
import { inclusionLabel, inclusionOf } from '../src/utils/eips';
import type { EipsFile } from '../src/data/eipsData';
import type { ErcsFile } from '../src/data/ercsData';
import { FORKS as FORKS_KO } from '../src/data/forks';
import { NORTH_STARS as NORTH_STARS_KO, ROADMAP_ITEMS as ROADMAP_ITEMS_KO, STRAWMAP_FORKS as STRAWMAP_FORKS_KO, STRAWMAP_UPDATED, itemSlug } from '../src/data/roadmap';
import type { RoadmapExplainersFile } from '../src/data/roadmapExplainers';
import { ITEM_PILLAR, PILLARS as PILLARS_KO, ROADMAP_HISTORY as ROADMAP_HISTORY_KO } from '../src/data/roadmapHistory';
import type { CallRecord } from '../src/data/ethCallsData';
import type { Debate } from '../src/data/ethDebatesData';
import {
    VIDEO_LANGS,
    embedUrl,
    localizeVideo,
    maxThumbUrl,
    videoLdInput,
    videoPagePath,
    watchUrl,
    type VideoDetails,
    type VideoItem,
} from '../src/data/videoData';
import { parseSpeaker } from '../src/utils/youtubeDescription';
import { GENESIS_SESSIONS as GENESIS_SESSIONS_KO } from '../src/data/ek1GenesisData';
import { DEVCON8_IMAGES, DEVCON8_NEWS as DEVCON8_NEWS_KO, DEVCON8_TALKS as DEVCON8_TALKS_KO } from '../src/data/devcon8Data';
import { callLabel } from '../src/utils/calls';
import { PAST_EVENTS } from '../src/data/pastEvents';
import { collectKo, hashKo, localize, type Dict } from '../src/utils/localize';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const DATA = join(ROOT, 'src/data');
const ARTICLES = join(DATA, 'articles');
const SITE_NAME = 'ECK — Ethereum Collective Korea';
const DEFAULT_IMAGE = `${SITE_URL}/assets/eck-og.png`;
const BODY_MAX = 20000;

/**
 * 언어: `SEO_LANG=en` 으로 한 번 더 돌리면 영어판을 dist/en 아래에 쓴다 (주소는 /en/...).
 * 영어 본문은 한국어 데이터에 사전(src/data/en, scripts/translate-en.ts)을 입혀 만든다.
 * 커뮤니티 글(/contents/:id)과 멤버 페이지는 한국어 원문뿐이라 영어판을 만들지 않는다.
 */
const EN = process.env.SEO_LANG === 'en';
const LANG = EN ? 'en' : 'ko';
const EN_PREFIX = '/en';
const OUT = EN ? join(DIST, 'en') : DIST;
/** 스크립트에 직접 적는 문구: 두 언어를 한자리에 */
const T = (ko: string, en: string) => (EN ? en : ko);
const dictCache = new Map<string, Dict>();
function dictOf(name: string): Dict {
    if (!dictCache.has(name)) {
        const file = join(DATA, 'en', `${name}.json`);
        dictCache.set(name, existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Dict) : {});
    }
    return dictCache.get(name)!;
}
/** 영어판이면 사전을 입힌다 */
const loc = <V>(value: V, name: string): V => (EN ? localize(value, dictOf(name)) : value);
/** 영어판에서는 옮긴 제목이 원문 제목과 같을 수 있다. 그러면 괄호로 한 번 더 적지 않는다 */
const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/**
 * 이 글의 영어판이 준비됐는가: 글에 든 한국어 문장이 모두 사전에 있어야 한다. 하나라도 없으면 한국어가 섞이므로 영어 shell 을 만들지 않는다.
 * 한국어 실행(원문)과 영어 실행(사전을 입힌 뒤 남은 한국어)이 같은 답을 내므로 hreflang 짝이 맞는다
 */
const enReady = (value: unknown, name: string) => [...collectKo(value)].every((s) => dictOf(name)[hashKo(s)]);
const FORKS = loc(FORKS_KO, 'forks');
const NORTH_STARS = loc(NORTH_STARS_KO, 'roadmap');
const ROADMAP_ITEMS = loc(ROADMAP_ITEMS_KO, 'roadmap');
const STRAWMAP_FORKS = loc(STRAWMAP_FORKS_KO, 'roadmap');
const PILLARS = loc(PILLARS_KO, 'roadmapHistory');
const ROADMAP_HISTORY = loc(ROADMAP_HISTORY_KO, 'roadmapHistory');
const GENESIS_SESSIONS = loc(GENESIS_SESSIONS_KO, 'ek1GenesisData');
const DEVCON8_NEWS = loc(DEVCON8_NEWS_KO, 'devcon8Data');
const DEVCON8_TALKS = loc(DEVCON8_TALKS_KO, 'devcon8Data');

// ── helpers ────────────────────────────────────────────────
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s = '') => esc(s).replace(/"/g, '&quot;');
/** <script> 안에 넣는 JSON. 외부(YouTube 설명란 등) 문자열의 </script> 탈출을 막는다 */
const toJsonLd = (data: unknown) =>
    JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
/** 메타·llms 한 줄용: 개행을 공백으로 */
const oneLine = (s = '') => s.replace(/\s+/g, ' ').trim();
/** 서로게이트 쌍을 자르지 않는 앞부분 */
const head = (s: string, n: number) => Array.from(s).slice(0, n).join('');

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
const videoItems = readJson<VideoItem[]>(join(DATA, 'videos.json'));
const videoDetails = readJson<VideoDetails>(join(DATA, 'video-details.json'));
/** shell·JSON-LD는 그 판의 언어로 쓰고, 다른 언어 제목은 alternateName으로 붙인다 */
const videos = EN ? videoItems.map((v) => ({ ...localizeVideo(v, 'en'), alternateName: v.text.ko.title })) : videoItems.map(videoLdInput);
type ShellVideo = (typeof videos)[number];
const SPOKEN_LABEL = { ko: T('한국어 진행', 'In Korean'), en: T('영어 진행', 'In English') } as const;
const ethDigests = loc(readJson<{
    digests: Array<{
        date: string;
        title: string;
        intro: string;
        sections: Array<{ heading: string; items: Array<{ title: string; summary: string; url: string; source: string }> }>;
    }>;
}>(join(DATA, 'eth-digests.json')), 'eth-digests');
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
// 논쟁 아카이브. 사이트에 노출되는 것만 shell·sitemap 대상으로 삼는다
// (참여 인원 기준 또는 오너가 DM으로 정한 publish. src/utils/debates.ts의 isPublishable과 같은 판정)
const allDebates = loc(readJson<{ debates: Debate[] }>(join(DATA, 'eth-debates.json')), 'eth-debates').debates;
const debates = allDebates
    .filter(isPublishable)
    .sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''));

// EIP 해설 (scripts/extract-eips.ts). 상태 배지는 화면처럼 콜 기록에서 계산한다
const eips = loc(readJson<EipsFile>(join(DATA, 'eips.json')), 'eips').eips.sort((a, b) => b.number - a.number);
const ethCalls = loc(readJson<{ calls: CallRecord[] }>(join(DATA, 'eth-calls.json')), 'eth-calls').calls;
// 화면 글과 같은 문구를 쓴다
const eventsKo = readJson<{ locations: Record<string, string>; descriptions: Record<string, string> }>(join(ROOT, `src/i18n/${LANG}/events.json`));
const ecoKo = readJson<{ ecosystem: { description: string; categories: Record<string, string>; tools: Record<string, string>; twitter: Record<string, string> } }>(
    join(ROOT, `src/i18n/${LANG}/ecosystem.json`),
).ecosystem;
const eco = readJson<{
    categories: { id: string }[];
    tools: { id: string; name: string; url: string; category: string }[];
    twitterAccounts: { id: string; name: string; handle: string; url: string }[];
}>(join(DATA, 'ecosystem-tools.json'));
const efMandate = loc(readJson<{
    meta: { published: string; originalUrl: string; blogUrl: string };
    lead: string;
    keyIdeas: { title: string; body: string }[];
    sections: { numeral: string; titleEn: string; titleKo: string; summary: string; points: string[] }[];
    principles: { technical: { name: string; body: string }[]; social: { name: string; body: string }[] };
    quandaries: { question: string; answer: string }[];
    glossary: { term: string; body: string }[];
}>(join(DATA, 'ef-mandate.json')), 'ef-mandate');
const roadmapEx = loc(readJson<RoadmapExplainersFile>(join(DATA, 'roadmap-explainers.json')), 'roadmap-explainers');
const topicItems = ROADMAP_ITEMS.filter((it) => roadmapEx.topics[itemSlug(it)]);
// ERC 해설 (scripts/extract-ercs.ts)
const ercs = loc(readJson<ErcsFile>(join(DATA, 'ercs.json')), 'ercs').ercs.sort((a, b) => a.number - b.number);

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
    { loc: '/calls', changefreq: 'weekly', priority: '0.7' },
    { loc: '/eips', changefreq: 'weekly', priority: '0.7' },
    { loc: '/ercs', changefreq: 'weekly', priority: '0.7' },
    { loc: '/roadmap', changefreq: 'monthly', priority: '0.7' },
    { loc: '/forks', changefreq: 'monthly', priority: '0.7' },
    { loc: '/team', changefreq: 'monthly', priority: '0.7' },
    { loc: '/ecosystem', changefreq: 'monthly', priority: '0.7' },
    { loc: '/events', changefreq: 'weekly', priority: '0.7' },
    { loc: '/events/ek1-genesis', changefreq: 'monthly', priority: '0.6' },
    { loc: '/events/devcon-8', changefreq: 'monthly', priority: '0.6' },
    { loc: '/ef-mandate', changefreq: 'monthly', priority: '0.6' },
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

const debateEntries: SitemapEntry[] = debates.map((d) => ({
    loc: `/debates/${d.id}`,
    lastmod: toIso(d.lastActivity),
    changefreq: 'weekly',
    priority: '0.6',
}));

const videoEntries: SitemapEntry[] = videos.map((v) => ({
    loc: videoPagePath(v.id),
    lastmod: new Date(v.uploadDate).toISOString().slice(0, 10),
    changefreq: 'monthly',
    priority: '0.6',
}));

const eipEntries: SitemapEntry[] = eips.map((e) => ({
    loc: `/eips/${e.number}`,
    lastmod: toIso(e.generatedAt),
    changefreq: 'weekly',
    priority: '0.6',
}));

const ercEntries: SitemapEntry[] = ercs.map((e) => ({
    loc: `/ercs/${e.number}`,
    lastmod: toIso(e.generatedAt),
    changefreq: 'monthly',
    priority: '0.6',
}));

const forkEntries: SitemapEntry[] = FORKS.map((f) => ({ loc: `/forks/${f.slug}`, changefreq: f.date ? 'yearly' : 'weekly', priority: '0.6' }));

const topicEntries: SitemapEntry[] = topicItems.map((it) => ({ loc: `/roadmap/${itemSlug(it)}`, changefreq: 'monthly', priority: '0.5' }));
// 화면과 같이 정리본(full)만 싣는다
const fullCalls = ethCalls.filter((c) => c.kind === 'full').sort((a, b) => b.date.localeCompare(a.date));
const callTitle = (c: CallRecord) => `${callLabel(c)} · ${oneLine(c.headline ?? c.title)}`;
const callEntries: SitemapEntry[] = fullCalls.map((c) => ({ loc: `/calls/${c.id}`, lastmod: toIso(c.date), changefreq: 'monthly', priority: '0.6' }));
const allEntries = [...staticRoutes, ...contentEntries, ...videoEntries, ...memberEntries, ...debateEntries, ...callEntries, ...eipEntries, ...ercEntries, ...forkEntries, ...topicEntries];

/** 영어 shell 이 있는 경로: 정적 페이지·영상(이미 두 언어)과, 글 전체가 번역된 상세 페이지 */
const enPaths = new Set<string>([
    ...staticRoutes.map((r) => r.loc),
    ...videoEntries.map((v) => v.loc),
    ...debates.filter((d) => enReady(d, 'eth-debates')).map((d) => `/debates/${d.id}`),
    ...eips.filter((e) => enReady(e, 'eips')).map((e) => `/eips/${e.number}`),
    ...ercs.filter((e) => enReady(e, 'ercs')).map((e) => `/ercs/${e.number}`),
    ...FORKS.filter((f) => enReady(f, 'forks') && enReady(roadmapEx.forks[f.slug], 'roadmap-explainers')).map((f) => `/forks/${f.slug}`),
    ...topicItems.filter((it) => enReady(roadmapEx.topics[itemSlug(it)], 'roadmap-explainers')).map((it) => `/roadmap/${itemSlug(it)}`),
    ...fullCalls.filter((c) => enReady(c, 'eth-calls')).map((c) => `/calls/${c.id}`),
]);

// ── 2) HTML shell 생성 ──────────────────────────────────────
// 빌드가 만든 틀은 따로 보관해 두고 읽는다. 홈 shell 이 dist/index.html 을 덮어쓰므로, 영어판 실행이나 다시 돌린 실행이 채워진 홈을 틀로 쓰지 않게 한다
const TEMPLATE_FILE = join(DIST, 'seo-template.html');
if (!existsSync(TEMPLATE_FILE)) copyFileSync(join(DIST, 'index.html'), TEMPLATE_FILE);
const template = readFileSync(TEMPLATE_FILE, 'utf8');
/** 이번 실행이 shell 을 쓴 경로 (sitemap 은 이것만 싣는다) */
const written = new Set<string>();

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
    type: 'article' | 'profile' | 'website' | 'video.other';
    /** og:video (임베드 URL) */
    video?: string;
    publishedTime?: string;
    author?: string;
    jsonLd: object[];
    bodyHtml: string;
    /** 영어판 짝이 있는가 (기본 있음). 없으면 hreflang 에 영어를 싣지 않는다 */
    en?: boolean;
}

/** 한국어 주소 → 영어 주소 */
const enUrl = (koUrl: string) => `${SITE_URL}${EN_PREFIX}${koUrl.slice(SITE_URL.length).replace(/^\/$/, '')}`;
/** 영어 shell 이 있는 주소만 /en 주소로 바꾼다. 없는 주소(커뮤니티 글·멤버·아직 번역되지 않은 글·그림)는 그대로 둔다: /en 으로 걸면 홈 shell 이 나간다 */
const toEnPath = (path: string) => (enPaths.has(path.split(/[?#]/)[0].replace(/(.)\/$/, '$1')) ? `${EN_PREFIX}${path === '/' ? '' : path}` : path);

function buildShell(o: ShellOptions): string {
    const fullTitle = o.title ? `${o.title} | ${SITE_NAME}` : SITE_NAME;
    let html = template;
    html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(fullTitle)}</title>`);
    html = setMeta(html, 'name', 'description', o.description);
    html = setMeta(html, 'property', 'og:title', fullTitle);
    html = setMeta(html, 'property', 'og:description', o.description);
    html = setMeta(html, 'property', 'og:type', o.type);
    html = setMeta(html, 'property', 'og:image', o.image);
    html = setMeta(html, 'name', 'twitter:title', fullTitle);
    html = setMeta(html, 'name', 'twitter:description', o.description);
    html = setMeta(html, 'name', 'twitter:image', o.image);
    // 호출하는 쪽은 한국어 주소를 넘긴다. 영어판은 여기서 /en 주소로 바꾼다
    const koUrl = o.url;
    const selfUrl = EN ? enUrl(koUrl) : koUrl;
    html = setMeta(html, 'property', 'og:url', selfUrl);
    html = html.replace(/<link rel="canonical"[^>]*>/, () => `<link rel="canonical" href="${escAttr(selfUrl)}" />`);
    // hreflang: 한국어 주소와 영어 주소를 짝짓는다. 영어판이 없는 글은 영어 줄을 뺀다
    html = html.replace(/(<link rel="alternate" hreflang=")([^"]+)(" href=")[^"]*(")/g, (_m, p1: string, lang: string, p3: string, p4: string) => `${p1}${lang}${p3}${escAttr(lang === 'en' ? enUrl(koUrl) : koUrl)}${p4}`);
    if (o.en === false) html = html.replace(/\s*<link rel="alternate" hreflang="en"[^>]*>/, '');
    if (EN) {
        html = html.replace('<html lang="ko"', '<html lang="en"');
        html = setMeta(html, 'property', 'og:locale', 'en_US');
        html = setMeta(html, 'property', 'og:locale:alternate', 'ko_KR');
        // 틀에 박힌 Organization·WebSite 설명
        html = html.replace('ECK(Ethereum Collective Korea)는 한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다.', 'ECK (Ethereum Collective Korea) is a nonprofit collective building public goods for the Ethereum ecosystem in Korea.').replace('"inLanguage":"ko-KR"', '"inLanguage":"en"');
    }

    const extra: string[] = [];
    if (o.publishedTime) extra.push(`<meta property="article:published_time" content="${escAttr(o.publishedTime)}" />`);
    if (o.author) extra.push(`<meta property="article:author" content="${escAttr(o.author)}" />`);
    if (o.video) {
        extra.push(`<meta property="og:video" content="${escAttr(o.video)}" />`);
        extra.push(`<meta property="og:video:secure_url" content="${escAttr(o.video)}" />`);
        extra.push(`<meta property="og:video:type" content="text/html" />`);
    }
    const ld = toJsonLd(o.jsonLd);
    extra.push(`<script type="application/ld+json">${EN ? ld.replace(new RegExp(`"${SITE_URL}(/[^"]*)"`, 'g'), (_m, path: string) => `"${SITE_URL}${toEnPath(path)}"`).replace(/"inLanguage":"ko-KR"/g, '"inLanguage":"en"') : ld}</script>`);
    html = html.replace('</head>', () => `    ${extra.join('\n    ')}\n  </head>`);

    // 영어판 본문의 사이트 안쪽 링크는 영어 주소로
    const body = EN ? o.bodyHtml.replace(/href="(\/[^"]*)"/g, (_m, path: string) => `href="${toEnPath(path)}"`) : o.bodyHtml;
    html = html.replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
    return html;
}

function writePage(routePath: string, html: string) {
    written.add(`/${routePath}`);
    const dir = join(OUT, routePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
}

// 콘텐츠 상세
let contentPages = 0;
for (const item of EN ? [] : contents) {
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
        en: false,
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

// 논쟁 상세
let debatePages = 0;
for (const d of debates) {
    const ready = enPaths.has(`/debates/${d.id}`);
    if (EN && !ready) continue;
    const url = `${SITE_URL}/debates/${d.id}`;
    const stanceLabel: Record<string, string> = { pro: T('찬성', 'For'), con: T('반대', 'Against'), neutral: T('중립', 'Neutral'), other: T('기타', 'Other') };
    const bodyHtml =
        `<article>` +
        `<h1>${esc(d.title)}</h1>` +
        `<p>${esc(d.category)} · ${T(`참여 ${participantCount(d)}명 · 인용 ${d.timeline.length}건`, `${participantCount(d)} participants · ${d.timeline.length} quotes`)} · ${esc(d.firstSeen)} ~ ${esc(d.lastActivity)}</p>` +
        `<p>${esc(d.summary)}</p>` +
        (d.background ? `<h2>${T('배경', 'Background')}</h2><p>${esc(d.background)}</p>` : '') +
        (d.whyItMatters ? `<h2>${T('왜 중요한가', 'Why it matters')}</h2><p>${esc(d.whyItMatters)}</p>` : '') +
        (d.resolution ? `<h2>${T('결론', 'Resolution')}</h2><p>${esc(d.resolution)}</p>` : '') +
        (d.keyPoints.length ? `<h2>${T('쟁점', 'Key points')}</h2><ul>${d.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : '') +
        d.positions
            .map(
                (p) =>
                    `<h2>${esc(stanceLabel[p.stance] ?? p.stance)} — ${esc(p.label)}</h2>` +
                    `<p>${esc(p.holders.map((h) => h.name || h.handle || '').filter(Boolean).join(', '))}</p>` +
                    `<ul>${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`,
            )
            .join('') +
        `<p><a href="/debates">← Debates</a></p>` +
        `</article>`;

    const html = buildShell({
        title: d.title,
        description: d.summary || d.title,
        url,
        image: DEFAULT_IMAGE,
        type: 'article',
        en: ready,
        publishedTime: toIso(d.firstSeen),
        jsonLd: [
            // 논쟁은 질문 하나에 입장이 갈리는 구조라 쟁점을 Q&A로 싣는다
            faqLd([
                { q: d.title, a: d.summary },
                ...d.keyPoints.map((k) => ({
                    q: k,
                    a: d.positions.map((p) => `${stanceLabel[p.stance] ?? p.stance}(${p.label}): ${p.points[0] ?? ''}`).join(' / '),
                })),
            ]),
            breadcrumbLd([
                { name: 'Home', url: '/' },
                { name: 'Debates', url: '/debates' },
                { name: d.title, url: `/debates/${d.id}` },
            ]),
        ],
        bodyHtml,
    });
    writePage(`debates/${d.id}`, html);
    debatePages++;
}

// EIP 해설 상세
let eipPages = 0;
for (const e of eips) {
    const path = `/eips/${e.number}`;
    const ready = enPaths.has(path);
    if (EN && !ready) continue;
    const inc = inclusionOf(ethCalls, e.number);
    const bodyHtml =
        `<article>` +
        `<h1>EIP-${e.number} ${esc(e.titleKo)}${sameTitle(e.titleKo, e.meta.title) ? '' : ` (${esc(e.meta.title)})`}</h1>` +
        `<p>${esc(inclusionLabel(inc, e.meta.status, EN))} · ${esc(e.topic)} · ${T('원문 상태', 'EIP status')} ${esc(e.meta.status)} · ${T(`${esc(e.meta.created)} 작성`, `created ${esc(e.meta.created)}`)}</p>` +
        `<p>${esc(e.summary)}</p>` +
        `<h2>${T('왜 필요한가', 'Why it is needed')}</h2><p>${esc(e.why)}</p>` +
        `<h2>${T('무엇이 바뀌나', 'What changes')}</h2><h3>${T('지금', 'Today')}</h3><ul>${e.before.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` +
        `<h3>${T(`EIP-${e.number} 이후`, `After EIP-${e.number}`)}</h3><ul>${e.after.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` +
        `<h2>${T('누구에게 영향이 있나', 'Who is affected')}</h2><ul>${e.impact.map((x) => `<li>${esc(x.who)}: ${esc(x.text)}</li>`).join('')}</ul>` +
        `<h2>${T('심층 설명', 'In depth')}</h2>${e.deep.map((d) => `<h3>${esc(d.title)}</h3><p>${esc(d.body)}</p>`).join('')}` +
        `<p><a href="https://eips.ethereum.org/EIPS/eip-${e.number}">${T('EIP 원문', 'Original EIP')}</a> · <a href="/eips">← EIPs</a></p>` +
        `</article>`;
    const html = buildShell({
        title: `EIP-${e.number} ${e.titleKo}`,
        description: e.summary,
        url: `${SITE_URL}${path}`,
        image: DEFAULT_IMAGE,
        type: 'article',
        en: ready,
        publishedTime: toIso(e.generatedAt),
        jsonLd: [
            faqLd([{ q: T(`EIP-${e.number}(${e.meta.title})는 무엇인가?`, `What is EIP-${e.number} (${e.meta.title})?`), a: e.summary }, { q: T(`EIP-${e.number}는 왜 필요한가?`, `Why is EIP-${e.number} needed?`), a: e.why }]),
            breadcrumbLd([
                { name: 'Home', url: '/' },
                { name: 'EIPs', url: '/eips' },
                { name: `EIP-${e.number}`, url: path },
            ]),
        ],
        bodyHtml,
    });
    writePage(`eips/${e.number}`, html);
    eipPages++;
}

// ERC 해설 상세
let ercPages = 0;
for (const e of ercs) {
    const path = `/ercs/${e.number}`;
    const ready = enPaths.has(path);
    if (EN && !ready) continue;
    const bodyHtml =
        `<article>` +
        `<h1>ERC-${e.number} ${esc(e.titleKo)}${sameTitle(e.titleKo, e.meta.title) ? '' : ` (${esc(e.meta.title)})`}</h1>` +
        `<p>${esc(e.meta.status)} · ${esc(e.topic)} · ${T(`${esc(e.meta.created)} 작성`, `created ${esc(e.meta.created)}`)}</p>` +
        `<p>${esc(e.summary)}</p>` +
        `<h2>${T('왜 필요한가', 'Why it is needed')}</h2><p>${esc(e.why)}</p>` +
        (e.iface.length ? `<h2>${T('구현해야 하는 것', 'What to implement')}</h2><ul>${e.iface.map((f) => `<li><code>${esc(f.sig)}</code>: ${esc(f.ko)}</li>`).join('')}</ul>` : '') +
        `<h2>${T('심층 설명', 'In depth')}</h2>${e.deep.map((d) => `<h3>${esc(d.title)}</h3><p>${esc(d.body)}</p>`).join('')}` +
        (e.safety.length ? `<h2>${T('쓸 때 주의할 점', 'Things to watch out for')}</h2><ul>${e.safety.map((w) => `<li>${esc(w.title)}: ${esc(w.body)}</li>`).join('')}</ul>` : '') +
        `<p><a href="https://ercs.ethereum.org/ERCS/erc-${e.number}">${T('ERC 원문', 'Original ERC')}</a> · <a href="/ercs">← ERCs</a></p>` +
        `</article>`;
    const html = buildShell({
        title: `ERC-${e.number} ${e.titleKo}`,
        description: e.summary,
        url: `${SITE_URL}${path}`,
        image: DEFAULT_IMAGE,
        type: 'article',
        en: ready,
        publishedTime: toIso(e.generatedAt),
        jsonLd: [
            faqLd([{ q: T(`ERC-${e.number}(${e.meta.title})는 무엇인가?`, `What is ERC-${e.number} (${e.meta.title})?`), a: e.summary }, { q: T(`ERC-${e.number}는 왜 필요한가?`, `Why is ERC-${e.number} needed?`), a: e.why }]),
            breadcrumbLd([
                { name: 'Home', url: '/' },
                { name: 'ERCs', url: '/ercs' },
                { name: `ERC-${e.number}`, url: path },
            ]),
        ],
        bodyHtml,
    });
    writePage(`ercs/${e.number}`, html);
    ercPages++;
}

// 하드포크 상세
const eipTitle = new Map(eips.map((e) => [e.number, e.titleKo]));
for (const f of FORKS) {
    const path = `/forks/${f.slug}`;
    const ready = enPaths.has(path);
    if (EN && !ready) continue;
    const list = [...(f.headliners ?? []), ...f.eips.filter((x) => !f.headliners?.some((h) => h.number === x.number))];
    const bodyHtml =
        `<article>` +
        `<h1>${esc(T(`${f.name} 하드포크`, `${f.name} hard fork`))}</h1>` +
        `<p>${esc([f.alias, f.date ? `${T('메인넷', 'Mainnet')} ${f.date}` : f.target].filter(Boolean).join(' · '))}</p>` +
        `<p>${esc(f.summary)}</p>` +
        (roadmapEx.forks[f.slug] ? `<h2>${f.date ? T('무엇이 달라졌나', 'What changed') : T('나에게 달라지는 것', 'What changes for you')}</h2><dl>${roadmapEx.forks[f.slug].impact.map((x) => `<dt>${esc(x.who)}</dt><dd>${esc(x.text)}</dd>`).join('')}</dl>` : '') +
        (list.length ? `<h2>${f.date ? T('주요 EIP', 'Key EIPs') : T('들어가는 EIP', 'EIPs included')}</h2><ul>${list.map((x) => `<li><a href="${eipTitle.has(x.number) ? `/eips/${x.number}` : `https://eips.ethereum.org/EIPS/eip-${x.number}`}">EIP-${x.number}</a> ${esc(eipTitle.get(x.number) ?? x.note)}</li>`).join('')}</ul>` : '') +
        `<p><a href="/forks">${T('← 하드포크', '← Hard forks')}</a> · <a href="/roadmap">${T('로드맵', 'Roadmap')}</a></p>` +
        `</article>`;
    writePage(
        `forks/${f.slug}`,
        buildShell({
            title: T(`${f.name} 하드포크`, `${f.name} hard fork`),
            description: f.summary,
            url: `${SITE_URL}${path}`,
            image: DEFAULT_IMAGE,
            type: 'article',
            en: ready,
            jsonLd: [
                faqLd([{ q: T(`이더리움 ${f.name} 하드포크는 무엇인가?`, `What is Ethereum's ${f.name} hard fork?`), a: f.summary }]),
                breadcrumbLd([
                    { name: 'Home', url: '/' },
                    { name: T('하드포크', 'Hard Forks'), url: '/forks' },
                    { name: f.name, url: path },
                ]),
            ],
            bodyHtml,
        }),
    );
}

// 로드맵 개념 상세
for (const it of topicItems) {
    const t = roadmapEx.topics[itemSlug(it)];
    const path = `/roadmap/${itemSlug(it)}`;
    const ready = enPaths.has(path);
    if (EN && !ready) continue;
    const fork = STRAWMAP_FORKS[it.fork];
    const bodyHtml =
        `<article>` +
        `<h1>${esc(t.title)}</h1>` +
        `<p>Strawmap ${esc(fork.name)} (${esc(fork.when)}) · ${esc(it.en)}</p>` +
        `<p>${esc(t.summary)}</p>` +
        `<h2>${T('왜 필요한가', 'Why it is needed')}</h2><p>${esc(t.why)}</p>` +
        (t.steps.length ? `<h2>${T('어떻게 동작하나', 'How it works')}</h2><ol>${t.steps.map((s) => `<li><strong>${esc(s.title)}</strong> ${esc(s.body)}</li>`).join('')}</ol>` : '') +
        (it.eips?.length ? `<h2>${T('관련 EIP', 'Related EIPs')}</h2><ul>${it.eips.map((n) => `<li><a href="${eipTitle.has(n) ? `/eips/${n}` : `https://eips.ethereum.org/EIPS/eip-${n}`}">EIP-${n}</a> ${esc(eipTitle.get(n) ?? '')}</li>`).join('')}</ul>` : '') +
        `<p><a href="/roadmap">${T('← 로드맵', '← Roadmap')}</a></p>` +
        `</article>`;
    writePage(
        `roadmap/${itemSlug(it)}`,
        buildShell({
            title: t.title,
            description: t.summary,
            url: `${SITE_URL}${path}`,
            image: DEFAULT_IMAGE,
            type: 'article',
            en: ready,
            jsonLd: [
                faqLd([{ q: T(`이더리움 로드맵의 ${it.name}은 무엇인가?`, `What is ${it.name} on the Ethereum roadmap?`), a: t.summary }]),
                breadcrumbLd([
                    { name: 'Home', url: '/' },
                    { name: T('로드맵', 'Roadmap'), url: '/roadmap' },
                    { name: it.name, url: path },
                ]),
            ],
            bodyHtml,
        }),
    );
}

// 멤버 상세
let memberPages = 0;
for (const m of EN ? [] : members) {
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
        en: false,
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

// 커뮤니티 글은 한국어뿐이라 영어판 홈·콘텐츠에는 최근 다이제스트를 싣는다
const recentLinks = EN
    ? ul(ethDigests.digests.slice(0, 12).map((d) => liLink('/news', `${d.date} · ${d.title}`)))
    : ul(sortedContents.slice(0, 24).map((c) => liLink(`/contents/${c.id}`, c.title)));
const coreLinks = ul(mockMembers.map((m) => liLink(`/team/${m.id}`, m.name)));
const contribLinks = ul(mockContributors.slice(0, 40).map((m) => liLink(`/contributors/${m.id}`, m.name)));

const ECK_FAQ = [
    {
        q: T('ECK(Ethereum Collective Korea)는 무엇인가요?', 'What is ECK (Ethereum Collective Korea)?'),
        a: T('ECK는 한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다. 이더리움 리서치, 뉴스, 주간 리포트, 커뮤니티 이니셔티브를 한국어로 제공합니다.', 'ECK is a nonprofit collective building public goods for the Ethereum ecosystem in Korea. It publishes Ethereum research, news digests, explainers and community initiatives in Korean and English.'),
    },
    {
        q: T('어떤 콘텐츠를 제공하나요?', 'What does ECK publish?'),
        a: T('이더리움 관련 리서치, 단신(Short), 주간 리포트, 큐레이션 뉴스를 제공합니다. 모든 콘텐츠는 /contents 에서 볼 수 있습니다.', 'Plain-language explainers of EIPs and ERCs, notes on core developer calls, a digest of Ethereum news and debates, and a guide to the roadmap and hard forks. Community research posts are at /contents.'),
    },
    {
        q: T('누가 운영하나요?', 'Who runs it?'),
        a: T('코어팀과 다수의 커뮤니티 기여자가 함께 운영합니다. 멤버는 /team 에서 확인할 수 있습니다.', 'A core team together with many community contributors. Members are listed at /team.'),
    },
];

interface StaticPage {
    path: string;
    title: string;
    description: string;
    bodyHtml: string;
    jsonLd: object[];
    /** 공유 미리보기 그림 (사이트 기준 경로). 생략하면 기본 그림 */
    image?: string;
}

function videoListHtml(list: ShellVideo[]): string {
    return (
        `<ul>` +
        list
            .map(
                (v) =>
                    `<li><a href="${escAttr(videoPagePath(v.id))}">Day ${v.day} · ${esc(v.title)}</a> — ` +
                    `${esc(v.speakers.map((sp) => parseSpeaker(sp).name).join(', '))} ` +
                    `(<a href="${escAttr(watchUrl(v.id))}">YouTube</a>)</li>`,
            )
            .join('') +
        `</ul>`
    );
}

function videoItemListLd(list: ShellVideo[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: T('Ethereum Korea One Genesis 세션 영상', 'Ethereum Korea One Genesis session videos'),
        numberOfItems: list.length,
        itemListElement: list.map((v, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE_URL}${videoPagePath(v.id)}`,
            name: v.title,
        })),
    };
}

const staticPages: StaticPage[] = [
    {
        path: '',
        title: '',
        description:
            T('ECK(Ethereum Collective Korea)는 한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다. 이더리움 리서치, 뉴스, 주간 리포트를 한국어로 제공합니다.', 'ECK (Ethereum Collective Korea) is a nonprofit collective building public goods for the Ethereum ecosystem in Korea: EIP and ERC explainers, core dev call notes, news digests and a roadmap guide.'),
        bodyHtml:
            `<h1>Ethereum Collective Korea (ECK)</h1>` +
            `<p>${T('한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다. 리서치, 뉴스, 주간 리포트, 커뮤니티 이니셔티브를 한국어로 제공합니다.', 'A nonprofit collective building public goods for the Ethereum ecosystem in Korea. We publish EIP and ERC explainers, core dev call notes, news digests and a roadmap guide.')}</p>` +
            `<nav><a href="/about">About</a> · <a href="/contents">Contents</a> · <a href="/team">Team</a> · <a href="/ecosystem">Ecosystem</a> · <a href="/events">Events</a></nav>` +
            `<h2>${T('최근 콘텐츠', 'Latest digests')}</h2>${recentLinks}<p><a href="/contents">${T('모든 콘텐츠 보기 →', 'All contents →')}</a></p>`,
        jsonLd: [],
    },
    {
        path: 'about',
        title: 'About',
        description: T('ECK(Ethereum Collective Korea)의 미션과 비전 — 한국 이더리움 생태계를 위한 공공재.', 'The mission and vision of ECK (Ethereum Collective Korea): public goods for the Ethereum ecosystem in Korea.'),
        bodyHtml:
            `<h1>About — Ethereum Collective Korea</h1>` +
            `<p>${T('ECK는 한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다. 리서치와 콘텐츠로 이더리움 지식을 한국어로 전하고, 커뮤니티 기여자들과 함께 생태계를 키웁니다.', 'ECK is a nonprofit collective building public goods for the Ethereum ecosystem in Korea. We make Ethereum knowledge accessible through research and explainers, and grow the ecosystem together with community contributors.')}</p>` +
            `<h2>${T('자주 묻는 질문', 'FAQ')}</h2>` +
            ECK_FAQ.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('') +
            `<p><a href="/contents">${T('콘텐츠 보기', 'Contents')}</a> · <a href="/team">${T('팀 보기', 'Team')}</a></p>`,
        jsonLd: [faqLd(ECK_FAQ)],
    },
    {
        path: 'contents',
        title: 'Contents',
        description: T(`이더리움 리서치, 뉴스, 주간 리포트 ${contents.length}건. Ethereum Collective Korea가 한국어로 큐레이션합니다.`, `Ethereum research, news and weekly reports from Ethereum Collective Korea, plus ${videos.length} session videos from Ethereum Korea One Genesis.`),
        bodyHtml:
            `<h1>Contents</h1>` +
            `<p>${T(`이더리움 리서치, 단신, 주간 리포트, 뉴스 등 총 ${contents.length}건의 콘텐츠를 제공합니다.`, `Research, short posts, weekly reports and news from the ECK community (${contents.length} posts, written in Korean), and session videos with English summaries.`)}</p>` +
            `<h2>${T('최근 콘텐츠', 'Latest digests')}</h2>${recentLinks}` +
            `<h2>${T(`영상: Ethereum Korea One Genesis 세션 ${videos.length}개`, `Videos: ${videos.length} sessions from Ethereum Korea One Genesis`)}</h2>` +
            videoListHtml(videos),
        jsonLd: [
            collectionPageLd({
                name: 'Contents',
                url: '/contents',
                description: T('이더리움 리서치·뉴스·주간 리포트', 'Ethereum research, news and weekly reports'),
                items: EN ? [] : sortedContents.slice(0, 50).map((c) => ({ name: c.title, url: `/contents/${c.id}` })),
            }),
            videoItemListLd(videos),
        ],
    },
    {
        path: 'news',
        title: 'Ethereum News',
        image: ethDigests.digests[0]?.coverImage,
        description: ethDigests.digests[0]
            ? T(`${ethDigests.digests[0].date} 데일리 다이제스트 — ${ethDigests.digests[0].title}`, `${ethDigests.digests[0].date} digest: ${ethDigests.digests[0].title}`)
            : T('이더리움 공식 블로그·리서치 포럼·핵심 트위터·커뮤니티 소식을 매일 한국어 다이제스트로 정리합니다.', 'A regular digest of news from the official Ethereum blog, research forums, key Twitter accounts and the community.'),
        bodyHtml:
            `<h1>Ethereum News</h1>` +
            `<p>${T('이더리움 공식 블로그, 리서치 포럼(ethresear.ch, Ethereum Magicians), 핵심 트위터 계정, 커뮤니티 소식을 매일 수집해 한국어 다이제스트로 정리합니다.', 'We collect news from the official Ethereum blog, research forums (ethresear.ch, Ethereum Magicians), key Twitter accounts and the community every day and publish it as a digest.')}</p>` +
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
                description: T('이더리움 소식 데일리 한국어 다이제스트', 'Ethereum news digest'),
                items: (ethDigests.digests[0]?.sections ?? [])
                    .flatMap((s) => s.items)
                    .map((it) => ({ name: it.title, url: it.url })),
            }),
        ],
    },
    {
        path: 'debates',
        title: 'Ethereum Debates',
        description: T(`이더리움 코어 개발자와 리서처들이 공개적으로 갈린 쟁점 ${debates.length}건. 각 논쟁의 배경, 입장별 논거, 발언 타임라인을 한국어로 정리합니다.`, `${debates.length} issues on which Ethereum core developers and researchers have publicly disagreed, each with background, the arguments on every side and a timeline of statements.`),
        bodyHtml:
            `<h1>Ethereum Debates</h1>` +
            `<p>${T('이더리움 코어 개발자와 리서처들이 X(트위터)와 포럼에서 공개적으로 갈린 쟁점을 추적합니다. 각 논쟁마다 무엇을 다투는지, 누가 어떤 논거로 어느 편에 섰는지, 발언이 어떻게 오갔는지를 한국어로 정리합니다.', 'We track the issues on which Ethereum core developers and researchers publicly disagree on X (Twitter) and the forums. For each debate we lay out what is contested, who stands where and on what grounds, and how the exchange unfolded.')}</p>` +
            `<h2>${T('진행 중인 논쟁', 'Debates')}</h2><ul>` +
            debates
                .map(
                    (d) =>
                        `<li><a href="/debates/${escAttr(d.id)}">${esc(d.title)}</a> — ${esc(d.category)} · ${T(`참여 ${participantCount(d)}명`, `${participantCount(d)} participants`)} · ${esc(d.lastActivity)}<br>${esc(d.summary)}</li>`,
                )
                .join('') +
            `</ul>`,
        jsonLd: [
            collectionPageLd({
                name: 'Ethereum Debates',
                url: '/debates',
                description: T('이더리움 코어 개발자·리서처가 갈린 쟁점 아카이브', 'An archive of issues that divide Ethereum core developers and researchers'),
                items: debates.map((d) => ({ name: d.title, url: `/debates/${d.id}` })),
            }),
        ],
    },
    {
        path: 'eips',
        title: 'EIPs',
        description: T(`이더리움 EIP ${eips.length}개를 원문과 코어 개발자 콜 기록을 바탕으로 쉽게, 그리고 깊게 풀어 둔 한국어 해설.`, `Plain-language and in-depth explainers for ${eips.length} Ethereum EIPs, written from the specs and core developer call records.`),
        bodyHtml:
            `<h1>${T('이더리움은 EIP로 바뀝니다', 'Ethereum changes through EIPs')}</h1>` +
            `<p>${T('EIP(Ethereum Improvement Proposal)는 이더리움을 이렇게 바꾸자는 공개 제안서입니다. 코어 개발자 콜에서 논의를 거쳐 하드포크에 들어가야 실제 네트워크가 바뀝니다.', 'An EIP (Ethereum Improvement Proposal) is a public proposal to change Ethereum. The network only changes once a proposal has been discussed on core developer calls and included in a hard fork.')}</p>` +
            `<h2>${T('EIP 해설', 'EIP explainers')}</h2><ul>` +
            eips.map((e) => `<li><a href="/eips/${e.number}">EIP-${e.number} ${esc(e.titleKo)}</a> (${esc(e.meta.title)}) — ${esc(e.summary)}</li>`).join('') +
            `</ul>`,
        jsonLd: [
            collectionPageLd({
                name: 'EIPs',
                url: '/eips',
                description: T('이더리움 EIP 한국어 해설', 'Ethereum EIP explainers'),
                items: eips.map((e) => ({ name: `EIP-${e.number} ${e.titleKo}`, url: `/eips/${e.number}` })),
            }),
        ],
    },
    {
        path: 'ercs',
        title: 'ERCs',
        description: T(`토큰, NFT, 지갑 같은 이더리움 앱 표준(ERC) ${ercs.length}개를 원문을 바탕으로 쉽게, 그리고 깊게 풀어 둔 한국어 해설.`, `Plain-language and in-depth explainers for ${ercs.length} Ethereum application standards (ERCs) such as tokens, NFTs and wallets, written from the specs.`),
        bodyHtml:
            `<h1>${T('ERC, 앱과 지갑이 함께 쓰는 약속', 'ERCs: the conventions apps and wallets share')}</h1>` +
            `<p>${T('ERC는 이더리움 위에서 돌아가는 앱이 같은 방식으로 말하도록 정한 표준입니다. 하드포크 없이 앱과 지갑이 채택하면 쓰입니다.', 'An ERC is a standard that lets applications on Ethereum speak the same way. It needs no hard fork: it takes effect when apps and wallets adopt it.')}</p>` +
            `<h2>${T('ERC 해설', 'ERC explainers')}</h2><ul>` +
            ercs.map((e) => `<li><a href="/ercs/${e.number}">ERC-${e.number} ${esc(e.titleKo)}</a> (${esc(e.meta.title)}) — ${esc(e.summary)}</li>`).join('') +
            `</ul>`,
        jsonLd: [
            collectionPageLd({
                name: 'ERCs',
                url: '/ercs',
                description: T('이더리움 ERC 한국어 해설', 'Ethereum ERC explainers'),
                items: ercs.map((e) => ({ name: `ERC-${e.number} ${e.titleKo}`, url: `/ercs/${e.number}` })),
            }),
        ],
    },
    {
        path: 'roadmap',
        title: T('로드맵', 'Roadmap'),
        description: T('이더리움 재단 프로토콜 팀의 Strawmap을 한국어로 옮긴 로드맵. 2029년까지 하드포크마다 들어갈 업그레이드와 다섯 가지 목표.', "A guide to the Ethereum Foundation protocol team's Strawmap: the upgrades planned for each hard fork through 2029 and the five goals."),
        bodyHtml:
            `<h1>${T('2029년까지, 이더리움은 어디로 가나', 'Where Ethereum is headed through 2029')}</h1>` +
            `<p>${T(`이더리움 재단 프로토콜 팀의 Strawmap(원본 갱신 ${STRAWMAP_UPDATED})을 한국어로 옮겼습니다. 공식 계획이 아니라 토론용 초안입니다.`, `A guide to the Ethereum Foundation protocol team's Strawmap (source updated ${STRAWMAP_UPDATED}). It is a discussion draft, not an official plan.`)}</p>` +
            `<h2>${T('다섯 가지 목표', 'Five goals')}</h2><ul>${NORTH_STARS.map((x) => `<li>${esc(x.name)} (${esc(x.metric)}, ${esc(x.metricEn)}): ${esc(x.body)}</li>`).join('')}</ul>` +
            STRAWMAP_FORKS.map((f, i) => `<h2>${esc(f.name)} (${esc(f.when)})</h2><ul>${ROADMAP_ITEMS.filter((x) => x.fork === i).map((x) => `<li>${roadmapEx.topics[itemSlug(x)] ? `<a href="/roadmap/${itemSlug(x)}">${esc(x.name)}</a>` : esc(x.name)} (${esc(x.en)})${x.eips?.length ? ` EIP-${x.eips.join(', EIP-')}` : ''}</li>`).join('')}</ul>`).join('') +
            `<h2>${T('로드맵이 걸어온 길', 'How the roadmap got here')}</h2><ol>${ROADMAP_HISTORY.map((h) => `<li>${h.date} <a href="${h.url}">${esc(h.title)}</a>: ${esc(h.changes.join(' '))}</li>`).join('')}</ol>` +
            `<h2>${T('비탈릭의 여섯 갈래', "Vitalik's six tracks")}</h2>${PILLARS.map((p) => `<h3>The ${p.name}</h3><p>${esc(p.goal)} ${esc(p.shift)}</p><p>${ROADMAP_ITEMS.filter((x) => ITEM_PILLAR[itemSlug(x)] === p.key).map((x) => esc(x.name)).join(', ')}</p>`).join('')}`,
        jsonLd: [
            collectionPageLd({
                name: T('이더리움 로드맵', 'Ethereum roadmap'),
                url: '/roadmap',
                description: T('이더리움 재단 프로토콜 팀의 Strawmap을 한국어로 옮긴 로드맵과 항목별 해설', "A guide to the Ethereum Foundation protocol team's Strawmap, with an explainer for each item"),
                items: topicItems.map((it) => ({ name: it.name, url: `/roadmap/${itemSlug(it)}` })),
            }),
        ],
    },
    {
        path: 'forks',
        title: T('하드포크', 'Hard Forks'),
        description: T('2015년 Frontier부터 다가오는 Glamsterdam, Hegotá까지 이더리움 하드포크마다 무엇이 바뀌었는지 정리한 연대기.', 'A timeline of what changed in every Ethereum hard fork, from Frontier in 2015 to the upcoming Glamsterdam and Hegotá.'),
        bodyHtml:
            `<h1>${T('이더리움이 바뀌어 온 순간들', 'The moments Ethereum changed')}</h1><ul>` +
            FORKS.map((f) => `<li><a href="/forks/${f.slug}">${esc(f.name)}</a> (${esc(f.date ?? f.target ?? '')}): ${esc(f.summary)}</li>`).join('') +
            `</ul>`,
        jsonLd: [
            collectionPageLd({
                name: T('하드포크', 'Hard Forks'),
                url: '/forks',
                description: T('이더리움 하드포크 연대기', 'A timeline of Ethereum hard forks'),
                items: FORKS.map((f) => ({ name: f.name, url: `/forks/${f.slug}` })),
            }),
        ],
    },
    {
        path: 'team',
        title: 'Team',
        description: T('Ethereum Collective Korea 코어팀과 커뮤니티 기여자 소개.', 'The core team and community contributors of Ethereum Collective Korea.'),
        bodyHtml: `<h1>Team</h1><h2>Core Team</h2>${coreLinks}<h2>Contributors</h2>${contribLinks}`,
        jsonLd: [
            collectionPageLd({
                name: 'Team',
                url: '/team',
                description: T('ECK 코어팀과 기여자', 'ECK core team and contributors'),
                items: [
                    ...mockMembers.map((m) => ({ name: m.name, url: `/team/${m.id}` })),
                    ...mockContributors.slice(0, 100).map((m) => ({ name: m.name, url: `/contributors/${m.id}` })),
                ],
            }),
        ],
    },
    {
        path: 'ecosystem',
        title: 'Ecosystem',
        description: ecoKo.description,
        bodyHtml:
            `<h1>${T('이더리움 생태계 지도', 'A map of the Ethereum ecosystem')}</h1><p>${esc(ecoKo.description)}</p>` +
            eco.categories
                .map((c) => {
                    const list = eco.tools.filter((t) => t.category === c.id);
                    return list.length
                        ? `<h2>${esc(ecoKo.categories[c.id] ?? c.id)}</h2><ul>${list.map((t) => `<li><a href="${escAttr(t.url)}">${esc(t.name)}</a>: ${esc(ecoKo.tools[t.id] ?? '')}</li>`).join('')}</ul>`
                        : '';
                })
                .join('') +
            `<h2>${T('추천 트위터(X) 계정', 'Recommended Twitter (X) accounts')}</h2><ul>${eco.twitterAccounts.map((a) => `<li><a href="${escAttr(a.url)}">${esc(a.name)} (${esc(a.handle)})</a>${ecoKo.twitter?.[a.id] ? `: ${esc(ecoKo.twitter[a.id])}` : ''}</li>`).join('')}</ul>`,
        jsonLd: [
            collectionPageLd({
                name: T('이더리움 생태계 지도', 'A map of the Ethereum ecosystem'),
                url: '/ecosystem',
                description: ecoKo.description,
                items: eco.tools.map((t) => ({ name: t.name, url: t.url })),
            }),
        ],
    },
    {
        path: 'events',
        title: 'Events',
        description: T('Ethereum Korea One, Ethcon Korea 등 ECK가 함께한 이더리움 행사 기록.', 'A record of the Ethereum events ECK has been part of, including Ethereum Korea One and Ethcon Korea.'),
        bodyHtml:
            `<h1>Events</h1><p>${T('ECK가 함께 만들거나 참여한 이더리움 행사와, 해외 주요 행사를 한국어로 정리한 리포트입니다.', 'Ethereum events ECK has organized or joined, and reports on major events abroad.')}</p>` +
            `<h2>${T('최근 행사', 'Recent events')}</h2><ul>` +
            `<li><a href="/events/ek1-genesis">Ethereum Korea One: Genesis</a> ${T('(2026.09.28 – 09.29, 서울): 세션 영상과 행사 기록', '(Sep 28 to 29, 2026, Seoul): session videos and event record')}</li>` +
            `<li><a href="/events/devcon-8">${T('Devcon 8 India 현장 리포트', 'Devcon 8 India report')}</a>: ${T(`뭄바이에서 열린 Devcon 8의 주요 발표 ${DEVCON8_TALKS.length}개 한국어 정리`, `${DEVCON8_TALKS.length} key talks from Devcon 8 in Mumbai, summarized`)}</li>` +
            `</ul>` +
            `<h2>${T('지난 행사', 'Past events')}</h2><ul>${PAST_EVENTS.map((e) => `<li><a href="${escAttr(e.link)}">${esc(e.title)}</a> (${esc(e.date)}, ${esc(eventsKo.locations[e.locationKey] ?? '')}): ${esc(eventsKo.descriptions[e.descriptionKey] ?? '')}</li>`).join('')}</ul>`,
        jsonLd: [
            collectionPageLd({
                name: 'Events',
                url: '/events',
                description: T('ECK가 함께한 이더리움 행사 기록', 'Ethereum events ECK has been part of'),
                items: [
                    { name: 'Ethereum Korea One: Genesis', url: '/events/ek1-genesis' },
                    { name: T('Devcon 8 India 현장 리포트', 'Devcon 8 India report'), url: '/events/devcon-8' },
                    ...PAST_EVENTS.map((e) => ({ name: e.title, url: e.link })),
                ],
            }),
            // 지난 행사: "언제·어디서 열렸나"에 답할 수 있게 Event 로도 싣는다
            ...PAST_EVENTS.map((e) => ({
                '@context': 'https://schema.org',
                '@type': 'Event',
                name: e.title,
                startDate: e.date.slice(0, 10).replace(/\./g, '-'),
                eventStatus: 'https://schema.org/EventScheduled',
                location: { '@type': 'Place', name: eventsKo.locations[e.locationKey] ?? 'Seoul', address: { '@type': 'PostalAddress', addressLocality: 'Seoul', addressCountry: 'KR' } },
                description: eventsKo.descriptions[e.descriptionKey],
                url: e.link,
            })),
        ],
    },
    {
        path: 'events/ek1-genesis',
        title: 'Ethereum Korea One · Genesis',
        description: T(`Ethereum Korea One Genesis(2026.09.28–29) 기록. 빌더 데이 세션 요약, 현장 사진, 세션 영상 ${videos.length}개.`, `A record of Ethereum Korea One Genesis (Sep 28 to 29, 2026): builder day session summaries, photos and ${videos.length} session videos.`),
        bodyHtml:
            `<h1>Ethereum Korea One · Genesis</h1>` +
            `<p>${T('이더리움 코리아 컨소시엄이 연 이틀간의 행사입니다. Day 1(2026.09.28 콘래드 서울)은 금융기관 초청 행사, Day 2(2026.09.29 성수)는 빌더 데이 Build Beyond the Narrative였습니다.', 'A two-day event hosted by the Ethereum Korea Consortium. Day 1 (Sep 28, 2026, Conrad Seoul) was an invitation-only day for financial institutions, and Day 2 (Sep 29, 2026, Seongsu) was the builder day, Build Beyond the Narrative.')}</p>` +
            `<h2>${T('Day 2 세션', 'Day 2 sessions')}</h2><ul>` +
            GENESIS_SESSIONS.map((s) => {
                const v = videos.find((x) => x.sessionId === s.id);
                const title = v ? `<a href="${escAttr(videoPagePath(v.id))}">${esc(s.title)}</a>` : esc(s.title);
                return `<li>${esc(s.time)} ${esc(s.format)} · ${title} — ${esc(s.speakers)}${s.summary ? `<p>${esc(s.summary)}</p>` : ''}</li>`;
            }).join('') +
            `</ul>` +
            `<h2>${T('세션 영상', 'Session videos')}</h2>${videoListHtml(videos)}`,
        jsonLd: [EN ? { ...ek1GenesisEventLd(videos), description: 'A two-day event hosted by the Ethereum Korea Consortium. Day 1 was an invitation-only day for financial institutions (Conrad Seoul), Day 2 the builder day Build Beyond the Narrative (Seongsu).' } : ek1GenesisEventLd(videos)],
    },
    {
        path: 'calls',
        title: 'Core Dev Calls',
        description: T(`이더리움 코어 개발자 콜(ACDE·ACDC·ACDT 등) ${fullCalls.length}회의 결정과 쟁점을 한국어로 정리합니다. 어떤 EIP가 어느 포크에 들어가는지 콜마다 기록합니다.`, `Decisions and points of contention from ${fullCalls.length} Ethereum core developer calls (ACDE, ACDC, ACDT and more), tracking which EIPs go into which fork, call by call.`),
        bodyHtml:
            `<h1>${T('Core Dev Calls: 이더리움 코어 개발자 콜 정리', 'Core Dev Calls: notes on the Ethereum core developer calls')}</h1>` +
            `<p>${T('이더리움 프로토콜의 변경은 코어 개발자 콜(All Core Devs)에서 정해집니다. 실행 레이어 콜(ACDE), 합의 레이어 콜(ACDC), 테스트 콜(ACDT)마다 무엇이 결정됐고 어떤 쟁점이 오갔는지 한국어로 정리합니다.', 'Changes to the Ethereum protocol are decided on the core developer calls (All Core Devs). For every execution layer call (ACDE), consensus layer call (ACDC) and testing call (ACDT), we record what was decided and what was contested.')}</p>` +
            `<ul>` +
            fullCalls.map((c) => `<li><a href="/calls/${escAttr(c.id)}">${esc(callTitle(c))}</a> (${esc(c.date)})<br>${esc(c.summary ?? c.lead ?? '')}</li>`).join('') +
            `</ul>`,
        jsonLd: [
            collectionPageLd({
                name: 'Core Dev Calls',
                url: '/calls',
                description: T('이더리움 코어 개발자 콜의 결정과 쟁점 한국어 정리', 'Decisions and points of contention from the Ethereum core developer calls'),
                items: fullCalls.map((c) => ({ name: callTitle(c), url: `/calls/${c.id}` })),
            }),
        ],
    },
    {
        path: 'events/devcon-8',
        title: T('Devcon 8 India 현장 리포트', 'Devcon 8 India report'),
        description: T('뭄바이에서 열린 Devcon 8의 주요 발표와 소식, 다음 Devcon 리스본 개최 소식을 정리했습니다.', 'Key talks and news from Devcon 8 in Mumbai, plus the announcement of the next Devcon in Lisbon.'),
        image: DEVCON8_IMAGES.keyVisual,
        bodyHtml:
            `<h1>${T('Devcon 8 India 현장 리포트', 'Devcon 8 India report')}</h1>` +
            `<p>${T(`뭄바이에서 열린 Devcon 8의 주요 발표 ${DEVCON8_TALKS.length}개와 행사 기간에 나온 공식 소식을 한국어로 정리했습니다.`, `${DEVCON8_TALKS.length} key talks from Devcon 8 in Mumbai and the official news from the week.`)}</p>` +
            `<h2>${T('행사 기간 소식', 'News from the week')}</h2><ul>${DEVCON8_NEWS.map((n) => `<li>${esc(n.title)}: ${esc(n.body)} (<a href="${escAttr(n.source.url)}">${esc(n.source.label)}</a>)</li>`).join('')}</ul>` +
            `<h2>${T('주요 발표', 'Key talks')}</h2>` +
            DEVCON8_TALKS.map(
                (t) =>
                    `<h3>${esc(t.title)} (${esc(t.titleEn)})</h3><p>${esc(t.speakers)} · ${esc(t.date)}</p><p>${esc(t.summary)}</p>` +
                    `<ul>${t.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` +
                    (t.flow ?? []).map((f) => `<h4>${esc(f.heading)}</h4><p>${esc(f.body)}</p>`).join('') +
                    `<p>${t.videos.map((v) => `<a href="${escAttr(v.url)}">${esc(v.label)}</a>`).join(' · ')}</p>`,
            ).join(''),
        jsonLd: [
            breadcrumbLd([
                { name: 'Home', url: '/' },
                { name: 'Events', url: '/events' },
                { name: 'Devcon 8 India', url: '/events/devcon-8' },
            ]),
        ],
    },
    {
        path: 'ef-mandate',
        title: T('EF Mandate 해설', 'EF Mandate explained'),
        description: T('이더리움 재단이 2026년 3월 발표한 EF Mandate를 장마다 쉽게 풀었습니다. 재단의 역할, 원칙, 어려운 판단의 기준을 정리했습니다.', "A plain-language walkthrough, chapter by chapter, of the EF Mandate the Ethereum Foundation published in March 2026: the Foundation's role, its principles, and how it makes hard calls."),
        image: '/assets/ef-mandate/hero.webp',
        bodyHtml:
            `<article><h1>${T('EF Mandate 해설', 'EF Mandate explained')}</h1>` +
            `<p>${esc(efMandate.lead)}</p>` +
            `<p><a href="${escAttr(efMandate.meta.originalUrl)}">${T('원문', 'Original')}</a> · <a href="${escAttr(efMandate.meta.blogUrl)}">${T('재단 블로그', 'Foundation blog')}</a> · ${T(`${esc(efMandate.meta.published)} 발표`, `published ${esc(efMandate.meta.published)}`)}</p>` +
            `<h2>${T('핵심 생각', 'Key ideas')}</h2><ul>${efMandate.keyIdeas.map((k) => `<li>${esc(k.title)}: ${esc(k.body)}</li>`).join('')}</ul>` +
            efMandate.sections.map((sec) => `<h2>${esc(sec.numeral)}. ${esc(sec.titleKo)} (${esc(sec.titleEn)})</h2><p>${esc(sec.summary)}</p><ul>${sec.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`).join('') +
            `<h2>${T('기술 원칙', 'Technical principles')}</h2><ul>${efMandate.principles.technical.map((x) => `<li>${esc(x.name)}: ${esc(x.body)}</li>`).join('')}</ul>` +
            `<h2>${T('사회 원칙', 'Social principles')}</h2><ul>${efMandate.principles.social.map((x) => `<li>${esc(x.name)}: ${esc(x.body)}</li>`).join('')}</ul>` +
            `<h2>${T('어려운 판단의 기준', 'How hard calls get made')}</h2>${efMandate.quandaries.map((q) => `<h3>${esc(q.question)}</h3><p>${esc(q.answer)}</p>`).join('')}` +
            `<h2>${T('용어', 'Glossary')}</h2><ul>${efMandate.glossary.map((g) => `<li>${esc(g.term)}: ${esc(g.body)}</li>`).join('')}</ul></article>`,
        jsonLd: [
            faqLd([
                { q: T('EF Mandate는 무엇인가요?', 'What is the EF Mandate?'), a: efMandate.lead },
                ...efMandate.quandaries.map((q) => ({ q: q.question, a: q.answer })),
            ]),
        ],
    },
];

let staticPagesCount = 0;
for (const sp of staticPages) {
    const fullUrl = sp.path === '' ? `${SITE_URL}/` : `${SITE_URL}/${sp.path}`;
    const html = buildShell({
        title: sp.title,
        description: sp.description,
        url: fullUrl,
        image: sp.image ? `${SITE_URL}${sp.image}` : DEFAULT_IMAGE,
        type: 'website',
        jsonLd: sp.jsonLd,
        bodyHtml: sp.bodyHtml,
    });
    if (sp.path === '') {
        mkdirSync(OUT, { recursive: true });
        writeFileSync(join(OUT, 'index.html'), html);
        written.add('/');
    } else writePage(sp.path, html);
    staticPagesCount++;
}

// 코어 개발자 콜 상세 (/calls/:id)
let callPages = 0;
for (const c of fullCalls) {
    const path = `/calls/${c.id}`;
    const ready = enPaths.has(path);
    if (EN && !ready) continue;
    const title = callTitle(c);
    const summary = c.summary ?? c.lead ?? c.title;
    const bodyHtml =
        `<article>` +
        `<h1>${esc(title)}</h1>` +
        `<p>${esc(c.title)} · ${esc(c.date)}</p>` +
        (c.lead ? `<p>${esc(c.lead)}</p>` : '') +
        (c.summary ? `<p>${esc(c.summary)}</p>` : '') +
        (c.whyItMatters ? `<h2>${T('왜 중요한가', 'Why it matters')}</h2><p>${esc(c.whyItMatters)}</p>` : '') +
        (c.decisions.length ? `<h2>${T('결정', 'Decisions')}</h2><ul>${c.decisions.map((d) => `<li>${esc(d.label)}: ${esc(d.text)}</li>`).join('')}</ul>` : '') +
        (c.topics.length
            ? `<h2>${T('논의', 'Discussion')}</h2>${c.topics.map((t) => `<h3>${esc(t.title)}</h3><p>${esc(t.intro)}</p>${t.decision ? `<p>${T('결론', 'Outcome')}: ${esc(t.decision)}</p>` : ''}`).join('')}`
            : '') +
        (c.glossary.length ? `<h2>${T('용어', 'Glossary')}</h2><ul>${c.glossary.map((g) => `<li>${esc(g.term)}: ${esc(g.def)}</li>`).join('')}</ul>` : '') +
        (c.eips.length ? `<h2>${T('다룬 EIP', 'EIPs covered')}</h2><ul>${c.eips.map((n) => liLink(`/eips/${n}`, `EIP-${n}${eipTitle.get(n) ? ` ${eipTitle.get(n)}` : ''}`)).join('')}</ul>` : '') +
        `<p><a href="${escAttr(c.forkcastUrl)}">${T('Forkcast 기록', 'Forkcast record')}</a>${c.videoUrl ? ` · <a href="${escAttr(c.videoUrl)}">${T('녹화 영상', 'Recording')}</a>` : ''} · <a href="/calls">← Core Dev Calls</a></p>` +
        `</article>`;
    const html = buildShell({
        title,
        description: summary,
        url: `${SITE_URL}${path}`,
        image: DEFAULT_IMAGE,
        type: 'article',
        en: ready,
        publishedTime: toIso(c.date),
        jsonLd: [
            faqLd([
                { q: T(`${callLabel(c)}(${c.date}) 콜에서 무엇이 결정됐나?`, `What was decided on ${callLabel(c)} (${c.date})?`), a: summary },
                ...(c.whyItMatters ? [{ q: T(`${callLabel(c)} 콜은 왜 중요한가?`, `Why does ${callLabel(c)} matter?`), a: c.whyItMatters }] : []),
            ]),
            breadcrumbLd([
                { name: 'Home', url: '/' },
                { name: 'Core Dev Calls', url: '/calls' },
                { name: callLabel(c), url: path },
            ]),
        ],
        bodyHtml,
    });
    writePage(`calls/${c.id}`, html);
    callPages++;
}

// 영상 요약 페이지 (/contents/videos/:id)
let videoPages = 0;
for (const v of videos) {
    const detail = videoDetails[v.id]?.[LANG];
    const path = videoPagePath(v.id);
    const speakers = v.speakers.map(parseSpeaker);
    const bodyHtml =
        `<article>` +
        `<h1>${esc(v.title)}</h1>` +
        `<p>Ethereum Korea One: Genesis · Day ${v.day} · ${esc(v.date)} · ${esc(v.duration)} · ${SPOKEN_LABEL[v.spokenLang]}</p>` +
        `<iframe title="${escAttr(v.title)}" src="${escAttr(embedUrl(v.id))}" width="1280" height="720" loading="lazy" allowfullscreen></iframe>` +
        `<p>${esc(v.summary)}</p>` +
        `<p><a href="${escAttr(watchUrl(v.id))}">${T('YouTube에서 보기', 'Watch on YouTube')}</a></p>` +
        `<h2>${T('연사', 'Speakers')}</h2><ul>${speakers.map((sp) => `<li>${esc(sp.name)}${sp.title ? `, ${esc(sp.title)}` : ''}${sp.moderator ? T(' (모더레이터)', ' (moderator)') : ''}</li>`).join('')}</ul>` +
        (detail
            ? `<h2>${T('세션 소개', 'About this session')}</h2><p>${esc(detail.about)}</p>` +
              `<h2>${T('핵심 요약', 'Key takeaways')}</h2><ul>${detail.takeaways.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` +
              `<h2>${T('챕터', 'Chapters')}</h2><ol>${detail.chapters.map((c) => `<li><a href="${escAttr(`${path}?t=${c.start}`)}">${esc(c.label)}</a></li>`).join('')}</ol>`
            : '') +
        `<p><a href="/contents?category=Video">${T('← 영상 목록', '← Videos')}</a> · <a href="/events/ek1-genesis">${T('EK1 Genesis 행사 기록', 'EK1 Genesis event record')}</a></p>` +
        `</article>`;

    const html = buildShell({
        title: v.title,
        description: oneLine(v.summary),
        url: `${SITE_URL}${path}`,
        image: maxThumbUrl(v.id),
        type: 'video.other',
        video: embedUrl(v.id),
        jsonLd: [
            videoObjectLd(v, detail),
            breadcrumbLd([
                { name: 'Home', url: '/' },
                { name: 'Contents', url: '/contents' },
                { name: v.title, url: path },
            ]),
        ],
        bodyHtml,
    });
    writePage(path.slice(1), html);
    videoPages++;
}

// ── 3) llms.txt ────────────────────────────────────────────
const recent = [...contents]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 80);

const llms =
    `# ${SITE_NAME}\n\n` +
    `> ECK(Ethereum Collective Korea)는 한국 이더리움 생태계를 위한 공공재를 만드는 비영리 콜렉티브입니다. ` +
    `이더리움 리서치, 뉴스, 주간 리포트, 커뮤니티 이니셔티브를 제공합니다.\n\n` +
    `Site: ${SITE_URL}\nLanguage: Korean (ko). English version: ${SITE_URL}${EN_PREFIX}/llms.txt\n\n` +
    `## Sections\n` +
    `- [About](${SITE_URL}/about): 미션과 비전\n` +
    `- [Contents](${SITE_URL}/contents): 리서치·뉴스·주간 리포트 (${contents.length}건)\n` +
    `- [Videos](${SITE_URL}/contents): Ethereum Korea One Genesis 세션 영상 (${videos.length}개, Contents의 영상 탭, 한국어·영어 요약)\n` +
    `- [Ethereum News](${SITE_URL}/news): 이더리움 최신 소식 데일리 피드 (${ethNews.items.length}건)\n` +
    `- [Ethereum Debates](${SITE_URL}/debates): 코어 개발자·리서처가 갈린 쟁점 (${debates.length}건)\n` +
    `- [EIPs](${SITE_URL}/eips): EIP 한국어 해설, 쉬운 설명과 심층 설명 (${eips.length}개)\n` +
    `- [ERCs](${SITE_URL}/ercs): ERC(토큰·NFT·지갑 등 앱 표준) 한국어 해설, 구현할 함수와 주의할 점 (${ercs.length}개)\n` +
    `- [Core Dev Calls](${SITE_URL}/calls): 코어 개발자 콜(ACDE·ACDC·ACDT 등)의 결정과 쟁점 한국어 정리 (${fullCalls.length}회)\n` +
    `- [Roadmap](${SITE_URL}/roadmap): 이더리움 로드맵 항목별 한국어 해설\n` +
    `- [Hard Forks](${SITE_URL}/forks): 하드포크별 포함 EIP와 일정 (${FORKS.length}개)\n` +
    `- [EF Mandate](${SITE_URL}/ef-mandate): 이더리움 재단 EF Mandate 한국어 해설\n` +
    `- [Team](${SITE_URL}/team): 코어팀과 기여자\n` +
    `- [Ecosystem](${SITE_URL}/ecosystem): 이더리움 생태계\n` +
    `- [Events](${SITE_URL}/events): 이벤트\n\n` +
    `## Videos: Ethereum Korea One Genesis (2026.09.28–29, Seoul)\n` +
    videos
        .map(
            (v) =>
                `- [${v.title} / ${v.alternateName}](${SITE_URL}${videoPagePath(v.id)}): Day ${v.day}, ${v.spokenLang === 'ko' ? 'Korean' : 'English'}. ` +
                `${head(oneLine(v.summary), 160)} (YouTube: ${watchUrl(v.id)})`,
        )
        .join('\n') +
    '\n\n' +
    `## Ethereum Debates\n` +
    debates.map((d) => `- [${d.title}](${SITE_URL}/debates/${d.id}): ${head(oneLine(d.summary), 160)}`).join('\n') +
    '\n\n' +
    `## Core Dev Calls (recent)\n` +
    fullCalls.slice(0, 12).map((c) => `- [${callTitle(c)}](${SITE_URL}/calls/${c.id}): ${c.date}. ${head(oneLine(c.summary ?? c.lead ?? ''), 160)}`).join('\n') +
    '\n\n' +
    `## Recent Contents\n` +
    recent
        .map((c) => `- [${c.title}](${SITE_URL}/contents/${c.id})${c.summary ? `: ${c.summary.slice(0, 120)}` : ''}`)
        .join('\n') +
    '\n';

// 영어판 llms.txt: 번역된 것만 영어 주소로 싣는다 (dist/en/llms.txt)
const EN_BASE = `${SITE_URL}${EN_PREFIX}`;
const line = (label: string, path: string, text: string) => `- [${label}](${EN_BASE}${path}): ${head(oneLine(text), 200)}`;
const enEips = eips.filter((e) => written.has(`/eips/${e.number}`));
const enErcs = ercs.filter((e) => written.has(`/ercs/${e.number}`));
const enCalls = fullCalls.filter((c) => written.has(`/calls/${c.id}`));
const enDebates = debates.filter((d) => written.has(`/debates/${d.id}`));
const enTopics = topicItems.filter((it) => written.has(`/roadmap/${itemSlug(it)}`));
const enForks = FORKS.filter((f) => written.has(`/forks/${f.slug}`));
const llmsEn =
    `# ${SITE_NAME}\n\n` +
    `> ECK (Ethereum Collective Korea) is a nonprofit collective building public goods for the Ethereum ecosystem in Korea. ` +
    `This is the English edition: plain-language explainers of EIPs and ERCs, notes on core developer calls, a digest of Ethereum news and debates, and a guide to the roadmap and hard forks.\n\n` +
    `Site: ${EN_BASE}\nLanguage: English (en). Korean version: ${SITE_URL}/llms.txt\nFull index: ${EN_BASE}/llms-full.txt\n\n` +
    `## Sections\n` +
    `- [EIPs](${EN_BASE}/eips): explainers for Ethereum Improvement Proposals, an easy summary and an in-depth section each (${enEips.length})\n` +
    `- [ERCs](${EN_BASE}/ercs): explainers for application standards such as tokens, NFTs and wallets, with the functions to implement and pitfalls (${enErcs.length})\n` +
    `- [Core Dev Calls](${EN_BASE}/calls): decisions and points of contention from ACDE, ACDC and ACDT calls (${enCalls.length})\n` +
    `- [Ethereum Debates](${EN_BASE}/debates): issues that divide core developers and researchers, with each side's arguments (${enDebates.length})\n` +
    `- [Ethereum News](${EN_BASE}/news): a digest of Ethereum news published every three days\n` +
    `- [Roadmap](${EN_BASE}/roadmap): the Ethereum Foundation protocol team's Strawmap, item by item\n` +
    `- [Hard Forks](${EN_BASE}/forks): what changed in each hard fork and which EIPs it included (${enForks.length})\n` +
    `- [EF Mandate](${EN_BASE}/ef-mandate): the Ethereum Foundation's EF Mandate explained\n` +
    `- [Events](${EN_BASE}/events): Ethereum Korea One Genesis and a Devcon 8 report\n` +
    `- [Ecosystem](${EN_BASE}/ecosystem): a map of Ethereum tools and accounts worth following\n` +
    `- [About](${EN_BASE}/about) · [Team](${EN_BASE}/team)\n\n` +
    `## Core Dev Calls (recent)\n${enCalls.slice(0, 12).map((c) => line(callTitle(c), `/calls/${c.id}`, `${c.date}. ${c.summary ?? c.lead ?? ''}`)).join('\n')}\n\n` +
    `## Ethereum Debates\n${enDebates.map((d) => line(d.title, `/debates/${d.id}`, d.summary)).join('\n')}\n\n` +
    `## Roadmap topics\n${enTopics.map((it) => line(roadmapEx.topics[itemSlug(it)].title, `/roadmap/${itemSlug(it)}`, roadmapEx.topics[itemSlug(it)].summary)).join('\n')}\n\n` +
    `## Hard forks\n${enForks.map((f) => line(f.name, `/forks/${f.slug}`, f.summary)).join('\n')}\n\n` +
    `## EIP explainers\n${enEips.map((e) => line(`EIP-${e.number} ${e.meta.title}`, `/eips/${e.number}`, e.summary)).join('\n')}\n\n` +
    `## ERC explainers\n${enErcs.map((e) => line(`ERC-${e.number} ${e.meta.title}`, `/ercs/${e.number}`, e.summary)).join('\n')}\n\n` +
    `## Videos: Ethereum Korea One Genesis (Sep 28 to 29, 2026, Seoul)\n${videos.map((v) => line(v.title, videoPagePath(v.id), `Day ${v.day}, spoken in ${v.spokenLang === 'ko' ? 'Korean' : 'English'}. ${v.summary}`)).join('\n')}\n`;
// 영어판 llms-full.txt: EIP·ERC 해설의 요약과 필요성까지
const llmsFullEn =
    `# ${SITE_NAME}: full index (English)\n\n> ${enEips.length} EIP and ${enErcs.length} ERC explainers. The full text of each is at its URL.\n\n` +
    [...enEips.map((e) => ({ id: `EIP-${e.number}`, path: `/eips/${e.number}`, e })), ...enErcs.map((e) => ({ id: `ERC-${e.number}`, path: `/ercs/${e.number}`, e }))]
        .map(({ id, path, e }) => `## ${id} ${e.titleKo} (${e.meta.title})\n${EN_BASE}${path}\n${e.meta.status} · ${e.topic}\n${oneLine(e.summary)}\nWhy it is needed: ${oneLine(e.why)}\n`)
        .join('\n');

if (!EN) writeFileSync(join(DIST, 'llms.txt'), llms);

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
const LLMS_LABELS = {
    ko: { speakers: '연사', uploaded: '업로드', spoken: '진행 언어', spokenName: { ko: '한국어', en: '영어' } },
    en: { speakers: 'Speakers', uploaded: 'Uploaded', spoken: 'Spoken in', spokenName: { ko: 'Korean', en: 'English' } },
} as const;
const llmsVideos =
    `\n# 영상 / Videos: Ethereum Korea One Genesis 세션 (${videoItems.length}개)\n\n` +
    `> 영상마다 한국어와 영어 요약을 함께 싣는다. Each video has a Korean and an English summary.\n\n` +
    videoItems
        .map((item) =>
            VIDEO_LANGS.map((lang) => {
                const v = localizeVideo(item, lang);
                const d = videoDetails[v.id]?.[lang];
                const l = LLMS_LABELS[lang];
                return (
                    `## ${v.title} (${lang})\n${SITE_URL}${videoPagePath(v.id)}\nYouTube: ${watchUrl(v.id)}\n` +
                    `Ethereum Korea One: Genesis Day ${v.day} · ${v.date} · ${v.duration} · ${l.uploaded} ${v.uploadDate.slice(0, 10)} · ` +
                    `${l.spoken}: ${l.spokenName[v.spokenLang]}\n` +
                    `${l.speakers}: ${v.speakers.join(' / ')}\n${v.summary}\n` +
                    (d ? `${d.about}\n${d.takeaways.map((x) => `- ${x}`).join('\n')}\n` : '')
                );
            }).join('\n'),
        )
        .join('\n');
if (EN) {
    writeFileSync(join(OUT, 'llms.txt'), llmsEn);
    writeFileSync(join(OUT, 'llms-full.txt'), llmsFullEn);
} else writeFileSync(join(DIST, 'llms-full.txt'), llmsFull + llmsVideos);

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

// 피드는 커뮤니티 글(한국어)이라 한국어판에서만 쓴다
if (!EN) writeFileSync(join(DIST, 'feed.xml'), rss);

// ── 1') sitemap 쓰기: 이번 실행이 shell 을 쓴 주소만 싣는다 (영어판은 번역된 것만) ──
const sitemapEntries = allEntries.filter((e) => written.has(e.loc));
const sitemapXml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemapEntries
        .map(
            (e) =>
                `  <url>\n    <loc>${SITE_URL}${EN ? `${EN_PREFIX}${e.loc === '/' ? '' : e.loc}` : e.loc}</loc>\n` +
                (e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : '') +
                `    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
        )
        .join('\n') +
    '\n</urlset>\n';

writeFileSync(join(DIST, EN ? 'sitemap-en.xml' : 'sitemap.xml'), sitemapXml);

// 보관해 둔 틀은 마지막 실행(영어판)이 지운다. 남기면 홈 사본이 공개 주소가 된다
if (EN) rmSync(TEMPLATE_FILE);

// ── 요약 출력 ───────────────────────────────────────────────
console.log(
    `[generate-seo:${LANG}] sitemap: ${sitemapEntries.length} urls · static: ${staticPagesCount} · content shells: ${contentPages} · debate shells: ${debatePages} · call shells: ${callPages} · eip shells: ${eipPages} · erc shells: ${ercPages} · member shells: ${memberPages} · video shells: ${videoPages} · llms.txt: ${recent.length} · llms-full: ${sortedContents.length} · rss: ${feedItems.length}`,
);
