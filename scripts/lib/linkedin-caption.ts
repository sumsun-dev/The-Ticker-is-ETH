/**
 * LinkedIn 회사 페이지 게시 — 순수 로직 (테스트 대상).
 * 텔레그램 채널(@thetickeriseth) 공개 웹 뷰의 글을 LinkedIn 게시물(본문 + 첫 댓글)로 바꾼다.
 * 본문에는 URL을 넣지 않는다(외부 링크가 있는 글은 노출이 줄어든다, 오너 지시). 링크는 모두 첫 댓글로.
 */

/** LinkedIn 게시 본문 상한 */
export const CAPTION_MAX = 3000;
export const CHANNEL_URL = 'https://t.me/thetickeriseth';

export interface DigestLike {
  date: string;
  title: string;
  intro: string;
  subTitle?: string;
  sections: Array<{ heading: string; items: Array<{ title: string; url: string; source: string }> }>;
  telegramMessageId?: number;
}

/** 본문에 싣는 핵심 구분 (이 키워드가 포함된 섹션만) */
export const CORE_SECTION_KEYWORDS = ['인사이트', '코어 개발자 콜', '프로토콜', '포럼', '논쟁', '발언'];
export const DEFAULT_TAGS = ['Ethereum', '이더리움', 'ECK', 'TheTickerIsETH'];

export function hashtag(word: string): string {
  const clean = word.replace(/[^\p{L}\p{N}]/gu, '');
  return clean ? `#${clean}` : '';
}

const tagLine = (tags: string[]) => tags.map(hashtag).filter(Boolean).join(' ');

/** 상한을 넘으면 body 줄을 뒤에서부터 빼고, 소제목만 남은 구분은 통째로 뺀다 */
function fitLines(head: string[], body: string[], foot: string[]): string {
  const build = (lines: string[]) => [...head, ...lines, ...foot].join('\n');
  let out = build(body);
  while (out.length > CAPTION_MAX && body.length > 0) {
    body = body.slice(0, -1);
    while (body.length > 0 && body[body.length - 1].startsWith('■ ')) body = body.slice(0, -1);
    while (body.length > 0 && body[body.length - 1] === '') body = body.slice(0, -1);
    out = build(body);
  }
  return out.length > CAPTION_MAX ? `${out.slice(0, CAPTION_MAX - 1)}…` : out;
}

/**
 * 다이제스트 → 본문. 제목, 인트로, 핵심 구분별 항목 제목, 해시태그. URL은 넣지 않는다.
 */
export function formatDigestCaption(digest: DigestLike, tags: string[] = DEFAULT_TAGS): string {
  const head = [digest.title.trim(), '', digest.intro.trim()];
  const foot = ['', tagLine(tags)];
  const core = digest.sections.filter((s) => CORE_SECTION_KEYWORDS.some((k) => s.heading.includes(k)));
  const body: string[] = [];
  for (const section of core) {
    body.push('', `■ ${section.heading}`);
    for (const item of section.items) body.push(`· ${item.title}`);
  }
  return fitLines(head, body, foot);
}

/* ---------- 텔레그램 공개 채널 웹 뷰 (t.me/s/<channel>) ---------- */

export interface ChannelPost {
  id: number;
  date: string;
  /** 첫 사진 URL (없으면 undefined) */
  photo?: string;
  /** 본문 HTML (b, i, br, a 정도) */
  html: string;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#036;': '$', '&nbsp;': ' ' };
export function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|nbsp|#39|#036);/g, (m) => ENTITIES[m] ?? m).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** t.me/s 페이지 HTML → 글 목록(오래된 순) */
export function parseChannelPage(html: string, channel: string): ChannelPost[] {
  const posts: ChannelPost[] = [];
  const re = new RegExp(`data-post="${channel}/(\\d+)"`, 'g');
  const starts = [...html.matchAll(re)].map((m) => ({ id: Number(m[1]), at: m.index ?? 0 }));
  for (let i = 0; i < starts.length; i++) {
    const block = html.slice(starts[i].at, starts[i + 1]?.at ?? html.length);
    const date = /<time[^>]*datetime="([^"]+)"/.exec(block)?.[1] ?? '';
    const photo = /tgme_widget_message_photo_wrap[^>]*style="[^"]*url\('([^']+)'\)/.exec(block)?.[1];
    const text = /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1] ?? '';
    posts.push({ id: starts[i].id, date, ...(photo ? { photo } : {}), html: text });
  }
  return posts.sort((a, b) => a.id - b.id);
}

export interface PlainText {
  text: string;
  /** 본문에 있던 링크 [{label, url}], 등장 순 */
  links: Array<{ label: string; url: string }>;
}

