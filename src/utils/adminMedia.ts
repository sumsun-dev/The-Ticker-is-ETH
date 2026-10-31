/**
 * 성과 대시보드 이미지. 텔레그램 글은 사이트 콘텐츠(tg-{id})의 썸네일을, 링크드인 글은 같은 내용으로 시작하는
 * 텔레그램 글의 썸네일을 빌려 쓴다. 영상·행사 페이지는 정해진 대표 이미지가 있다.
 */
import type { TgPostRecord } from '../types/adminStats';
import { thumbUrl } from '../data/videoData';

export type ThumbIndex = Map<string, string>;

export const thumbIndex = (items: ReadonlyArray<{ id: string; thumbnailUrl?: string }>): ThumbIndex =>
  new Map(items.filter((x) => x.thumbnailUrl).map((x) => [x.id, x.thumbnailUrl as string]));

export const tgThumb = (id: number, idx: ThumbIndex): string | null => idx.get(`tg-${id}`) ?? null;

/** 고정 대표 이미지가 있는 페이지 */
const PAGE_IMAGES: Record<string, string> = {
  '/': '/assets/eck-og.png',
  '/events/ek1-genesis': '/assets/events/ek1-genesis/main-banner.jpg',
};

export function pageThumb(path: string, idx: ThumbIndex): string | null {
  const video = /^\/contents\/videos\/([\w-]{11})$/.exec(path);
  if (video) return thumbUrl(video[1]);
  const content = /^\/contents\/([^/?#]+)$/.exec(path);
  if (content) return idx.get(content[1]) ?? null;
  return PAGE_IMAGES[path] ?? null;
}

/** 비교용: 글자·숫자만, 소문자 */
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
/** 앞부분이 이만큼 같으면 같은 글로 본다 */
const MATCH_CHARS = 16;

export function liThumb(title: string, tgPosts: ReadonlyArray<TgPostRecord>, idx: ThumbIndex): string | null {
  const head = norm(title).slice(0, MATCH_CHARS);
  if (head.length < MATCH_CHARS) return null;
  for (let i = tgPosts.length - 1; i >= 0; i--) {
    const p = tgPosts[i];
    if (norm(p.text).startsWith(head)) return tgThumb(p.id, idx);
  }
  return null;
}

/** 텔레그램 글 번호 → 작성자. 사이트 인덱스(tg-{id})에 붙은 작성자를 쓴다 */
export type AuthorIndex = Map<number, { name: string; avatar: string }>;
export const authorIndex = (items: ReadonlyArray<{ id: string; author?: string; authorAvatar?: string }>): AuthorIndex =>
  new Map(items.filter((x) => x.author && /^tg-\d+$/.test(x.id)).map((x) => [Number(x.id.slice(3)), { name: x.author as string, avatar: x.authorAvatar ?? '' }]));
