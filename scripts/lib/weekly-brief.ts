/**
 * 기자 그룹방용 주간 브리프의 순수 로직 — 채널 글 구간 필터, 출처 화이트리스트, 텔레그램 HTML 포맷, 4096자 분할.
 * LLM 호출과 송출은 scripts/post-weekly-brief.ts가 맡는다.
 */
import { z } from 'zod';

export const SITE = 'https://ethcollective.xyz';
export const TELEGRAM_LIMIT = 4096;

export const BriefSchema = z.object({
  /** 이번 주를 한 줄로 */
  title: z.string(),
  /** 이번 주 흐름 2~3문장 */
  overview: z.string(),
  /** 중요한 순서 */
  topics: z.array(
    z.object({
      heading: z.string(),
      text: z.string(),
      sources: z.array(z.object({ label: z.string(), url: z.string() })),
    }),
  ),
  /** 다음 주 이후 일정, "10.26 후디 테스트넷 글램스테르담 포크" 형태 */
  upcoming: z.array(z.string()),
});
export type Brief = z.infer<typeof BriefSchema>;

const DAY = 24 * 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** 'YYYY.MM.DD'·'YYYY-MM-DD'·ISO 시각을 'YYYY-MM-DD'로 */
export const normDate = (s: string | undefined): string => (s ?? '').slice(0, 10).replace(/\./g, '-');

/** end(포함)로 끝나는 7일 구간 */
export function weekWindow(end: string): { start: string; end: string } {
  return { start: iso(new Date(Date.parse(end) - 6 * DAY)), end };
}

export const inWindow = (date: string | undefined, w: { start: string; end: string }): boolean => {
  const d = normDate(date);
  return d >= w.start && d <= w.end;
};

/**
 * "2026년 10월 2주차" — 그 주 목요일이 속한 달 기준 (월요일 시작 주에서 통용되는 주차 계산).
 * ponytail: 월요일 시작이 아닌 구간을 수동으로 넣으면 주차가 하루 이틀 어긋날 수 있다. 헤더 표기만 영향받는다
 */
export function weekLabel(w: { start: string; end: string }): string {
  const thu = new Date(Date.parse(w.start) + 3 * DAY);
  const [, sm, sd] = w.start.split('-').map(Number);
  const [, em, ed] = w.end.split('-').map(Number);
  return `${thu.getUTCFullYear()}년 ${thu.getUTCMonth() + 1}월 ${Math.ceil(thu.getUTCDate() / 7)}주차 (${sm}.${sd} ~ ${em}.${ed})`;
}

/** 본문에서 http(s) URL을 뽑는다 (출처 화이트리스트용) */
export const extractUrls = (text: string): string[] => text.match(/https?:\/\/[^\s)<>"'\]]+/g) ?? [];

/** 모델이 입력에 없는 링크를 지어내지 못하게, 입력에 있던 URL만 남긴다. 출처가 다 빠진 주제는 그대로 둔다(사실은 입력 기반) */
export function keepKnownSources(brief: Brief, allowed: Set<string>): { brief: Brief; dropped: string[] } {
  const dropped: string[] = [];
  const topics = brief.topics.map((t) => ({
    ...t,
    sources: t.sources.filter((src) => {
      const ok = allowed.has(src.url);
      if (!ok) dropped.push(src.url);
      return ok;
    }),
  }));
  return { brief: { ...brief, topics }, dropped };
}

export interface ChannelPostLike {
  id: number;
  date: string;
  [k: string]: unknown;
}

/** 채널 글의 KST 날짜 'YYYY-MM-DD' */
export const kstDate = (iso: string): string => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);

/** 구간(KST 날짜, 양 끝 포함)에 든 글만 id 순으로 */
export const weekPosts = <T extends ChannelPostLike>(posts: T[], w: { start: string; end: string }): T[] =>
  posts.filter((p) => p.date && kstDate(p.date) >= w.start && kstDate(p.date) <= w.end).sort((a, b) => a.id - b.id);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;');
/** 오너 지시(2026-10-14): ECK 사이트 링크는 모델 라벨·순서와 상관없이 "ECK"로 적고 맨 앞에 둔다 */
const isEck = (s: { url: string }) => s.url.startsWith(SITE);
const eckFirst = <T extends { url: string }>(sources: T[]): T[] => [...sources.filter(isEck), ...sources.filter((s) => !isEck(s))];
const sourceLabel = (s: { label: string; url: string }) => (isEck(s) ? 'ECK' : s.label);

/** 텔레그램 HTML 블록 목록. 메시지에서는 빈 줄로 이어 붙이고, splitMessages는 블록 경계에서만 자른다. 주제 하나가 한 블록이라 두 통에 걸쳐 잘리지 않는다 */
export function briefBlocks(brief: Brief, w: { start: string; end: string }): string[] {
  const blocks: string[] = [`<b>[ECK 주간 브리프]</b> ${weekLabel(w)}`, `<b>${esc(brief.title)}</b>\n${esc(brief.overview)}`];
  brief.topics.forEach((t, i) => {
    const lines = [`<b>${i + 1}. ${esc(t.heading)}</b>`, esc(t.text)];
    if (t.sources.length) lines.push(eckFirst(t.sources).map((s) => `<a href="${escAttr(s.url)}">${esc(sourceLabel(s))}</a>`).join(' · '));
    blocks.push(lines.join('\n'));
  });
  if (brief.upcoming.length) blocks.push(`<b>다음 일정</b>\n${brief.upcoming.map(esc).join('\n')}`);
  return blocks;
}

/**
 * maxMessages통에 들어갈 때까지 뒤쪽(덜 중요한) 주제부터 뺀다. 뺀 heading 을 돌려준다
 */
export function fitMessages(brief: Brief, w: { start: string; end: string }, maxMessages = 2, limit = TELEGRAM_LIMIT): { brief: Brief; messages: string[]; dropped: string[] } {
  let cur = brief;
  const dropped: string[] = [];
  let messages = splitMessages(briefBlocks(cur, w), limit);
  while (messages.length > maxMessages && cur.topics.length > 0) {
    dropped.push(cur.topics[cur.topics.length - 1].heading);
    cur = { ...cur, topics: cur.topics.slice(0, -1) };
    messages = splitMessages(briefBlocks(cur, w), limit);
  }
  return { brief: cur, messages, dropped };
}

/**
 * 4096자 한도에 맞춰 블록(빈 줄) 경계에서 나눈다. 태그가 블록 안에서 닫히므로 HTML이 깨지지 않는다.
 * ponytail: 한도는 태그 포함 길이로 센다(텔레그램은 보이는 글자 기준). 실제보다 일찍 나뉠 뿐 넘치지는 않는다
 */
export function splitMessages(blocks: string[], limit = TELEGRAM_LIMIT): string[] {
  const out: string[] = [];
  let cur = '';
  for (const block of blocks) {
    if (block.length > limit) throw new Error(`block longer than ${limit} chars`);
    const next = cur ? `${cur}\n\n${block}` : block;
    if (next.length > limit) {
      out.push(cur);
      cur = block;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
}
