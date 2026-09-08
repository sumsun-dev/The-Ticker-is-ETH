/**
 * 코어 개발자 콜 기록 — 순수 로직 (I/O 없음, 테스트 대상).
 * Forkcast 아티팩트(결정·요약·노트·발화자 자막·채팅)를 콜 레코드로 만들고, 사이트와 텔레그램 브리프가 같은 레코드를 쓴다.
 * 타입은 src/data/ethCallsData.ts에 같은 모양으로 다시 적혀 있다 (src는 scripts를 import하지 않는다).
 */
import { z } from 'zod';
import { extractEipNumbers } from './eth-debates';

export const CALL_SERIES: Record<string, { pill: string; name: string; ko: string }> = {
  acde: { pill: 'ACDE', name: 'All Core Devs · Execution', ko: '실행 계층(EL) 클라이언트 개발자 격주 콜' },
  acdc: { pill: 'ACDC', name: 'All Core Devs · Consensus', ko: '합의 계층(CL) 클라이언트 개발자 격주 콜' },
  acdt: { pill: 'ACDT', name: 'All Core Devs · Testing', ko: '테스트 팀 주간 콜' },
};
/** 결정·토론까지 정리하는 시리즈. 나머지(브레이크아웃 등)는 제목과 링크만 기록한다 */
export const FULL_SERIES = ['acde', 'acdc', 'acdt'] as const;

export const CALL_STATUSES = ['SFI', 'CFI', 'PFI', 'DFI', '보류', '확정', '일정', '기타'] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export interface CallDecision {
  label: string;
  text: string;
  original: string;
  eips: number[];
  status: CallStatus;
  fork?: string;
  timestamp?: string;
}
export interface CallTarget {
  /** 같은 일정을 뒤 콜에서 잇기 위한 슬러그 (예: sepolia-fork) */
  key: string;
  text: string;
  timestamp?: string;
}
export interface CallAction {
  owner: string;
  text: string;
  timestamp?: string;
}
export interface CallAgendaItem {
  timestamp: string;
  heading: string;
  discussion?: boolean;
  decision?: boolean;
}
export interface CallSpeaker {
  /** 자막·채팅의 표기 (레코드 안에서 발언자를 잇는 키) */
  label: string;
  name: string;
  org?: string;
  role?: string;
  handle?: string;
  avatar?: string;
  /** 자막 발언량 비중 0~1 */
  share: number;
}
export interface CallPosition {
  speaker: string;
  text: string;
  timestamp?: string;
  viaChat?: boolean;
  original?: string;
  translation?: string;
}
export interface CallQuote {
  text: string;
  original: string;
  speaker: string;
  timestamp: string;
}
export interface CallTopic {
  title: string;
  intro: string;
  decision?: string;
  positions: CallPosition[];
  quote?: CallQuote;
}
export interface CallChatLine {
  speaker: string;
  text: string;
  timestamp: string;
}
export interface CallGlossaryItem {
  term: string;
  def: string;
}
export interface CallRecord {
  id: string;
  series: string;
  number: number;
  date: string;
  title: string;
  forkcastUrl: string;
  videoUrl?: string;
  issueUrl?: string;
  /** full: 결정·토론까지 정리 / record: 제목·링크만 */
  kind: 'full' | 'record';
  durationMin?: number;
  headline?: string;
  lead?: string;
  intro?: string;
  summary?: string;
  whyItMatters?: string;
  decisions: CallDecision[];
  targets: CallTarget[];
  actions: CallAction[];
  agenda: CallAgendaItem[];
  topics: CallTopic[];
  speakers: CallSpeaker[];
  chat: CallChatLine[];
  glossary: CallGlossaryItem[];
  eips: number[];
  relatedDebates: string[];
}
export interface CallsStatus {
  currentFork?: { name: string; stage: string; line: string };
  nextFork?: { name: string; stage: string; line: string };
  /** 근거가 된 마지막 콜 id */
  basis?: string;
}
export interface CallsFile {
  updatedAt: string;
  status?: CallsStatus;
  calls: CallRecord[];
}

/* ---------- 모델 출력 스키마 (콜당 1회) ---------- */

