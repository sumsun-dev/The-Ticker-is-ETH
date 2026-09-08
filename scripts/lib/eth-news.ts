/**
 * 이더리움 뉴스 수집 파이프라인의 순수 로직.
 * I/O(fetch, 파일 쓰기)는 scripts/fetch-eth-news.ts가 담당한다.
 */
import { XMLParser } from 'fast-xml-parser';

export interface NewsItem {
  id: string;
  source: string;
  sourceType: 'rss' | 'twitter' | 'telegram';
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  author: string;
  /** 트위터 대화 스레드 id — 설전(교차 대화) 감지에 사용 */
  conversationId?: string;
  /** 리플라이 여부 (replies.php 수집분) */
  isReply?: boolean;
}

export interface TelegramMessageLike {
  id: number;
  date: string;
  text: string;
}

function toIso(value: unknown): string {
  const d = new Date(String(value ?? ''));
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function stripHtml(src: unknown): string {
  return String(src ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)['#text'] ?? '');
  }
  return String(value ?? '');
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function atomLink(link: unknown): string {
  const links = asArray(link as Record<string, string> | Array<Record<string, string>>);
  const alternate = links.find((l) => l['@_rel'] === 'alternate') ?? links[0];
  return alternate?.['@_href'] ?? '';
}

/** RSS 2.0과 Atom 피드를 모두 NewsItem[]으로 정규화한다. */
export function parseFeed(xml: string, source: string): NewsItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });
  const parsed = parser.parse(xml) as Record<string, any>;

  if (parsed.rss?.channel) {
    return asArray(parsed.rss.channel.item).map((item: Record<string, unknown>) => {
      const url = text(item.link);
      const guid = text(item.guid) || url;
      return {
        id: `${source}:${guid}`,
        source,
        sourceType: 'rss' as const,
        title: stripHtml(text(item.title)),
        url,
        publishedAt: toIso(text(item.pubDate)),
        summary: stripHtml(text(item.description)),
        author: stripHtml(text(item['dc:creator'] ?? item.author ?? '')),
      };
    });
  }

  if (parsed.feed) {
    return asArray(parsed.feed.entry).map((entry: Record<string, unknown>) => {
      const url = atomLink(entry.link);
      const nativeId = text(entry.id) || url;
      const author = entry.author as Record<string, unknown> | undefined;
      return {
        id: `${source}:${nativeId}`,
        source,
        sourceType: 'rss' as const,
        title: stripHtml(text(entry.title)),
        url,
        publishedAt: toIso(text(entry.published ?? entry.updated)),
        summary: stripHtml(text(entry.summary ?? entry.content)),
        author: stripHtml(text(author?.name ?? '')),
      };
    });
  }

  return [];
}

/**
 * RapidAPI 트위터 응답을 NewsItem[]으로 정규화한다.
 * ponytail: twitter-api45 계열의 { timeline: [...] } 형태를 가정 — 다른 상품 구독 시 이 함수만 조정
 */
export function tweetsToItems(payload: unknown, screenname: string): NewsItem[] {
  const p = payload as Record<string, any> | null;
  const timeline = asArray<Record<string, any>>(p?.timeline ?? p?.tweets ?? p?.results);
  return timeline
    .map((tw): NewsItem | null => {
      const nativeId = String(tw.tweet_id ?? tw.id_str ?? tw.id ?? '');
      const body = String(tw.text ?? tw.full_text ?? '').trim();
      if (!nativeId || !body) return null;
      const conversationId = tw.conversation_id ? String(tw.conversation_id) : undefined;
      const isReply = Boolean(tw.in_reply_to_status_id_str);
      return {
        id: `x:${screenname}:${nativeId}`,
        source: `x:${screenname}`,
        sourceType: 'twitter' as const,
        title: body.slice(0, 80),
        url: `https://x.com/${screenname}/status/${nativeId}`,
        publishedAt: toIso(tw.created_at),
        // 긴 글(note tweet)도 전문을 남긴다. 500자로 자르면 다이제스트와 논쟁 분석이 앞부분만 보게 된다.
        summary: body.slice(0, 4000),
        author: screenname,
        ...(conversationId ? { conversationId } : {}),
        ...(isReply ? { isReply } : {}),
      };
    })
    .filter((item): item is NewsItem => item !== null);
}

