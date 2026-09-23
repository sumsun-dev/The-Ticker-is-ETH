import { describe, it, expect } from 'vitest';
import { parseFeed, tweetsToItems, telegramToItems, mergeInbox, detectDebates, isDigestDue, parseForkcastFeed, forkcastArtifactBase, forkcastToItem, findMultiVoiceItems, type NewsItem } from '../lib/eth-news';

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

describe('forkcast', () => {
  const FEED = `<?xml version="1.0"?><rss version="2.0"><channel><title>Forkcast</title>
    <item><title>AllCoreDevs - Execution #244 call published</title><link>https://forkcast.org/calls/acde/244/</link><guid isPermaLink="false">call-acde-244-2026-08-27</guid><pubDate>Thu, 27 Aug 2026 12:00:00 GMT</pubDate></item>
    <item><title>Post Quantum Transaction Signatures #014 call published</title><link>https://forkcast.org/calls/pqts/014/</link><guid isPermaLink="false">call-pqts-014-2026-09-02</guid></item>
    <item><title>Not a call</title><link>https://forkcast.org/eips/7727/</link></item>
  </channel></rss>`;

  it('should parse call series, number and date from feed items and skip non-call links', () => {
    const calls = parseForkcastFeed(FEED);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ series: 'acde', number: 244, date: '2026-08-27', url: 'https://forkcast.org/calls/acde/244/', title: 'AllCoreDevs - Execution #244' });
    expect(forkcastArtifactBase(calls[0])).toBe('https://raw.githubusercontent.com/ethereum/forkcast/main/public/artifacts/acde/2026-08-27_244');
    expect(forkcastArtifactBase(calls[1])).toContain('/pqts/2026-09-02_014');
  });

  it('should turn tldr + key decisions into one inbox item with EIP numbers and stage changes kept', () => {
    const [call] = parseForkcastFeed(FEED);
    const item = forkcastToItem(
      call,
      { meeting: 'ACDE #244 - August 27, 2026', highlights: { fork_status: [{ highlight: 'Sep 28 proposed for Sepolia fork' }] }, action_items: [{ item: 'Clients to merge trunk' }] },
      { key_decisions: [{ original_text: 'EIP-8141 (Frames) SFI for Hegota', eips: [8141], fork: 'Hegota', stage_change: { to: 'Scheduled' } }] },
      { videoUrl: 'https://youtube.com/watch?v=x' },
    );
    expect(item.id).toBe('forkcast:acde-244');
    expect(item.source).toBe('forkcast');
    expect(item.title).toBe('ACDE #244 (2026-08-27) 핵심 결정 1건');
    expect(item.summary).toContain('- EIP-8141 (Frames) SFI for Hegota [Hegota → Scheduled EIP-8141]');
    expect(item.summary).toContain('fork status:');
    expect(item.summary).toContain('영상: https://youtube.com/watch?v=x');
    expect(item.publishedAt).toBe('2026-08-27T12:00:00.000Z');
  });

  it('should still produce an item when artifacts are missing', () => {
    const [, pq] = parseForkcastFeed(FEED);
    const item = forkcastToItem(pq, null, null, null);
    expect(item.title).toBe('Post Quantum Transaction Signatures #14 (2026-09-02)');
    expect(item.summary).toContain('Post Quantum Transaction Signatures #14 - 2026-09-02');
  });
});

describe('mergeInbox forkcast retention', () => {
  it('should keep forkcast call records outside the tweet cap', () => {
    const tweet = (i: number): NewsItem => ({ id: `x:${i}`, source: 'x:a', sourceType: 'twitter', title: 't', url: `https://x.com/a/status/${i}`, publishedAt: `2026-09-0${(i % 7) + 1}T10:00:00.000Z`, summary: 't', author: 'a' });
    const call: NewsItem = { id: 'forkcast:acde-244', source: 'forkcast', sourceType: 'rss', title: 'ACDE #244', url: 'https://forkcast.org/calls/acde/244/', publishedAt: '2026-08-27T12:00:00.000Z', summary: 'd', author: 'Forkcast' };
    const merged = mergeInbox([call], Array.from({ length: 10 }, (_, i) => tweet(i)), 5);
    expect(merged.filter((i) => i.source === 'forkcast')).toHaveLength(1);
    expect(merged.filter((i) => i.source !== 'forkcast')).toHaveLength(5);
  });
});