const ts = z.string().regex(/^\d{2}:\d{2}:\d{2}$/);
const cap = <T,>(n: number) => (a: T[]) => a.slice(0, n);

export const CallDraftSchema = z.object({
  headline: z.string().min(2).max(60),
  lead: z.string().min(4).max(80),
  intro: z.string().min(4).max(120),
  summary: z.string().min(20).max(600),
  whyItMatters: z.string().min(20).max(600),
  decisions: z.array(z.object({ n: z.number().int().min(1), label: z.string().min(2).max(30), text: z.string().min(4).max(400), status: z.enum(CALL_STATUSES) })),
  targets: z.array(z.object({ n: z.number().int().min(1), key: z.string().regex(/^[a-z0-9-]+$/).max(40), text: z.string().min(2).max(300) })).default([]),
  actions: z.array(z.object({ n: z.number().int().min(1), owner: z.string().max(100), text: z.string().min(2).max(300) })).default([]),
  agenda: z.array(z.object({ n: z.number().int().min(1), heading: z.string().min(2).max(100) })).default([]),
  topics: z
    .array(
      z.object({
        title: z.string().min(2).max(100),
        intro: z.string().min(4).max(400),
        agendaN: z.number().int().min(1).optional(),
        decision: z.string().max(100).optional(),
        positions: z
          .array(z.object({ speaker: z.string().min(1).max(80), text: z.string().min(4).max(700), timestamp: ts.optional(), viaChat: z.boolean().optional() }))
          .min(1)
          .transform(cap(8)),
        quote: z.object({ text: z.string().min(4).max(400), original: z.string().min(4).max(600), speaker: z.string().max(80), timestamp: ts }).optional(),
      }),
    )
    .transform(cap(5)),
  chat: z.array(z.object({ speaker: z.string().max(80), text: z.string().max(300), timestamp: z.string().max(10) })).default([]).transform(cap(4)),
  glossary: z.array(z.object({ term: z.string().max(40), def: z.string().max(160) })).default([]).transform(cap(8)),
});
export type CallDraft = z.infer<typeof CallDraftSchema>;

export const StatusDraftSchema = z.object({
  currentFork: z.object({ name: z.string().max(30), stage: z.string().max(30), line: z.string().max(120) }),
  nextFork: z.object({ name: z.string().max(30), stage: z.string().max(30), line: z.string().max(120) }),
});

export const TranslationsSchema = z.object({ translations: z.array(z.object({ n: z.number().int().min(1), text: z.string() })) });

/* ---------- Forkcast 아티팩트 모양 ---------- */

export interface ForkcastDecision {
  original_text: string;
  timestamp?: string;
  type?: string;
  eips?: number[];
  stage_change?: { to?: string };
  fork?: string;
  context?: string;
}
export interface ForkcastTldr {
  highlights?: Record<string, Array<{ timestamp?: string; highlight: string }>>;
  action_items?: Array<{ timestamp?: string; action: string; owner?: string }>;
  decisions?: Array<{ timestamp?: string; decision: string }>;
  targets?: Array<{ timestamp?: string; target: string }>;
}
export interface ForkcastNotes {
  sections?: Array<{ heading: string; summary?: string; timestamp?: string; body?: string }>;
}
export interface ForkcastConfig {
  issue?: number;
  videoUrl?: string;
}

/* ---------- 자막(VTT) ---------- */

export interface Cue {
  t: string;
  sec: number;
  who: string;
  text: string;
}
export interface SpeakerBlock extends Cue {
  endSec: number;
  cues: number;
}

