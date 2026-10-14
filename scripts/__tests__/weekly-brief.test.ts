import { describe, expect, it } from 'vitest';
import { briefBlocks, fitOneMessage, formatBrief, inWindow, keepKnownSources, splitMessages, weekLabel, weekWindow, type Brief } from '../lib/weekly-brief';

const brief: Brief = {
  headline: '글램스테르담이 세폴리아에서 활성화됐습니다.',
  sections: [
    {
      heading: '프로토콜 · 코어 개발',
      items: [
        {
          title: '후디 포크 10월 26일 확정',
          date: '10.08',
          summary: 'ACDE #247에서 일정이 정해졌습니다. <script>',
          sources: [
            { label: 'Forkcast 회의록', url: 'https://forkcast.org/calls/acde/247/' },
            { label: '지어낸 링크', url: 'https://example.com/made-up' },
          ],
        },
      ],
    },
    { heading: '업계 동향', items: [] },
  ],
  upcoming: ['10.26 후디 테스트넷 글램스테르담 포크'],
};

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
    const { brief: kept, dropped } = keepKnownSources(brief, new Set(['https://forkcast.org/calls/acde/247/']));
    expect(kept.sections[0].items[0].sources.map((s) => s.url)).toEqual(['https://forkcast.org/calls/acde/247/']);
    expect(dropped).toEqual(['https://example.com/made-up']);
  });
});

describe('formatBrief', () => {
  const text = formatBrief(brief, weekWindow('2026-10-11'));

  it('should escape HTML and put the date next to the title', () => {
    expect(text).toContain('<b>후디 포크 10월 26일 확정 (10.08)</b>');
    expect(text).toContain('&lt;script&gt;');
  });

  it('should keep a section heading in the same block as its first item', () => {
    const blocks = briefBlocks(brief, weekWindow('2026-10-11'));
    expect(blocks.find((b) => b.includes('[프로토콜 · 코어 개발]'))).toContain('후디 포크 10월 26일 확정');
  });

  it('should skip empty sections and keep the schedule block', () => {
    expect(text).not.toContain('[업계 동향]');
    expect(text).toContain('· 10.26 후디 테스트넷 글램스테르담 포크');
  });

  it('should not contain an inquiry block, dashes or emoji', () => {
    expect(text).not.toContain('문의');
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


describe('fitOneMessage', () => {
  const w = weekWindow('2026-10-11');
  const mk = (n: number, title: string) => ({ title: `${title}${n}`, date: '', summary: 'x'.repeat(300), sources: [] });
  const big: Brief = {
    headline: '핵심',
    sections: [
      { heading: '프로토콜 · 코어 개발', items: [1, 2, 3].map((n) => mk(n, 'p')) },
      { heading: '업계 동향', items: [1].map((n) => mk(n, 'i')) },
    ],
    upcoming: ['10.26 일정'],
  };

  it('should leave a brief that already fits untouched', () => {
    expect(fitOneMessage(brief, w)).toEqual({ brief, dropped: [] });
  });

  it('should drop the last item of the largest section until it fits', () => {
    const limit = formatBrief(big, w).length - 1;
    const { brief: out, dropped } = fitOneMessage(big, w, limit);
    expect(dropped).toEqual(['p3']);
    expect(out.sections[0].items.map((i) => i.title)).toEqual(['p1', 'p2']);
    expect(formatBrief(out, w).length).toBeLessThanOrEqual(limit);
    expect(out.upcoming).toEqual(big.upcoming);
  });
});