/** 채널 글 HTML → 평문. <br>은 줄바꿈, <a>는 라벨만 남기고 URL은 links로. 태그는 제거, 엔티티는 복원 */
export function channelHtmlToText(html: string): PlainText {
  const links: Array<{ label: string; url: string }> = [];
  let s = html.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    const label = decodeEntities(inner.replace(/<[^>]+>/g, '')).trim();
    const url = decodeEntities(href);
    links.push({ label, url });
    // 라벨이 곧 URL이거나 "링크" 같은 자리표시자면 본문에서 뺀다
    return /^https?:\/\//.test(label) || /^(링크|link)$/i.test(label) ? '' : label;
  });
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*(→|:)\s*$/gm, '')
    .trim();
  return { text: s, links };
}

/** 본문 텍스트에서 URL과 "전체 요약 보기 → url" 같은 링크 안내 줄을 걷어낸다 */
export function stripUrls(text: string): { text: string; urls: string[] } {
  const urls = [...text.matchAll(/https?:\/\/[^\s<>()]+/g)].map((m) => m[0]);
  const cleaned = text
    .split('\n')
    .map((line) => line.replace(/https?:\/\/[^\s<>()]+/g, '').replace(/\s*(→|:)\s*$/, '').trimEnd())
    .filter((line, i, arr) => !(line.trim() === '' && (arr[i - 1] ?? '').trim() === ''))
    .join('\n')
    .replace(/\n*(전체 요약 보기|자세히 보기|원문 보기)\s*$/gm, '')
    .trim();
  return { text: cleaned, urls };
}

export const DIGEST_LINK = /ethcollective\.xyz\/news\?date=(\d{4}-\d{2}-\d{2})/;

export interface LinkedInPost {
  body: string;
  /** 첫 댓글. 링크는 여기에만 */
  comment: string;
  photo?: string;
  /** 매칭된 다이제스트 날짜 (있으면) */
  digestDate?: string;
}

/**
 * 채널 글 → LinkedIn 게시물. 다이제스트 글(사이트 링크의 date로 판별)이면 다이제스트 데이터의 풍부한 본문을 쓰고,
 * 그 밖의 글은 채널 본문에서 URL을 걷어낸 뒤 해시태그를 붙인다. 링크는 모두 첫 댓글로.
 */
export function buildLinkedInPost(post: ChannelPost, digests: ReadonlyArray<DigestLike>, tags: string[] = DEFAULT_TAGS): LinkedInPost {
  const plain = channelHtmlToText(post.html);
  const stripped = stripUrls(plain.text);
  const allUrls = [...new Set([...plain.links.map((l) => l.url), ...stripped.urls])];
  const digestDate = allUrls.map((u) => DIGEST_LINK.exec(u)?.[1]).find(Boolean) ?? digests.find((d) => d.telegramMessageId === post.id)?.date;
  const digest = digestDate ? digests.find((d) => d.date === digestDate) : undefined;

  const commentLines: string[] = [];
  if (digest) {
    // 다이제스트는 항목마다 출처 링크가 달려 있어 댓글에 다 옮기면 수십 개가 된다. 사이트 링크 하나로 갈음
    commentLines.push(`전체 요약 보기: https://ethcollective.xyz/news?date=${digest.date}`);
  } else {
    for (const l of plain.links) {
      const label = l.label && !/^https?:\/\//.test(l.label) && !/^(링크|link)$/i.test(l.label) ? l.label : '원문';
      commentLines.push(`${label}: ${l.url}`);
    }
    for (const u of stripped.urls) if (!plain.links.some((l) => l.url === u)) commentLines.push(`원문: ${u}`);
  }
  commentLines.push(`텔레그램 채널 The Ticker is ETH: ${CHANNEL_URL}`);

  const body = digest ? formatDigestCaption(digest, tags) : fitLines([stripped.text], [], ['', tagLine(tags)]);
  return { body, comment: [...new Set(commentLines)].join('\n'), ...(post.photo ? { photo: post.photo } : {}), ...(digestDate ? { digestDate } : {}) };
}

/** 게시할 채널 글: 아직 안 올린 것 중 최근 maxAgeDays 안, 오래된 순 */
export function pickChannelPosts(posts: ReadonlyArray<ChannelPost>, seen: ReadonlyArray<number>, now: Date, maxAgeDays = 3): ChannelPost[] {
  const min = now.getTime() - maxAgeDays * 86_400_000;
  return posts.filter((p) => !seen.includes(p.id) && p.html.trim() && Date.parse(p.date) >= min).sort((a, b) => a.id - b.id);
}