export function tsToSec(t: string): number {
  const [h, m, s] = t.split(':').map(Number);
  return h * 3600 + m * 60 + Math.floor(s);
}
export function secToTs(sec: number): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(sec / 3600))}:${p(Math.floor((sec % 3600) / 60))}:${p(sec % 60)}`;
}

/** WebVTT → 발화자 큐. "이름: 발언" 꼴이 아닌 큐는 who '?' */
export function parseVtt(vtt: string): Cue[] {
  const cues: Cue[] = [];
  for (const cue of vtt.split(/\n\n+/)) {
    const m = /(\d{2}:\d{2}:\d{2})\.\d+ --> [^\n]+\n([\s\S]+)/.exec(cue);
    if (!m) continue;
    const line = m[2].replace(/\s*\n\s*/g, ' ').trim();
    const sp = /^([^:]{1,60}):\s*(.*)$/.exec(line);
    cues.push({ t: m[1], sec: tsToSec(m[1]), who: sp ? sp[1].trim() : '?', text: sp ? sp[2] : line });
  }
  return cues;
}

/** 같은 사람의 연속 큐를 한 블록으로 */
export function mergeBlocks(cues: Cue[]): SpeakerBlock[] {
  const blocks: SpeakerBlock[] = [];
  for (const c of cues) {
    const last = blocks[blocks.length - 1];
    if (last && last.who === c.who) blocks[blocks.length - 1] = { ...last, text: `${last.text} ${c.text}`, endSec: c.sec, cues: last.cues + 1 };
    else blocks.push({ ...c, endSec: c.sec, cues: 1 });
  }
  return blocks;
}

/** 프롬프트용 압축 자막: "[hh:mm:ss] 이름: 발언" 줄 */
export function compressVtt(vtt: string): string {
  return mergeBlocks(parseVtt(vtt))
    .map((b) => `[${b.t}] ${b.who}: ${b.text}`)
    .join('\n');
}

/** 발언량 비중 (큐 수 기준), 많은 순 */
export function speakerShares(cues: Cue[]): Array<{ label: string; cues: number; share: number }> {
  const counts = new Map<string, number>();
  for (const c of cues) if (c.who !== '?') counts.set(c.who, (counts.get(c.who) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  return [...counts.entries()].map(([label, n]) => ({ label, cues: n, share: n / total })).sort((a, b) => b.cues - a.cues);
}

/** 콜 길이(분): 첫 큐부터 마지막 큐까지 */
export function durationMinutes(cues: Cue[]): number | undefined {
  if (cues.length < 2) return undefined;
  return Math.round((cues[cues.length - 1].sec - cues[0].sec) / 60);
}

/**
 * 어떤 사람이 특정 시각 즈음에 한 발언의 원문 발췌. 시각 이전(5초 여유)의 가장 가까운 블록에서 시작해,
 * 같은 사람의 뒤 블록을 gapSec 안이면 이어 붙인다 (다른 사람이 끼어들어도 이어짐). maxChars에서 자른다.
 */
export function excerptAt(blocks: SpeakerBlock[], who: string, timestamp: string, maxChars = 1500, gapSec = 120): string | undefined {
  const sec = tsToSec(timestamp);
  const mine = blocks.filter((b) => b.who === who);
  if (mine.length === 0) return undefined;
  let start = [...mine].reverse().find((b) => b.sec <= sec + 5) ?? mine.find((b) => b.sec >= sec);
  if (!start) return undefined;
  // 시각과 너무 먼 블록(3분 이상 앞)이면 이후 블록으로
  if (sec - start.sec > 180) start = mine.find((b) => b.sec >= sec) ?? start;
  const parts: string[] = [];
  let last = start;
  for (const b of mine.filter((b) => b.sec >= start.sec)) {
    if (b !== start && b.sec - last.endSec > gapSec) break;
    parts.push(b.text);
    last = b;
    if (parts.join(' ').length >= maxChars) break;
  }
  const out = parts.join(' ');
  return out.length > maxChars ? `${out.slice(0, maxChars).replace(/\s+\S*$/, '')}…` : out;
}

/* ---------- 채팅 ---------- */

/** 줌 채팅 로그(탭 구분: 시각, 이름, 내용) → 반응·짧은 줄 제외 */
export function parseChat(chat: string): CallChatLine[] {
  const out: CallChatLine[] = [];
  let current: CallChatLine | null = null;
  for (const raw of chat.split('\n')) {
    const m = /^(\d{2}:\d{2}:\d{2})\t([^\t]+):\t(.*)$/.exec(raw);
    if (m) {
      if (current && current.text.length > 24) out.push(current);
      current = /Reacted to|Removed a/.test(m[3]) ? null : { timestamp: m[1], speaker: m[2].trim(), text: m[3].replace(/^Replying to "[^"]*"\s*/, '').trim() };
    } else if (current && raw.trim()) {
      const cur: CallChatLine = current;
      current = { ...cur, text: `${cur.text} ${raw.trim()}`.trim() };
    }
  }
  if (current && current.text.length > 24) out.push(current);
  return out;
}

/* ---------- 프롬프트 입력 ---------- */

export function numbered<T>(items: T[], line: (x: T, i: number) => string): string {
  return items.map((x, i) => `${i + 1}. ${line(x, i)}`).join('\n');
}

/** 모델에 주는 콜 원자료 묶음. 결정·일정·액션·안건은 번호를 붙여 출력의 n과 맞춘다 */
export function callInput(args: {
  title: string;
  date: string;
  decisions: ForkcastDecision[];
  tldr: ForkcastTldr;
  notes: ForkcastNotes;
  vtt: string;
  chat: CallChatLine[];
  maxTranscriptChars?: number;
}): string {
  const { decisions, tldr, notes } = args;
  const dec = numbered(decisions, (d) => `${d.original_text}${d.fork ? ` [fork: ${d.fork}]` : ''}${d.stage_change?.to ? ` [stage → ${d.stage_change.to}]` : ''}${d.timestamp ? ` (${d.timestamp})` : ''}`);
  const targets = numbered(tldr.targets ?? [], (t) => `${t.target}${t.timestamp ? ` (${t.timestamp})` : ''}`);
  const actions = numbered(tldr.action_items ?? [], (a) => `${a.owner ? `${a.owner} — ` : ''}${a.action}${a.timestamp ? ` (${a.timestamp})` : ''}`);
  const agenda = numbered(notes.sections ?? [], (s) => `${s.timestamp ?? '--:--:--'} ${s.heading}`);
  const highlights = Object.entries(tldr.highlights ?? {})
    .map(([cat, hs]) => `## ${cat}\n${hs.map((h) => `- ${h.highlight}${h.timestamp ? ` (${h.timestamp})` : ''}`).join('\n')}`)
    .join('\n');
  const noteBodies = (notes.sections ?? []).map((s) => `## ${s.timestamp ?? ''} ${s.heading}\n${s.summary ?? ''}\n${s.body ?? ''}`).join('\n\n');
  const chat = args.chat.map((c) => `[${c.timestamp}] ${c.speaker}: ${c.text}`).join('\n');
  return [
    `콜: ${args.title} (${args.date})`,
    `\n[결정 — 번호를 출력의 decisions[].n에 그대로 쓴다]\n${dec || '(없음)'}`,
    `\n[일정·목표 — targets[].n]\n${targets || '(없음)'}`,
    `\n[액션 아이템 — actions[].n]\n${actions || '(없음)'}`,
    `\n[안건 순서 — agenda[].n]\n${agenda || '(없음)'}`,
    `\n[하이라이트]\n${highlights}`,
    `\n[안건별 노트]\n${noteBodies.slice(0, 20_000)}`,
    `\n[자막 — 발화자 표기를 positions[].speaker에 그대로 쓴다]\n${compressVtt(args.vtt).slice(0, args.maxTranscriptChars ?? 160_000)}`,
    `\n[채팅]\n${chat.slice(0, 12_000)}`,
  ].join('\n');
}

