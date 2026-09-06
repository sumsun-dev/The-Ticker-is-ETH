import { describe, it, expect } from 'vitest';
import { parseFeed, tweetsToItems, telegramToItems, mergeInbox, detectDebates, isDigestDue, type NewsItem } from '../lib/eth-news';

const RSS2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Ethereum Research</title>
    <item>
      <title>Timing the Head in Ethereum PoS</title>
      <link>https://ethresear.ch/t/timing-the-head/12345</link>
      <guid>ethresear.ch-post-12345</guid>
      <pubDate>Thu, 20 Aug 2026 03:50:38 GMT</pubDate>
      <description>&lt;p&gt;An analysis of &amp;amp; timing games.&lt;/p&gt;</description>
      <dc:creator>Yolodannn</dc:creator>
    </item>
    <item>
      <title>Second post</title>
      <link>https://ethresear.ch/t/second/12346</link>
      <pubDate>Wed, 19 Aug 2026 01:00:00 GMT</pubDate>
      <description>Body</description>
    </item>
  </channel>
</rss>`;

const RSS2_SINGLE_ITEM = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>One</title>
  <item><title>Only</title><link>https://a.b/1</link><pubDate>Fri, 21 Aug 2026 00:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>r/ethereum</title>
  <entry>
    <id>t3_abc123</id>
    <title>ETH staking question</title>
    <link rel="alternate" href="https://www.reddit.com/r/ethereum/comments/abc123/"/>
    <published>2026-08-22T10:00:00Z</published>
    <author><name>u/someone</name></author>
    <content type="html">&lt;div&gt;question body&lt;/div&gt;</content>
  </entry>
</feed>`;

describe('parseFeed', () => {
  it('should parse RSS 2.0 items', () => {
    const items = parseFeed(RSS2, 'ethresearch');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'ethresearch:ethresear.ch-post-12345',
      source: 'ethresearch',
      sourceType: 'rss',
      title: 'Timing the Head in Ethereum PoS',
      url: 'https://ethresear.ch/t/timing-the-head/12345',
      author: 'Yolodannn',
    });
    expect(items[0].publishedAt).toBe('2026-08-20T03:50:38.000Z');
    expect(items[0].summary).toBe('An analysis of & timing games.');
  });

  it('should fall back to link as id when guid is missing', () => {
    const items = parseFeed(RSS2, 'ethresearch');
    expect(items[1].id).toBe('ethresearch:https://ethresear.ch/t/second/12346');
  });

  it('should handle a single non-array item', () => {
    const items = parseFeed(RSS2_SINGLE_ITEM, 'one');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Only');
  });

  it('should parse Atom entries', () => {
    const items = parseFeed(ATOM, 'reddit-ethereum');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'reddit-ethereum:t3_abc123',
      url: 'https://www.reddit.com/r/ethereum/comments/abc123/',
      title: 'ETH staking question',
      author: 'u/someone',
      summary: 'question body',
    });
  });

  it('should return an empty array for non-feed XML', () => {
    expect(parseFeed('<html><body>nope</body></html>', 'x')).toEqual([]);
  });
});

describe('tweetsToItems', () => {
  it('should normalize a twitter-api45 style timeline', () => {
    const payload = {
      timeline: [
        { tweet_id: '190001', text: 'gm ethereum', created_at: 'Sat Aug 22 09:00:00 +0000 2026' },
        { tweet_id: '190002', text: 'pectra update', created_at: 'Sat Aug 22 10:00:00 +0000 2026' },
      ],
    };
    const items = tweetsToItems(payload, 'VitalikButerin');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'x:VitalikButerin:190001',
      source: 'x:VitalikButerin',
      sourceType: 'twitter',
      url: 'https://x.com/VitalikButerin/status/190001',
      author: 'VitalikButerin',
    });
  });

  it('should tolerate id_str/full_text variants and skip empty entries', () => {
    const payload = {
      timeline: [
        { id_str: '77', full_text: 'alt shape' },
        { text: 'no id — skipped' },
        { tweet_id: '78', text: '' },
      ],
    };
    const items = tweetsToItems(payload, 'TimBeiko');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('x:TimBeiko:77');
  });

  it('should return an empty array for unknown payloads', () => {
    expect(tweetsToItems(null, 'a')).toEqual([]);
    expect(tweetsToItems({ error: 'rate limit' }, 'a')).toEqual([]);
  });

  it('should capture conversation id and reply flag', () => {
    const payload = {
      timeline: [
        { tweet_id: '10', text: 'take', created_at: 'Mon Aug 24 09:00:00 +0000 2026', conversation_id: '900' },
        { tweet_id: '11', text: 'reply', created_at: 'Mon Aug 24 09:05:00 +0000 2026', conversation_id: '900', in_reply_to_status_id_str: '10' },
      ],
    };
    const items = tweetsToItems(payload, 'hasufl');
    expect(items[0].conversationId).toBe('900');
    expect(items[0].isReply).toBeUndefined();
    expect(items[1].isReply).toBe(true);
  });
});

