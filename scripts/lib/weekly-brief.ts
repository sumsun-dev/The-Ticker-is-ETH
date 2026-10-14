/**
 * 기자 그룹방용 주간 브리프의 순수 로직 — 입력 수집 범위, 출처 화이트리스트, 텔레그램 HTML 포맷, 4096자 분할.
 * LLM 호출과 송출은 scripts/post-weekly-brief.ts가 맡는다.
 */
import { z } from 'zod';

export const SITE = 'https://ethcollective.xyz';
export const TELEGRAM_LIMIT = 4096;

export const SECTION_HEADINGS = ['프로토콜 · 코어 개발', '업계 동향', '커뮤니티 논쟁'] as const;

export const BriefSchema = z.object({
  /** 이번 주 핵심, 1~2문장 */
  headline: z.string(),
  sections: z.array(
    z.object({
      heading: z.enum(SECTION_HEADINGS),
      items: z.array(
        z.object({
          title: z.string(),
          /** MM.DD (사건 날짜, 모르면 빈 문자열) */
          date: z.string(),
          summary: z.string(),
          sources: z.array(z.object({ label: z.string(), url: z.string() })),
        }),
      ),
    }),
  ),
  /** 다음 주 일정, "10.26 후디 테스트넷 글램스터담 포크" 형태 */
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

/** 모델이 입력에 없는 링크를 지어내지 못하게, 입력에 있던 URL만 남긴다. 출처가 다 빠진 항목은 그대로 둔다(사실은 입력 기반) */
export function keepKnownSources(brief: Brief, allowed: Set<string>): { brief: Brief; dropped: string[] } {
  const dropped: string[] = [];
  const sections = brief.sections.map((s) => ({
    ...s,
    items: s.items.map((item) => ({
      ...item,
      sources: item.sources.filter((src) => {
        const ok = allowed.has(src.url);
        if (!ok) dropped.push(src.url);
        return ok;
      }),
    })),
  }));
  return { brief: { ...brief, sections }, dropped };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;');

/** 텔레그램 HTML 블록 목록. 메시지에서는 빈 줄로 이어 붙이고, splitMessages는 블록 경계에서만 자른다 */
export function briefBlocks(brief: Brief, w: { start: string; end: string }): string[] {
  const blocks: string[] = [
    `<b>The Ticker is ETH 주간 브리프</b>\n${weekLabel(w)}\nEthereum Collective Korea(ECK)가 한 주간의 이더리움 생태계 주요 소식을 정리해 드립니다.`,
    `<b>[이번 주 핵심]</b>\n${esc(brief.headline)}`,
  ];
  for (const section of brief.sections) {
    if (!section.items.length) continue;
    section.items.forEach((item, i) => {
      const title = item.date ? `${item.title} (${item.date})` : item.title;
      const lines = [`<b>${esc(title)}</b>`, esc(item.summary)];
      if (item.sources.length) {
        lines.push(`출처: ${item.sources.map((s) => `<a href="${escAttr(s.url)}">${esc(s.label)}</a>`).join(' · ')}`);
      }
      // 섹션 제목은 첫 항목과 한 블록으로 묶어, 메시지가 나뉠 때 제목만 앞 메시지 끝에 남지 않게 한다
      if (i === 0) lines.unshift(`<b>[${section.heading}]</b>`, '');
      blocks.push(lines.join('\n'));
    });
  }
  if (brief.upcoming.length) {
    blocks.push(`<b>[다음 주 일정]</b>\n${brief.upcoming.map((u) => `· ${esc(u)}`).join('\n')}`);
  }
  blocks.push(`<a href="${SITE}">ECK 웹사이트</a>`);
  return blocks;
}

export const formatBrief = (brief: Brief, w: { start: string; end: string }): string => briefBlocks(brief, w).join('\n\n');

/**
 * 한 메시지(4096자)에 들어갈 때까지 항목이 가장 많은 섹션의 마지막 항목부터 뺀다. 섹션 안 항목은 중요한 순서라고 본다.
 * 빈 섹션은 formatBrief가 건너뛴다
 */
export function fitOneMessage(brief: Brief, w: { start: string; end: string }, limit = TELEGRAM_LIMIT): { brief: Brief; dropped: string[] } {
  let cur = brief;
  const dropped: string[] = [];
  while (formatBrief(cur, w).length > limit) {
    const target = cur.sections.reduce((a, b) => (b.items.length > a.items.length ? b : a));
    if (target.items.length === 0) break;
    dropped.push(target.items[target.items.length - 1].title);
    cur = { ...cur, sections: cur.sections.map((s) => (s === target ? { ...s, items: s.items.slice(0, -1) } : s)) };
  }
  return { brief: cur, dropped };
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