/* ---------- 레코드 조립 ---------- */

export interface SpeakerInfo {
  name: string;
  org?: string;
  role?: string;
  handle?: string;
}

/** 자막 표기 → 명단 항목. 정확히 같은 표기가 없으면 이름이 포함되는 항목으로. 명단에 없어도 "이름 | 소속" 표기면 소속만 읽는다 */
export function resolveSpeaker(label: string, roster: Record<string, SpeakerInfo>): SpeakerInfo | undefined {
  if (roster[label]) return roster[label];
  const norm = label.toLowerCase();
  for (const [key, info] of Object.entries(roster)) {
    const k = key.toLowerCase();
    if (k.length >= 3 && (norm.startsWith(`${k} `) || norm.startsWith(`${k} |`) || k.startsWith(`${norm} `) || norm.includes(info.name.toLowerCase()))) return info;
  }
  const m = /^(.{2,}?)\s+\|\s+([^|]+)$/.exec(label);
  if (m) return { name: m[1].trim(), org: m[2].trim() };
  return undefined;
}

/** 이미 만든 레코드에 명단·아바타만 다시 입힌다 (LLM 호출 없음). 표기(label)와 발언 비중은 그대로 */
export function reapplyRoster(record: CallRecord, roster: Record<string, SpeakerInfo>, avatars: Record<string, string | undefined>): CallRecord {
  const speakers = record.speakers.map((s) => {
    const info = resolveSpeaker(s.label, roster);
    const handle = info?.handle || undefined;
    const avatar = handle ? avatars[handle.toLowerCase()] : undefined;
    return {
      label: s.label,
      name: info?.name ?? s.name,
      ...(info?.org ? { org: info.org } : {}),
      ...(info?.role ? { role: info.role } : {}),
      ...(handle ? { handle } : {}),
      ...(avatar ? { avatar } : {}),
      share: s.share,
    };
  });
  return { ...record, speakers };
}

