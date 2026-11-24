import { describe, expect, it } from 'vitest';
import { briefBlocks, fitMessages, inWindow, keepKnownSources, splitMessages, weekLabel, weekPosts, weekWindow, type Brief } from '../lib/weekly-brief';

const brief: Brief = {
  title: '글램스테르담이 세폴리아에서 활성화됐습니다.',
  overview: '한 주 동안 두 번의 콜이 열렸습니다. <script>',
  topics: [
    {
      heading: '후디 포크 10월 26일 확정',
      text: 'ACDE #247에서 일정이 정해졌습니다.',
      sources: [
        { label: '메시지', url: 'https://t.me/thetickeriseth/10' },
        { label: '지어낸 링크', url: 'https://example.com/made-up' },
        { label: 'ECK 해설', url: 'https://ethcollective.xyz/calls/acde-247' },
      ],
    },
  ],
  upcoming: ['10.26 후디 테스트넷 글램스테르담 포크'],
};
const w0 = weekWindow('2026-10-11');

describe('weekWindow', () => {
  it('should cover 7 days ending on the given Sunday', () => {
    expect(weekWindow('2026-10-11')).toEqual({ start: '2026-10-05', end: '2026-10-11' });
  });

  it('should accept dotted and ISO dates when checking the window', () => {
    const w = weekWindow('2026-10-11');
    expect(inWindow('2026.10.05', w)).toBe(true);
    expect(inWindow('2026-10-11T22:00:00Z', w)).toBe(true);
    expect(inWindow('2026-10-04', w)).toBe(false);
    expect(inWindow(undefined, w)).toBe(false);
  });
});

describe('weekLabel', () => {
  it('should count the week by the month its Thursday falls in', () => {
    expect(weekLabel(weekWindow('2026-10-11'))).toBe('2026년 10월 2주차 (10.5 ~ 10.11)');
    // 9.28 ~ 10.4: 목요일이 10.1이라 10월 1주차
    expect(weekLabel(weekWindow('2026-10-04'))).toBe('2026년 10월 1주차 (9.28 ~ 10.4)');
  });
});

describe('keepKnownSources', () => {
  it('should drop source links that were not in the input', () => {
    const { brief: kept, dropped } = keepKnownSources(brief, new Set(['https://t.me/thetickeriseth/10']));
    expect(kept.topics[0].sources.map((s) => s.url)).toEqual(['https://t.me/thetickeriseth/10']);
    expect(dropped).toEqual(['https://example.com/made-up', 'https://ethcollective.xyz/calls/acde-247']);
  });
});

describe('weekPosts', () => {
  it('should keep posts whose KST date is inside the window, sorted by id', () => {
    const mk = (id: number, date: string) => ({ id, date });
    // 10-04T16:00Z = 10-05 01:00 KST(구간 안), 10-11T15:30Z = 10-12 00:30 KST(구간 밖)
    const out = weekPosts([mk(3, '2026-10-11T15:30:00Z'), mk(2, '2026-10-08T00:00:00Z'), mk(1, '2026-10-04T16:00:00Z'), mk(0, '2026-10-04T14:00:00Z')], w0);
    expect(out.map((p) => p.id)).toEqual([1, 2]);
  });
});

describe('briefBlocks', () => {
  const text = briefBlocks(brief, w0).join('\n\n');

  it('should escape HTML and number the topic heading', () => {
    expect(text).toContain('<b>1. 후디 포크 10월 26일 확정</b>');
    expect(text).toContain('&lt;script&gt;');
  });

  it('should label ECK site links as ECK and list them first', () => {
    expect(text).toContain('<a href="https://ethcollective.xyz/calls/acde-247">ECK</a> · <a href="https://t.me/thetickeriseth/10">메시지</a>');
  });

  it('should keep the schedule block and no dashes or emoji', () => {
    expect(text).toContain('10.26 후디 테스트넷 글램스테르담 포크');
    expect(text).not.toMatch(/—|\p{Extended_Pictographic}/u);
  });
});

describe('splitMessages', () => {
  it('should keep a short message whole', () => {
    expect(splitMessages(['a', 'b'], 100)).toEqual(['a\n\nb']);
  });

  it('should split only at block boundaries under the limit', () => {
    const parts = splitMessages(['x'.repeat(40), 'y'.repeat(40), 'z'.repeat(40)], 90);
    expect(parts).toEqual([`${'x'.repeat(40)}\n\n${'y'.repeat(40)}`, 'z'.repeat(40)]);
    expect(parts.every((p) => p.length <= 90)).toBe(true);
  });

  it('should throw when a single block exceeds the limit', () => {
    expect(() => splitMessages(['x'.repeat(10)], 5)).toThrow();
  });
});


describe('fitMessages', () => {
  const big = (n: number): Brief => ({
    title: '핵심',
    overview: '개요',
    topics: Array.from({ length: n }, (_, i) => ({ heading: `t${i + 1}`, text: `${i + 1}`.repeat(1500), sources: [] })),
    upcoming: ['10.26 일정'],
  });

  it('should keep a short brief in one message', () => {
    const r = fitMessages(brief, w0);
    expect(r.messages).toHaveLength(1);
    expect(r.dropped).toEqual([]);
  });

  it('should use two messages for a long brief without splitting a topic block', () => {
    const r = fitMessages(big(4), w0);
    expect(r.messages).toHaveLength(2);
    expect(r.messages.every((m) => m.length <= 4096)).toBe(true);
    for (const t of r.brief.topics) expect(r.messages.filter((m) => m.includes(t.text)).length).toBe(1);
  });

  it('should drop the last topics until it fits in two messages', () => {
    const r = fitMessages(big(8), w0);
    expect(r.messages).toHaveLength(2);
    expect(r.brief.topics.map((t) => t.heading)).toEqual(['t1', 't2', 't3', 't4']);
    expect(r.dropped).toEqual(['t8', 't7', 't6', 't5']);
  });
});
