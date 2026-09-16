import { describe, it, expect } from 'vitest';
import { AmaDraftSchema, RELAY_ACCOUNTS, amaInput, amaSpeakers, buildAmaRecord, parseAmaFeed } from '../lib/reddit-ama';

const feed = `<?xml version="1.0" encoding="UTF-8"?><feed>
<entry><author><name>/u/JBSchweitzer</name></author><content type="html">&lt;div&gt;&lt;p&gt;NOTICE: This AMA is now open!&lt;/p&gt;&lt;p&gt;Prior AMAs: #13&lt;/p&gt;&lt;/div&gt;</content><link href="https://www.reddit.com/r/ethereum/comments/x/" /><updated>2025-08-27T10:06:00+00:00</updated></entry>
<entry><author><name>/u/Ethereum_AMA</name></author><content type="html">&lt;div&gt;&lt;p&gt;&lt;em&gt;user Pintail asks:&lt;/em&gt;&lt;/p&gt;&lt;p&gt;What about the issuance curve?&lt;/p&gt;&lt;/div&gt;</content><link href="https://www.reddit.com/r/ethereum/comments/x/c1/" /><updated>2025-08-29T13:00:00+00:00</updated></entry>
<entry><author><name>/u/bobthesponge1</name></author><content type="html">&lt;div&gt;&lt;p&gt;EIP-8363 is still under discussion.&lt;/p&gt;&lt;/div&gt;</content><link href="https://www.reddit.com/r/ethereum/comments/x/c2/" /><updated>2025-08-29T14:05:00+00:00</updated></entry>
</feed>`;

describe('레딧 AMA 피드 파싱', () => {
  it('should unwrap doubly encoded entities', () => {
    // 레딧 본문에는 &amp;#39; 처럼 두 번 감싸인 것이 섞여 있다 (실측)
    const doubled = feed.replace('EIP-8363 is still under discussion.', 'it&amp;#39;s under discussion &amp;amp; unresolved');
    expect(parseAmaFeed(doubled)[2].text).toBe("it's under discussion & unresolved");
  });

  it('should split the post, relayed questions and comments', () => {
    const items = parseAmaFeed(feed);
    expect(items.map((i) => i.kind)).toEqual(['post', 'question', 'comment']);
    expect(items[1]).toMatchObject({ n: 2, author: 'Ethereum_AMA', asker: 'Pintail', text: 'What about the issuance curve?' });
    expect(items[2]).toMatchObject({ n: 3, author: 'bobthesponge1', text: 'EIP-8363 is still under discussion.' });
  });

  it('should keep every relayed question and fit comments into the byte budget', () => {
    const items = parseAmaFeed(feed);
    const full = amaInput(items, 90_000);
    expect(full).toContain('[2] 질문(Pintail)');
    expect(full).toContain('[3] @bobthesponge1');
    // 예산이 질문만 겨우 담을 크기면 댓글은 빠진다 (프롬프트가 인자 한계를 넘지 않게)
    const tight = amaInput(items, 60);
    expect(tight).toContain('[2] 질문(Pintail)');
    expect(tight).not.toContain('bobthesponge1');
  });
});

describe('AMA 레코드 조립', () => {
  const draft = AmaDraftSchema.parse({
    headline: '발행량 축소는\n아직 합의 전',
    lead: '재단은 곡선 변경에 시한을 두지 않았다',
    intro: '프로토콜 클러스터가 레딧에서 여는 공개 질의응답이다.',
    summary: '발행량 곡선을 두고 질문이 몰렸고, 재단은 합의가 먼저라고 답했다.',
    whyItMatters: '발행량은 스테이킹 비율과 솔로 스테이커 수익에 직접 영향을 준다.',
    topics: [{ title: '발행량 곡선', intro: '질문이 가장 많았다.', positions: [{ n: 3, speaker: 'bobthesponge1', text: 'EIP-8363은 아직 논의 중이라고 답했다.' }] }],
    glossary: [{ term: '발행량', def: '검증자에게 새로 주어지는 ETH의 양' }],
  });

  it('should trim an overlong glossary term instead of rejecting the draft', () => {
    // 실측(2026-09-16): fable이 40자를 넘는 용어를 써서 초안 전체가 반려됐다
    const long = AmaDraftSchema.parse({
      ...JSON.parse(JSON.stringify(draft)),
      glossary: [{ term: '가'.repeat(60), def: '나'.repeat(200) }],
    });
    expect(long.glossary[0].term).toHaveLength(48);
    expect(long.glossary[0].def).toHaveLength(160);
  });

  it('should attach the original text by item number and leave call-only fields empty', () => {
    const items = parseAmaFeed(feed);
    const record = buildAmaRecord({
      meta: { id: 'ama-14', series: 'ama', number: 14, date: '2025-08-29', title: 'EF Protocol AMA #14', forkcastUrl: 'https://reddit.com/x' },
      draft,
      items,
      roster: {},
      debates: [{ id: 'eip-8363-tapered-issuance-burn', title: 'EIP-8363 발행량', summary: '발행량 축소' }],
    });
    expect(record.topics[0].positions[0]).toMatchObject({ speaker: 'bobthesponge1', original: 'EIP-8363 is still under discussion.' });
    expect(record.decisions).toEqual([]);
    expect(record.agenda).toEqual([]);
    expect(record.eips).toEqual([8363]);
    expect(record.relatedDebates).toEqual(['eip-8363-tapered-issuance-burn']);
  });

  it('should name only speakers confirmed in the roster', () => {
    const topics = [{ title: 't', intro: 'i', positions: [{ speaker: 'vdWijden', text: 'a', original: '12345' }, { speaker: 'someone', text: 'b', original: '123' }] }];
    const speakers = amaSpeakers(topics, { vdwijden: { name: 'Marius van der Wijden', org: 'EF', handle: 'vdWijden' } });
    expect(speakers[0]).toMatchObject({ label: 'vdWijden', name: 'Marius van der Wijden', org: 'EF', share: 1 });
    expect(speakers[1]).toMatchObject({ label: 'someone', name: 'someone' });
    expect(speakers[1].org).toBeUndefined();
  });
});

describe('참여자 명단', () => {
  it('should leave relay accounts out of the participant list', () => {
    // 운영 계정(Ethereum_AMA)은 사전 질문을 옮겨 달 뿐 답변자가 아니다 (2026-09-16 Pt.14 정리에서 비중 2위로 올라옴)
    const topics = [
      { title: 't', intro: 'i', positions: [
        { speaker: 'Ethereum_AMA', text: '질문을 옮겼다', original: '1234567890' },
        { speaker: 'vbuterin', text: '답했다', original: '12345' },
      ] },
    ];
    expect(RELAY_ACCOUNTS.has('ethereum_ama')).toBe(true);
    expect(amaSpeakers(topics, {}).map((s) => s.label)).toEqual(['vbuterin']);
  });
});