/** 초안의 발화자 표기를 자막에 있는 표기로 정규화 (모델이 실명으로 바꿔 쓴 경우 대비) */
export function canonicalLabel(speaker: string, labels: string[], roster: Record<string, SpeakerInfo>): string {
  if (labels.includes(speaker)) return speaker;
  const s = speaker.toLowerCase();
  const byLabel = labels.find((l) => l.toLowerCase() === s || l.toLowerCase().startsWith(`${s} `) || s.startsWith(l.toLowerCase()));
  if (byLabel) return byLabel;
  const byName = labels.find((l) => resolveSpeaker(l, roster)?.name.toLowerCase() === s);
  return byName ?? speaker;
}

export function buildRecord(args: {
  meta: { id: string; series: string; number: number; date: string; title: string; forkcastUrl: string };
  draft: CallDraft;
  decisions: ForkcastDecision[];
  tldr: ForkcastTldr;
  notes: ForkcastNotes;
  config: ForkcastConfig;
  cues: Cue[];
  chat: CallChatLine[];
  roster: Record<string, SpeakerInfo>;
  avatars: Record<string, string | undefined>;
  debates: ReadonlyArray<{ id: string; title: string; summary: string; keywords?: string[] }>;
}): CallRecord {
  const { draft, decisions: fd, tldr, notes, config, cues, roster } = args;
  const blocks = mergeBlocks(cues);
  const labels = [...new Set(cues.map((c) => c.who).filter((w) => w !== '?'))];
  const chatLabels = [...new Set(args.chat.map((c) => c.speaker))];

  const decisions: CallDecision[] = draft.decisions.flatMap((d) => {
    const src = fd[d.n - 1];
    if (!src) return [];
    return [{ label: d.label, text: d.text, original: src.original_text, eips: src.eips ?? [], status: d.status, fork: src.fork, timestamp: src.timestamp }];
  });
  const targets: CallTarget[] = draft.targets.map((t) => ({ key: t.key, text: t.text, timestamp: tldr.targets?.[t.n - 1]?.timestamp }));
  const actions: CallAction[] = draft.actions.map((a) => ({ owner: a.owner, text: a.text, timestamp: tldr.action_items?.[a.n - 1]?.timestamp }));

  const sections = notes.sections ?? [];
  const topicAgenda = new Set(draft.topics.map((t) => t.agendaN).filter((n): n is number => Boolean(n)));
  const agenda: CallAgendaItem[] = draft.agenda.flatMap((a) => {
    const src = sections[a.n - 1];
    if (!src?.timestamp) return [];
    const next = sections[a.n]?.timestamp;
    const from = tsToSec(src.timestamp);
    const to = next ? tsToSec(next) : Infinity;
    const decision = decisions.some((d) => d.timestamp && tsToSec(d.timestamp) >= from && tsToSec(d.timestamp) < to);
    return [{ timestamp: src.timestamp, heading: a.heading, ...(topicAgenda.has(a.n) ? { discussion: true } : {}), ...(decision ? { decision: true } : {}) }];
  });

  const topics: CallTopic[] = draft.topics.map((t) => ({
    title: t.title,
    intro: t.intro,
    ...(t.decision ? { decision: t.decision } : {}),
    positions: t.positions.map((p) => {
      const speaker = canonicalLabel(p.speaker, p.viaChat ? chatLabels : labels, roster);
      const original = p.viaChat
        ? args.chat.find((c) => c.speaker === speaker && (!p.timestamp || Math.abs(tsToSec(c.timestamp) - tsToSec(p.timestamp)) <= 120))?.text
        : p.timestamp
          ? excerptAt(blocks, speaker, p.timestamp)
          : undefined;
      return { speaker, text: p.text, ...(p.timestamp ? { timestamp: p.timestamp } : {}), ...(p.viaChat ? { viaChat: true } : {}), ...(original ? { original } : {}) };
    }),
    ...(t.quote ? { quote: { ...t.quote, speaker: canonicalLabel(t.quote.speaker, labels, roster) } } : {}),
  }));

  const mentioned = new Set(topics.flatMap((t) => t.positions.map((p) => p.speaker)));
  const speakers: CallSpeaker[] = speakerShares(cues)
    .filter((s) => s.cues >= 2 || mentioned.has(s.label))
    .map((s) => {
      const info = resolveSpeaker(s.label, roster);
      const handle = info?.handle || undefined;
      return {
        label: s.label,
        name: info?.name ?? s.label.replace(/\s+[-|]\s+.*$|\s*\(.*$/, '').trim(),
        ...(info?.org ? { org: info.org } : {}),
        ...(info?.role ? { role: info.role } : {}),
        ...(handle ? { handle } : {}),
        ...(handle && args.avatars[handle.toLowerCase()] ? { avatar: args.avatars[handle.toLowerCase()] } : {}),
        share: Number(s.share.toFixed(3)),
      };
    });
  // 채팅에만 등장한 발언자도 명단에 (비중 0)
  for (const label of mentioned) {
    if (speakers.some((s) => s.label === label)) continue;
    const info = resolveSpeaker(label, roster);
    const handle = info?.handle || undefined;
    speakers.push({
      label,
      name: info?.name ?? label.replace(/\s+[-|]\s+.*$|\s*\(.*$/, '').trim(),
      ...(info?.org ? { org: info.org } : {}),
      ...(info?.role ? { role: info.role } : {}),
      ...(handle ? { handle } : {}),
      ...(handle && args.avatars[handle.toLowerCase()] ? { avatar: args.avatars[handle.toLowerCase()] } : {}),
      share: 0,
    });
  }

  const eipText = [...fd.map((d) => d.original_text), ...Object.values(tldr.highlights ?? {}).flat().map((h) => h.highlight), ...sections.map((s) => s.heading)].join('\n');
  const eips = [...new Set([...decisions.flatMap((d) => d.eips), ...extractEipNumbers(eipText)])].sort((a, b) => a - b);
  const relatedDebates = args.debates
    .filter((d) => extractEipNumbers(`${d.title}\n${d.summary}\n${(d.keywords ?? []).join(' ')}`).some((n) => eips.includes(n)))
    .map((d) => d.id);

  return {
    ...args.meta,
    ...(config.videoUrl ? { videoUrl: config.videoUrl } : {}),
    ...(config.issue ? { issueUrl: `https://github.com/ethereum/pm/issues/${config.issue}` } : {}),
    kind: 'full',
    ...(durationMinutes(cues) !== undefined ? { durationMin: durationMinutes(cues) } : {}),
    headline: draft.headline,
    lead: draft.lead,
    intro: draft.intro,
    summary: draft.summary,
    whyItMatters: draft.whyItMatters,
    decisions,
    targets,
    actions,
    agenda,
    topics,
    speakers,
    chat: draft.chat,
    glossary: draft.glossary,
    eips,
    relatedDebates,
  };
}

/** 제목·링크만 있는 레코드 (결정 기록을 정리하지 않는 시리즈) */
export function recordOnly(meta: { id: string; series: string; number: number; date: string; title: string; forkcastUrl: string }): CallRecord {
  return { ...meta, kind: 'record', decisions: [], targets: [], actions: [], agenda: [], topics: [], speakers: [], chat: [], glossary: [], eips: [], relatedDebates: [] };
}

/** 번역을 positions에 붙인다 (n은 originals 목록의 순번) */
export function applyTranslations(record: CallRecord, originals: Array<{ topic: number; position: number }>, translations: Array<{ n: number; text: string }>): CallRecord {
  const map = new Map(translations.map((t) => [t.n, t.text]));
  const topics = record.topics.map((t, ti) => ({
    ...t,
    positions: t.positions.map((p, pi) => {
      const n = originals.findIndex((o) => o.topic === ti && o.position === pi) + 1;
      const text = n > 0 ? map.get(n) : undefined;
      return text ? { ...p, translation: text } : p;
    }),
  }));
  return { ...record, topics };
}

/* ---------- 일정 잇기·다음 콜 ---------- */

/** 이 콜의 일정 항목이 뒤 콜에서 어떻게 바뀌었는지: 같은 key를 가진 가장 최근 뒤 콜의 문구 */
export function laterTargetUpdates(call: Pick<CallRecord, 'id' | 'date' | 'targets'>, calls: ReadonlyArray<Pick<CallRecord, 'id' | 'series' | 'number' | 'date' | 'targets'>>): Record<string, { callId: string; label: string; text: string }> {
  const out: Record<string, { callId: string; label: string; text: string }> = {};
  const later = calls.filter((c) => c.id !== call.id && c.date > call.date).sort((a, b) => a.date.localeCompare(b.date));
  for (const t of call.targets) {
    for (const c of later) {
      const hit = c.targets.find((x) => x.key === t.key && x.text !== t.text);
      if (hit) out[t.key] = { callId: c.id, label: `${CALL_SERIES[c.series]?.pill ?? c.series.toUpperCase()} #${c.number}`, text: hit.text };
    }
  }
  return out;
}

/** 다음 ACD 콜 추정: ACDE·ACDC는 목요일 격주로 번갈아 열린다. 마지막 콜 + 14일 중 가장 이른 것 */
export function nextCallEstimate(calls: ReadonlyArray<Pick<CallRecord, 'series' | 'number' | 'date'>>, today: string): { label: string; date: string } | undefined {
  const candidates = ['acde', 'acdc'].flatMap((series) => {
    const latest = calls.filter((c) => c.series === series).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest) return [];
    let d = new Date(`${latest.date}T00:00:00Z`);
    let number = latest.number;
    do {
      d = new Date(d.getTime() + 14 * 86_400_000);
      number += 1;
    } while (d.toISOString().slice(0, 10) < today);
    return [{ label: `${CALL_SERIES[series].pill} #${number}`, date: d.toISOString().slice(0, 10) }];
  });
  return candidates.sort((a, b) => a.date.localeCompare(b.date))[0];
}

/* ---------- 텔레그램 브리프 렌더 (사이트와 같은 레코드에서) ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const koDate = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

export function callLabel(call: Pick<CallRecord, 'series' | 'number'>): string {
  return `${CALL_SERIES[call.series]?.pill ?? call.series.toUpperCase()} #${call.number}`;
}

export interface CaptionOptions {
  targets?: boolean;
  why?: boolean;
  glossary?: boolean;
}

/** 사진 캡션 (텔레그램 HTML). 길이 상한은 fitCaption이 맞춘다 */
export function renderCaption(call: CallRecord, opts: CaptionOptions = {}): string {
  const { targets = true, why = true, glossary = true } = opts;
  const lines: string[] = [];
  lines.push(`<b>${esc(callLabel(call))} · ${koDate(call.date)}</b>`);
  if (call.intro) lines.push(esc(call.intro));
  if (call.summary) lines.push('', '<b>한 줄 요약</b>', esc(call.summary));
  if (call.decisions.length) lines.push('', '<b>결정된 것</b>', ...call.decisions.slice(0, 5).map((d) => `· ${esc(d.text)}`));
  if (targets && call.targets.length) lines.push('', '<b>일정</b>', ...call.targets.slice(0, 4).map((t) => `· ${esc(t.text)}`));
  if (why && call.whyItMatters) lines.push('', '<b>왜 중요한가</b>', esc(call.whyItMatters));
  if (glossary && call.glossary.length) lines.push('', `<b>용어</b> ${call.glossary.slice(0, 4).map((g) => `${esc(g.term)}: ${esc(g.def)}`).join(' · ')}`);
  lines.push('', `<a href="${call.forkcastUrl}">Forkcast 기록</a>${call.videoUrl ? ` · <a href="${call.videoUrl}">영상</a>` : ''}`);
  return lines.join('\n');
}

/** 텔레그램 sendPhoto 캡션 상한(엔티티 제외 1,024자)에 맞을 때까지 용어 → 왜 중요한가 → 일정 순으로 뺀다 */
export function fitCaption(call: CallRecord, max = 1024): string {
  const variants: CaptionOptions[] = [{}, { glossary: false }, { glossary: false, why: false }, { glossary: false, why: false, targets: false }];
  for (const v of variants) {
    const text = renderCaption(call, v);
    if (plainLength(text) <= max) return text;
  }
  return renderCaption(call, variants[variants.length - 1]);
}

/** 주제 단락의 발언자 줄과 인용을 펼침형 인용으로 접는다. 두 번 적용해도 안전 */
export function collapseTopics(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => {
      if (para.includes('<blockquote')) return para;
      const lines = para.split('\n');
      const i = lines.findIndex((l) => l.startsWith('· '));
      if (i < 1) return para;
      return [...lines.slice(0, i), `<blockquote expandable>${lines.slice(i).join('\n')}</blockquote>`].join('\n');
    })
    .join('\n\n');
}

