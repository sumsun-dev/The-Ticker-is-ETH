import { describe, expect, it } from 'vitest';
import { CAPTION_MAX, formatDigestCaption, hashtag, pickDigestsToPost } from '../lib/linkedin-caption';

const digest = {
  date: '2026-09-06',
  title: '프로토콜 프런티어가 실행층을 넘어 합의층으로 넓어졌다',
  intro: '이번 호는 프레임즈 수렴과 완결성 4배 PoC를 다룬다.',
  subTitle: '프레임즈 수렴',
  sections: [
    { heading: '이번 호 인사이트', items: [{ title: '트랜잭션 포맷 담론이 프레임즈(EIP-8141)로 수렴', url: 'https://x.com/a/1', source: 'X' }] },
    { heading: '코어 개발자 콜', items: [{ title: 'ACDE #244: EIP-8141 SFI', url: 'https://forkcast.org/calls/acde/244/', source: 'forkcast' }] },
    { heading: '시장 브리핑', items: [{ title: '가격 이야기', url: 'https://x.com/b/2', source: 'X' }] },
  ],
  telegramMessageId: 1555,
};

describe('formatDigestCaption', () => {
  it('should include title, intro, core sections only, site link and hashtags', () => {
    const out = formatDigestCaption(digest, 'https://ethcollective.xyz/news?date=2026-09-06');
    expect(out.startsWith('프로토콜 프런티어가 실행층을 넘어 합의층으로 넓어졌다\n\n이번 호는')).toBe(true);
    expect(out).toContain('■ 이번 호 인사이트\n· 트랜잭션 포맷 담론이 프레임즈(EIP-8141)로 수렴');
    expect(out).toContain('■ 코어 개발자 콜\n· ACDE #244: EIP-8141 SFI');
    expect(out).not.toContain('시장 브리핑');
    expect(out).toContain('전체 요약 보기: https://ethcollective.xyz/news?date=2026-09-06');
    expect(out.trim().endsWith('#Ethereum #이더리움 #ECK #TheTickerIsETH')).toBe(true);
    expect(hashtag('이더리움 코어')).toBe('#이더리움코어');
  });

  it('should trim items from the end to fit the limit without orphan headings', () => {
    const big = {
      ...digest,
      sections: [{ heading: '프로토콜 업데이트', items: Array.from({ length: 80 }, (_, i) => ({ title: `항목 ${i} ${'가'.repeat(60)}`, url: 'https://x', source: 'X' })) }, digest.sections[1]],
    };
    const out = formatDigestCaption(big, 'https://ethcollective.xyz/news');
    expect(out.length).toBeLessThanOrEqual(CAPTION_MAX);
    expect(out).not.toMatch(/■ [^\n]+\n\n/);
    expect(out).toContain('#ECK');
  });
});

describe('pickDigestsToPost', () => {
  it('should return unposted, telegram-published digests within the window, oldest first', () => {
    const list = [
      { date: '2026-09-09', telegramMessageId: 1560 },
      { date: '2026-09-06', telegramMessageId: 1555 },
      { date: '2026-09-05', telegramMessageId: undefined },
      { date: '2026-09-01', telegramMessageId: 1540 },
    ];
    expect(pickDigestsToPost(list, ['2026-09-06'], '2026-09-09').map((d) => d.date)).toEqual(['2026-09-09']);
    expect(pickDigestsToPost(list, [], '2026-09-09').map((d) => d.date)).toEqual(['2026-09-06', '2026-09-09']);
    expect(pickDigestsToPost(list, [], '2026-09-09', 10).map((d) => d.date)).toEqual(['2026-09-01', '2026-09-06', '2026-09-09']);
  });
});