/** 텔레그램 채널 메시지를 NewsItem[]으로 정규화한다. */
export function telegramToItems(messages: TelegramMessageLike[], channel: string): NewsItem[] {
  return messages
    .filter((msg) => msg.text.trim().length > 0)
    .map((msg) => {
      const body = msg.text.trim();
      return {
        id: `tg:${channel}:${msg.id}`,
        source: `tg:${channel}`,
        sourceType: 'telegram' as const,
        title: body.split('\n')[0].slice(0, 120),
        url: `https://t.me/${channel}/${msg.id}`,
        publishedAt: toIso(msg.date),
        summary: body.slice(0, 500),
        author: channel,
      };
    });
}

export interface DebateCluster {
  conversationId: string;
  participants: string[];
  items: NewsItem[];
}

/**
 * 설전 감지: 같은 대화(conversationId)에 서로 다른 워치리스트 저자가 2명 이상
 * 등장하는 스레드를 시간순 클러스터로 반환한다. 교류량(트윗 수) 많은 순.
 */
export function detectDebates(items: NewsItem[], minParticipants = 2): DebateCluster[] {
  const byConversation = new Map<string, NewsItem[]>();
  for (const item of items) {
    if (item.sourceType !== 'twitter' || !item.conversationId) continue;
    const list = byConversation.get(item.conversationId) ?? [];
    byConversation.set(item.conversationId, [...list, item]);
  }

  const clusters: DebateCluster[] = [];
  for (const [conversationId, tweets] of byConversation) {
    const participants = [...new Set(tweets.map((t) => t.author))];
    if (participants.length < minParticipants) continue;
    clusters.push({
      conversationId,
      participants,
      items: [...tweets].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)),
    });
  }
  return clusters.sort((a, b) => b.items.length - a.items.length);
}

/** Forkcast(EF Protocol Support) 콜 기록 — feed.xml 항목 하나 */
export interface ForkcastCall {
  /** acde · acdc · acdt · 브레이크아웃 슬러그 */
  series: string;
  number: number;
  date: string;
  url: string;
  title: string;
}

/** forkcast.org/feed.xml을 콜 목록으로. 링크 `/calls/<series>/<num>/`와 guid `call-<series>-<num>-<date>`에서 읽는다. */
export function parseForkcastFeed(xml: string): ForkcastCall[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const channel = (parsed.rss as Record<string, unknown> | undefined)?.channel as Record<string, unknown> | undefined;
  const items = asArray(channel?.item as Record<string, unknown> | Array<Record<string, unknown>> | undefined);
  return items
    .map((it): ForkcastCall | null => {
      const link = text(it.link);
      const m = /\/calls\/([a-z0-9-]+)\/(\d+)\/?$/.exec(link);
      if (!m) return null;
      const guid = text(it.guid);
      const dateFromGuid = /(\d{4}-\d{2}-\d{2})$/.exec(guid)?.[1];
      const date = dateFromGuid ?? toIso(it.pubDate).slice(0, 10);
      return { series: m[1], number: Number(m[2]), date, url: link, title: text(it.title).replace(/ call published$/i, '') };
    })
    .filter((c): c is ForkcastCall => c !== null);
}

/** GitHub 아티팩트 디렉토리: public/artifacts/<series>/<date>_<num 3자리> */
export function forkcastArtifactBase(call: ForkcastCall): string {
  return `https://raw.githubusercontent.com/ethereum/forkcast/main/public/artifacts/${call.series}/${call.date}_${String(call.number).padStart(3, '0')}`;
}