/** "누가 무슨 말을 했나" 메시지 단락들: 제목, 주제별, 남은 것. 각 주제는 발언·인용이 접힌다 */
export function discussionParagraphs(call: CallRecord): string[] {
  const who = (label: string) => {
    const s = call.speakers.find((x) => x.label === label);
    const org = s ? [s.org, s.role].filter(Boolean).join(', ') : '';
    return `<b>${esc(s?.name ?? label)}</b>${org ? ` (${esc(org)})` : ''}`;
  };
  const paras: string[] = [`<b>${esc(callLabel(call))} · 누가 무슨 말을 했나</b>\n${esc(call.lead ?? '')}`];
  for (const t of call.topics) {
    const lines = [`<b>${esc(t.title)}</b>${t.decision ? ` · ${esc(t.decision)}` : ''}`, esc(t.intro)];
    for (const p of t.positions) lines.push(`· ${who(p.speaker)}: ${esc(p.text)}${p.viaChat ? ' (채팅)' : ''}`);
    if (t.quote) lines.push(`<i>"${esc(t.quote.text)}"</i> (${esc(call.speakers.find((s) => s.label === t.quote?.speaker)?.name ?? t.quote.speaker)}, ${t.quote.timestamp})`);
    paras.push(collapseTopics(lines.join('\n')));
  }
  if (call.actions.length) paras.push(`<b>남은 것</b>\n${call.actions.map((a) => `· ${esc(a.owner)}: ${esc(a.text)}`).join('\n')}`);
  return paras;
}