describe('findMultiVoiceItems', () => {
  // 2026-09-22 실제 사고: gakonst·비탈릭·pcaversaccio 3인 설전을 한 항목에 담고 url은 gakonst 것만 달아,
  // 항목 url만 보는 논쟁 추출기가 비탈릭의 "포기할 때만 죽는다"를 통째로 놓쳤다.
  const section = (heading: string, items: Array<{ title?: string; summary?: string; why?: string; url: string }>) => ({
    heading,
    items: items.map((it) => ({ title: it.title ?? '', summary: it.summary ?? '', why: it.why ?? '', url: it.url, source: '', date: '2026-09-22' })),
  });

  it('should flag an item that quotes several speakers behind one url', () => {
    const digest = {
      sections: [
        section('트위터 논쟁', [
          {
            title: "'프라이버시는 죽었다' 한마디가 부른 반박 릴레이",
            summary: "gakonst가 '앞으로 프라이버시가 얼마나 죽었는지가 주된 고민'이라고 하자, 비탈릭 부테린이 '포기할 때만 죽는다, 나는 더블다운한다'고 받았다.",
            url: 'https://x.com/gakonst/status/2101382182799552834',
          },
        ]),
      ],
    };
    const found = findMultiVoiceItems(digest);
    expect(found).toHaveLength(1);
    expect(found[0].url).toBe('https://x.com/gakonst/status/2101382182799552834');
    expect(found[0].quotes).toContain('포기할 때만 죽는다, 나는 더블다운한다');
    expect(found[0].where).toBe('트위터 논쟁');
  });

  it('should leave an item alone when one speaker is quoted several times', () => {
    // Aave 항목(2026-09-12)이 이 형태다. 한 사람의 발언을 조각내 인용했을 뿐이라 누락이 없다
    const digest = {
      sections: [
        section('생태계 · 보안', [
          {
            title: 'Aave V4 액티브 대출 사상 최고',
            summary: "스타니 쿠레체프는 '차입 수요가 Aave로 돌아오고 있다'고 밝혔다. 그는 'Aave V4, 10억 달러를 향해 성장 중'이라는 전망도 덧붙였다.",
            url: 'https://x.com/StaniKulechov/status/2096291788369625216',
          },
        ]),
      ],
    };
    expect(findMultiVoiceItems(digest)).toEqual([]);
  });

  it('should not flag a single quote', () => {
    const digest = {
      sections: [section('주요 발언', [{ title: '한 발언', summary: "비탈릭은 '포기할 때만 죽는다'고 밝혔다", url: 'https://x.com/VitalikButerin/status/1' }])],
    };
    expect(findMultiVoiceItems(digest)).toEqual([]);
  });

  it('should dedupe a phrase quoted in both the title and the summary', () => {
    const digest = {
      sections: [
        section('프로토콜 업데이트', [
          {
            title: "Ethlabs 13주차, '더 빠른 이더리움 L1' 연구",
            summary: "Ethlabs가 '더 빠른 이더리움 L1'이라고 내걸자, barnabemonnot는 '빠른 파이널리티 언급은 실제로 좋은 일'이라며 호응했다.",
            url: 'https://x.com/ethlabs_org/status/1',
          },
        ]),
      ],
    };
    const found = findMultiVoiceItems(digest);
    expect(found).toHaveLength(1);
    expect(found[0].quotes).toEqual(['더 빠른 이더리움 L1', '빠른 파이널리티 언급은 실제로 좋은 일']);
  });

  it('should not mistake prose for a quote when apostrophes span a clause', () => {
    // 경계 조건이 없으면 "라는 분업론을 폈는데, ZKsync 측" 같은 서술문이 인용으로 잡혔다
    const digest = {
      sections: [
        section('트위터 논쟁', [
          { title: '분업론', summary: "decentrek이 'Ethlabs는 오늘의 빌더'라는 분업론을 폈는데, donnoh_eth가 반박했다", url: 'https://x.com/decentrek/status/1' },
        ]),
      ],
    };
    const found = findMultiVoiceItems(digest);
    expect(found).toEqual([]);
  });

  it('should ignore a digest with no sections', () => {
    expect(findMultiVoiceItems({ intro: "인용이 '있어도' 섹션이 없으면 대상이 아니다" })).toEqual([]);
  });
});