describe('detectDebates', () => {
  const tweet = (author: string, conversationId: string, id: string, at: string): NewsItem => ({
    id: `x:${author}:${id}`,
    source: `x:${author}`,
    sourceType: 'twitter',
    title: id,
    url: '',
    publishedAt: at,
    summary: id,
    author,
    conversationId,
  });

  it('should cluster conversations with 2+ distinct authors, time-ordered', () => {
    const items = [
      tweet('hasufl', 'c1', 'b', '2026-08-24T10:00:00.000Z'),
      tweet('Justin_Bons', 'c1', 'a', '2026-08-24T09:00:00.000Z'),
      tweet('vitalik', 'c2', 'solo', '2026-08-24T11:00:00.000Z'),
    ];
    const debates = detectDebates(items);
    expect(debates).toHaveLength(1);
    expect(debates[0].participants.sort()).toEqual(['Justin_Bons', 'hasufl']);
    expect(debates[0].items.map((i) => i.title)).toEqual(['a', 'b']);
  });

  it('should ignore items without conversationId and sort clusters by size', () => {
    const items = [
      tweet('a', 'big', '1', '2026-08-24T09:00:00.000Z'),
      tweet('b', 'big', '2', '2026-08-24T09:10:00.000Z'),
      tweet('c', 'big', '3', '2026-08-24T09:20:00.000Z'),
      tweet('a', 'small', '4', '2026-08-24T10:00:00.000Z'),
      tweet('b', 'small', '5', '2026-08-24T10:10:00.000Z'),
      { ...tweet('x', 'none', '6', '2026-08-24T11:00:00.000Z'), conversationId: undefined },
    ];
    const debates = detectDebates(items);
    expect(debates.map((d) => d.conversationId)).toEqual(['big', 'small']);
  });
});

describe('telegramToItems', () => {
  it('should map messages and use the first line as title', () => {
    const items = telegramToItems(
      [{ id: 501, date: '2026-08-23T00:10:00.000Z', text: '비트코인 ETF 순유입\n상세 내용 두 번째 줄' }],
      'coinnesskr',
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'tg:coinnesskr:501',
      title: '비트코인 ETF 순유입',
      url: 'https://t.me/coinnesskr/501',
      sourceType: 'telegram',
    });
  });

  it('should drop empty messages', () => {
    expect(telegramToItems([{ id: 1, date: '2026-08-23', text: '  ' }], 'c')).toEqual([]);
  });
});

describe('mergeInbox', () => {
  const item = (id: string, publishedAt: string): NewsItem => ({
    id,
    source: 's',
    sourceType: 'rss',
    title: id,
    url: '',
    publishedAt,
    summary: '',
    author: '',
  });

  it('should dedupe by id with incoming winning and sort newest first', () => {
    const prev = [item('a', '2026-08-01T00:00:00.000Z'), item('b', '2026-08-02T00:00:00.000Z')];
    const incoming = [item('b', '2026-08-03T00:00:00.000Z'), item('c', '2026-08-04T00:00:00.000Z')];
    const merged = mergeInbox(prev, incoming);
    expect(merged.map((i) => i.id)).toEqual(['c', 'b', 'a']);
    expect(merged[1].publishedAt).toBe('2026-08-03T00:00:00.000Z');
  });

  it('should cap the result size keeping newest', () => {
    const many = Array.from({ length: 10 }, (_, i) => item(`i${i}`, `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`));
    const merged = mergeInbox([], many, 3);
    expect(merged.map((i) => i.id)).toEqual(['i9', 'i8', 'i7']);
  });
});

describe('isDigestDue', () => {
  it('should publish the first digest immediately', () => {
    expect(isDigestDue(undefined, '2026-09-06', 3)).toBe(true);
  });
  it('should skip until intervalDays have passed since the last digest', () => {
    expect(isDigestDue('2026-09-04', '2026-09-05', 3)).toBe(false);
    expect(isDigestDue('2026-09-04', '2026-09-06', 3)).toBe(false);
    expect(isDigestDue('2026-09-04', '2026-09-07', 3)).toBe(true);
  });
  it('should handle month boundaries and missed runs', () => {
    expect(isDigestDue('2026-08-30', '2026-09-02', 3)).toBe(true);
    expect(isDigestDue('2026-09-01', '2026-09-10', 3)).toBe(true);
  });
  it('should allow forcing with interval 0', () => {
    expect(isDigestDue('2026-09-06', '2026-09-06', 0)).toBe(true);
  });
});
