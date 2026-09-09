/**
 * LinkedIn 회사 페이지 게시 캡션 — 순수 로직 (테스트 대상).
 * 다이제스트 하나를 커버 이미지 한 장 + 본문으로 올린다. 본문은 LinkedIn 컴포저에 그대로 타이핑되므로 이스케이프가 없다.
 */

/** LinkedIn 게시 본문 상한 */
export const CAPTION_MAX = 3000;

export interface DigestLike {
  date: string;
  title: string;
  intro: string;
  subTitle?: string;
  sections: Array<{ heading: string; items: Array<{ title: string; url: string; source: string }> }>;
  telegramMessageId?: number;
}

/** 본문에 싣는 핵심 구분 (이 키워드가 포함된 섹션만, 텔레그램 캡션과 같은 기준 + 코어 개발자 콜) */
export const CORE_SECTION_KEYWORDS = ['인사이트', '코어 개발자 콜', '프로토콜', '포럼', '논쟁', '발언'];
export const DEFAULT_TAGS = ['Ethereum', '이더리움', 'ECK', 'TheTickerIsETH'];

export function hashtag(word: string): string {
  const clean = word.replace(/[^\p{L}\p{N}]/gu, '');
  return clean ? `#${clean}` : '';
}

/**
 * 다이제스트 → 캡션. 제목, 인트로, 핵심 구분별 항목 제목, 사이트 링크, 해시태그.
 * 상한을 넘으면 항목을 뒤에서부터 빼고, 소제목만 남은 구분은 통째로 뺀다.
 */
export function formatDigestCaption(digest: DigestLike, siteUrl: string, tags: string[] = DEFAULT_TAGS): string {
  const head = [digest.title.trim(), '', digest.intro.trim()];
  const foot = ['', `전체 요약 보기: ${siteUrl}`, '', tags.map(hashtag).filter(Boolean).join(' ')];
  const core = digest.sections.filter((s) => CORE_SECTION_KEYWORDS.some((k) => s.heading.includes(k)));
  const bodyLines: string[] = [];
  for (const section of core) {
    bodyLines.push('', `■ ${section.heading}`);
    for (const item of section.items) bodyLines.push(`· ${item.title}`);
  }
  const build = (lines: string[]) => [...head, ...lines, ...foot].join('\n');
  let body = bodyLines;
  let out = build(body);
  while (out.length > CAPTION_MAX && body.length > 0) {
    body = body.slice(0, -1);
    while (body.length > 0 && body[body.length - 1].startsWith('■ ')) body = body.slice(0, -1);
    while (body.length > 0 && body[body.length - 1] === '') body = body.slice(0, -1);
    out = build(body);
  }
  if (out.length > CAPTION_MAX) out = `${out.slice(0, CAPTION_MAX - 1)}…`;
  return out;
}

/**
 * 게시할 다이제스트 고르기: 텔레그램에 실제 송출된 것(telegramMessageId) 중 아직 안 올린 것, 최근 maxAgeDays 안, 오래된 순.
 * 러너가 커밋한 뒤 사이트 배포까지 10분쯤 걸리므로 커버 이미지가 라이브에 있는지는 호출부가 확인한다.
 */
export function pickDigestsToPost<T extends Pick<DigestLike, 'date' | 'telegramMessageId'>>(digests: ReadonlyArray<T>, seen: ReadonlyArray<string>, today: string, maxAgeDays = 3): T[] {
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - maxAgeDays);
  const min = cutoff.toISOString().slice(0, 10);
  return digests.filter((d) => d.telegramMessageId && !seen.includes(d.date) && d.date >= min).sort((a, b) => a.date.localeCompare(b.date));
}