const SERIES_LABEL: Record<string, string> = { acde: 'ACDE', acdc: 'ACDC', acdt: 'ACDT' };

/** tldr.json + key_decisions.json(+config.json)을 인박스 항목 하나로. 결정은 원문 그대로, EIP 번호와 포크·상태 변경을 붙인다. */
export function forkcastToItem(
  call: ForkcastCall,
  tldr: Record<string, unknown> | null,
  decisions: Record<string, unknown> | null,
  config: Record<string, unknown> | null,
  maxChars = 3800,
): NewsItem {
  const label = SERIES_LABEL[call.series] ?? (call.title.replace(/\s*#\d+.*$/, '').trim() || call.series.toUpperCase());
  const meeting = String((tldr?.meeting ?? decisions?.meeting) ?? `${label} #${call.number} - ${call.date}`);
  const lines: string[] = [meeting];
  const dec = asArray(decisions?.key_decisions as Array<Record<string, unknown>> | undefined);
  if (dec.length) {
    lines.push('', `핵심 결정 (${dec.length}건):`);
    for (const d of dec) {
      const eips = asArray(d.eips as number[] | undefined).map((n) => `EIP-${n}`).join(', ');
      const stage = (d.stage_change as Record<string, unknown> | undefined)?.to;
      const tag = [d.fork ? String(d.fork) : '', stage ? `→ ${String(stage)}` : '', eips].filter(Boolean).join(' ');
      lines.push(`- ${String(d.original_text ?? '')}${tag ? ` [${tag}]` : ''}`);
    }
  }
  const highlights = (tldr?.highlights ?? {}) as Record<string, Array<Record<string, unknown>>>;
  for (const [category, list] of Object.entries(highlights)) {
    const arr = asArray(list);
    if (!arr.length) continue;
    lines.push('', `${category.replace(/_/g, ' ')}:`);
    for (const h of arr) lines.push(`- ${String(h.highlight ?? '')}`);
  }
  const actions = asArray(tldr?.action_items as Array<Record<string, unknown>> | undefined);
  if (actions.length) {
    lines.push('', '액션 아이템:');
    for (const a of actions) lines.push(`- ${String(a.item ?? a.action ?? a.text ?? JSON.stringify(a))}`);
  }
  if (config?.videoUrl) lines.push('', `영상: ${String(config.videoUrl)}`);
  const summary = lines.join('\n').slice(0, maxChars);
  return {
    id: `forkcast:${call.series}-${call.number}`,
    source: 'forkcast',
    sourceType: 'rss',
    title: `${label} #${call.number} (${call.date})${dec.length ? ` 핵심 결정 ${dec.length}건` : ''}`,
    url: call.url,
    publishedAt: `${call.date}T12:00:00.000Z`,
    summary,
    author: 'Forkcast',
  };
}

/** 기존 인박스와 새 수집분을 병합 — id 기준 중복 제거, 최신순, cap 제한. */
export function mergeInbox(prev: NewsItem[], incoming: NewsItem[], cap = 600, keepCalls = 60): NewsItem[] {
  const byId = new Map<string, NewsItem>();
  for (const item of prev) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  const all = [...byId.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  // 코어 개발자 콜 기록(forkcast)은 트윗 물량에 밀려 잘리지 않게 건수 상한을 따로 둔다 (논쟁 결론 참조용으로 오래 남겨야 함)
  const calls = all.filter((i) => i.source === 'forkcast').slice(0, keepCalls);
  const rest = all.filter((i) => i.source !== 'forkcast').slice(0, cap);
  return [...calls, ...rest].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** 발행 주기 가드 — 마지막 호(YYYY-MM-DD)로부터 intervalDays 이상 지났을 때만 true. 첫 호는 항상 true. */
export function isDigestDue(lastDate: string | undefined, today: string, intervalDays: number): boolean {
  if (!lastDate) return true;
  return (Date.parse(today) - Date.parse(lastDate)) / 86_400_000 >= intervalDays;
}
