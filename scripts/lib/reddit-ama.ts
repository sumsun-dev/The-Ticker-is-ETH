/**
 * 레딧 AMA 정리의 순수 로직 — Atom 피드 파싱, 원자료 묶기, 모델 출력 스키마, 콜 레코드 조립.
 * I/O(피드 수집, claude 호출, 파일 쓰기)는 scripts/extract-reddit-ama.ts가 맡는다.
 *
 * EF 프로토콜 클러스터 AMA는 회차마다 같은 모양이다: 운영 계정(Ethereum_AMA)이 사전 질문을
 * "user X asks:"로 옮겨 달고, 클러스터 구성원들이 답글로 답한다. 여기서는 원자료에 번호를 매겨
 * 모델이 인용한 항목을 번호로 되짚을 수 있게 한다 (코어 개발자 콜 추출과 같은 방식).
 */
import { z } from 'zod';
import { extractEipNumbers } from './eth-debates';
import type { CallPosition, CallRecord, CallSpeaker, CallTopic } from './eth-calls';

/** 피드 항목 하나. kind: post(게시물 본문) · question(운영 계정이 옮긴 사전 질문) · comment(그 외 댓글, 답변과 현장 질문이 섞여 있다) */
export interface AmaItem {
  n: number;
  author: string;
  url: string;
  updated: string;
  kind: 'post' | 'question' | 'comment';
  /** 사전 질문을 보낸 사람 (운영 계정이 옮긴 경우) */
  asker?: string;
  text: string;
}

/** 엔티티 한 번 풀기. 레딧 본문은 &amp;#39; 처럼 두 번 감싸인 것이 있어 &amp;를 먼저 푼다 */
const decode = (text: string): string =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#32;/g, ' ')
    .replace(/&nbsp;/g, ' ');

/** 레딧 Atom의 content는 HTML을 엔티티로 감싼 문자열이다. 두 번 풀어(이중 인코딩 대비) 태그를 걷어낸다 */
const strip = (content: string): string =>
  decode(decode(content))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tagOf = (entry: string, tag: string): string => new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(entry)?.[1] ?? '';

/** 레딧 댓글 Atom 피드 → 항목 목록. 번호는 1부터, 피드 순서 그대로 */
export function parseAmaFeed(xml: string): AmaItem[] {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
  return entries.map((entry, i) => {
    const author = (/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(entry)?.[1] ?? '?').replace('/u/', '');
    const text = strip(tagOf(entry, 'content'));
    const asked = /^user (\S+) asks:\s*(.*)$/.exec(text);
    return {
      n: i + 1,
      author,
      url: /<link href="([^"]+)"/.exec(entry)?.[1] ?? '',
      updated: tagOf(entry, 'updated').slice(0, 19),
      kind: asked ? 'question' : text.includes('Prior AMAs') ? 'post' : 'comment',
      ...(asked ? { asker: asked[1] } : {}),
      text: asked ? asked[2] : text,
    };
  });
}

/**
 * 모델에 넣을 원자료. 사전 질문은 전부 넣고, 댓글은 긴 것부터 예산만큼 넣은 뒤 원래 순서로 되돌린다.
 * 예산을 바이트로 재는 이유: 헤드리스 CLI는 프롬프트를 명령 인자 하나로 넘기고 리눅스 한계가 131,072바이트다.
 */
export function amaInput(items: ReadonlyArray<AmaItem>, maxBytes = 90_000, itemChars = 2_000): string {
  const line = (it: AmaItem) => `[${it.n}] ${it.kind === 'question' ? `질문(${it.asker ?? '익명'})` : `@${it.author}`}: ${it.text.slice(0, itemChars)}`;
  const questions = items.filter((i) => i.kind === 'question');
  const comments = [...items.filter((i) => i.kind === 'comment')].sort((a, b) => b.text.length - a.text.length);
  const picked = new Set(questions.map((q) => q.n));
  let used = questions.reduce((n, q) => n + Buffer.byteLength(line(q), 'utf-8') + 1, 0);
  for (const c of comments) {
    const size = Buffer.byteLength(line(c), 'utf-8') + 1;
    if (used + size > maxBytes) continue;
    picked.add(c.n);
    used += size;
  }
  return items.filter((i) => picked.has(i.n)).map(line).join('\n');
}