/** 텔레그램 메시지 상한(엔티티 제외 4,096자)에 맞춰 단락을 메시지 여러 개로 나눈다. 주제 하나는 쪼개지 않는다 */
export function renderDiscussionParts(call: CallRecord, max = 4096): string[] {
  const parts: string[] = [];
  let current = '';
  for (const para of discussionParagraphs(call)) {
    const next = current ? `${current}\n\n${para}` : para;
    if (current && plainLength(next) > max) {
      parts.push(current);
      current = para;
    } else current = next;
  }
  if (current) parts.push(current);
  return parts;
}

/** 한 메시지 버전 (상한을 넘을 수 있음; 길이는 renderDiscussionParts로 맞춘다) */
export function renderDiscussion(call: CallRecord): string {
  return discussionParagraphs(call).join('\n\n');
}

export function plainLength(html: string): number {
  return html.replace(/<[^>]+>/g, '').length;
}

/** 커버용: 헤드라인·리드·결정 칩 */
export function coverSpecOf(call: CallRecord): { headline: string; lead: string; tags: Array<{ label: string; status: CallStatus }> } {
  return { headline: call.headline ?? callLabel(call), lead: call.lead ?? '', tags: call.decisions.slice(0, 4).map((d) => ({ label: d.label, status: d.status })) };
}