export const AmaDraftSchema = z.object({
  headline: z.string().min(2).max(60),
  lead: z.string().min(4).max(80),
  intro: z.string().min(4).max(120),
  summary: z.string().min(20).max(600),
  whyItMatters: z.string().min(20).max(600),
  /**
   * 브리프 한 메시지에 들어갈 핵심 한 줄들. 질문이 아니라 답의 알맹이를 적는다 (2026-09-16 오너 "인사이트도 너무 없다").
   * 하한을 두지 않는다: 이것 때문에 정리 전체가 반려되면 손해가 크다. 비면 캡션이 주제 제목으로 대신한다.
   */
  highlights: z.array(z.string().min(10).max(200)).max(6).optional().transform((a) => a ?? []),
  topics: z
    .array(
      z.object({
        title: z.string().min(2).max(100),
        intro: z.string().min(4).max(400),
        positions: z
          .array(z.object({ n: z.number().int().min(1), speaker: z.string().min(1).max(80), text: z.string().min(4).max(700) }))
          .min(1)
          .transform((a) => a.slice(0, 8)),
      }),
    )
    .min(1)
    .transform((a) => a.slice(0, 6)),
  // 용어집은 덤이다. 길이가 넘쳤다고 정리 전체를 버리지 않고 잘라서 쓴다 (2026-09-16: term 3건이 40자를 넘겨 초안이 통째로 반려됨)
  glossary: z
    .array(z.object({ term: z.string().min(1).max(200), def: z.string().min(1).max(400) }))
    .default([])
    .transform((a) => a.slice(0, 8).map((g) => ({ term: g.term.slice(0, 48), def: g.def.slice(0, 160) }))),
});
export type AmaDraft = z.infer<typeof AmaDraftSchema>;

/** 명단에서 확인된 사람만 실명·소속을 붙인다. 못 찾으면 레딧 핸들 그대로 (지어내지 않는다) */
export interface RosterEntry {
  name: string;
  org?: string;
  role?: string;
  handle?: string;
  avatar?: string;
}

/** 사람이 아닌 계정: 운영 계정이 사전 질문을 옮겨 달고, 모더레이터가 공지를 올린다. 참여자 명단에서 뺀다 */
export const RELAY_ACCOUNTS = new Set(['ethereum_ama', 'automoderator', 'jbschweitzer']);

/** 인용된 사람만 참여자로 올린다. 비중은 인용 분량 비율 */
export function amaSpeakers(topics: ReadonlyArray<CallTopic>, roster: Record<string, RosterEntry>): CallSpeaker[] {
  const chars = new Map<string, number>();
  for (const t of topics) {
    for (const p of t.positions) {
      if (RELAY_ACCOUNTS.has(p.speaker.toLowerCase())) continue;
      chars.set(p.speaker, (chars.get(p.speaker) ?? 0) + (p.original?.length ?? p.text.length));
    }
  }
  const max = Math.max(1, ...chars.values());
  return [...chars.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => {
      const known = roster[label.toLowerCase()];
      return {
        label,
        name: known?.name ?? label,
        ...(known?.org ? { org: known.org } : {}),
        ...(known?.role ? { role: known.role } : {}),
        ...(known?.handle ? { handle: known.handle } : {}),
        ...(known?.avatar ? { avatar: known.avatar } : {}),
        share: Math.round((n / max) * 100) / 100,
      };
    });
}

/** 초안 + 원자료 → 콜 레코드. AMA에는 결정·일정·안건이 없으므로 비운다 */
export function buildAmaRecord(args: {
  meta: { id: string; series: string; number: number; date: string; title: string; forkcastUrl: string };
  draft: AmaDraft;
  items: ReadonlyArray<AmaItem>;
  roster: Record<string, RosterEntry>;
  debates: ReadonlyArray<{ id: string; title: string; summary: string; keywords?: string[] }>;
}): CallRecord {
  const byN = new Map(args.items.map((i) => [i.n, i]));
  const topics: CallTopic[] = args.draft.topics.map((t) => ({
    title: t.title,
    intro: t.intro,
    positions: t.positions.map((p): CallPosition => {
      const src = byN.get(p.n);
      return { speaker: src?.author ?? p.speaker, text: p.text, ...(src ? { original: src.text.slice(0, 1_200) } : {}) };
    }),
  }));
  const eipText = [args.draft.summary, args.draft.whyItMatters, ...topics.flatMap((t) => [t.title, t.intro, ...t.positions.map((p) => `${p.text} ${p.original ?? ''}`)])].join('\n');
  const eips = [...new Set(extractEipNumbers(eipText))].sort((a, b) => a - b);
  return {
    ...args.meta,
    kind: 'full',
    headline: args.draft.headline,
    lead: args.draft.lead,
    intro: args.draft.intro,
    summary: args.draft.summary,
    whyItMatters: args.draft.whyItMatters,
    highlights: args.draft.highlights,
    decisions: [],
    targets: [],
    actions: [],
    agenda: [],
    topics,
    speakers: amaSpeakers(topics, args.roster),
    chat: [],
    glossary: args.draft.glossary,
    eips,
    relatedDebates: args.debates
      .filter((d) => extractEipNumbers(`${d.title}\n${d.summary}\n${(d.keywords ?? []).join(' ')}`).some((n) => eips.includes(n)))
      .map((d) => d.id),
  };
}
