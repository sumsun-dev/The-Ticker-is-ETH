import { describe, expect, it } from 'vitest';
import { CAPTION_MAX, buildLinkedInPost, channelHtmlToText, formatDigestCaption, hashtag, parseChannelPage, pickChannelPosts, stripUrls } from '../lib/linkedin-caption';

const digest = {
  date: '2026-09-09',
  title: '62개 EIP에 등급을 매긴 EF의 한목소리',
  intro: '이번 호의 중심은 EF Protocol 클러스터가 처음으로 낸 한목소리다.',
  sections: [
    { heading: '이번 호 인사이트', items: [{ title: 'EF가 처음으로 하나의 목소리를 냈다', url: 'https://x.com/a/1', source: 'X' }] },
    { heading: '코어 개발자 콜', items: [{ title: 'ACDE #244: EIP-8141 SFI', url: 'https://forkcast.org/calls/acde/244/', source: 'forkcast' }] },
    { heading: '시장 브리핑', items: [{ title: '가격 이야기', url: 'https://x.com/b/2', source: 'X' }] },
  ],
  telegramMessageId: 1559,
};

const PAGE = `
<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="thetickeriseth/1559">
<a class="tgme_widget_message_photo_wrap" style="width:800px;background-image:url('https://cdn5.telesco.pe/file/cover1559.jpg')"></a>
<div class="tgme_widget_message_text js-message_text" dir="auto"><b>62개 EIP에 등급을 매긴 EF의 한목소리</b><br/><br/><b>이번 호 인사이트</b><br/>· <a href="https://x.com/a/1" target="_blank">EF가 처음으로 하나의 목소리를 냈다</a><br/><br/>전체 요약 보기 → https://ethcollective.xyz/news?date=2026-09-09</div>
<time datetime="2026-09-09T00:41:00+00:00">09:41</time></div></div>
<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="thetickeriseth/1560">
<a class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn5.telesco.pe/file/photo1560.jpg')"></a>
<div class="tgme_widget_message_text js-message_text" dir="auto"><b>ZKsync, 프리비디움 코어 오픈소스화 발표</b><br/><br/>ZKsync가 권한 관리 엔진을 오픈소스로 공개했습니다. R&amp;D 예산도 늘립니다.<br/><br/><a href="https://x.com/zksync/status/2097340947625656632" target="_blank" rel="noopener">링크</a></div>
<time datetime="2026-09-09T01:31:29+00:00">10:31</time></div></div>`;

describe('formatDigestCaption', () => {
  it('should include title, intro, core sections and hashtags, but no URL', () => {
    const out = formatDigestCaption(digest);
    expect(out.startsWith('62개 EIP에 등급을 매긴 EF의 한목소리\n\n이번 호의 중심은')).toBe(true);
    expect(out).toContain('■ 이번 호 인사이트\n· EF가 처음으로 하나의 목소리를 냈다');
    expect(out).toContain('■ 코어 개발자 콜\n· ACDE #244: EIP-8141 SFI');
    expect(out).not.toContain('시장 브리핑');
    expect(out).not.toMatch(/https?:\/\//);
    expect(out.trim().endsWith('#Ethereum #이더리움 #ECK #TheTickerIsETH')).toBe(true);
    expect(hashtag('이더리움 코어')).toBe('#이더리움코어');
  });

  it('should trim items from the end to fit the limit without orphan headings', () => {
    const big = { ...digest, sections: [{ heading: '프로토콜 업데이트', items: Array.from({ length: 80 }, (_, i) => ({ title: `항목 ${i} ${'가'.repeat(60)}`, url: 'https://x', source: 'X' })) }, digest.sections[1]] };
    const out = formatDigestCaption(big);
    expect(out.length).toBeLessThanOrEqual(CAPTION_MAX);
    expect(out).not.toMatch(/■ [^\n]+\n\n/);
    expect(out).toContain('#ECK');
  });
});

describe('telegram channel web view', () => {
  it('should parse posts with id, date, photo and html', () => {
    const posts = parseChannelPage(PAGE, 'thetickeriseth');
    expect(posts.map((p) => p.id)).toEqual([1559, 1560]);
    expect(posts[0]).toMatchObject({ date: '2026-09-09T00:41:00+00:00', photo: 'https://cdn5.telesco.pe/file/cover1559.jpg' });
    expect(posts[1].html).toContain('ZKsync');
  });

  it('should convert html to text, keeping link labels and collecting urls', () => {
    const { text, links } = channelHtmlToText(parseChannelPage(PAGE, 'thetickeriseth')[1].html);
    expect(text).toBe('ZKsync, 프리비디움 코어 오픈소스화 발표\n\nZKsync가 권한 관리 엔진을 오픈소스로 공개했습니다. R&D 예산도 늘립니다.');
    expect(links).toEqual([{ label: '링크', url: 'https://x.com/zksync/status/2097340947625656632' }]);
    expect(stripUrls('보기 → https://a.b/c\n\n끝').text).toBe('보기\n\n끝');
  });

  it('should build a rich digest post with links only in the comment', () => {
    const [p1559, p1560] = parseChannelPage(PAGE, 'thetickeriseth');
    const d = buildLinkedInPost(p1559, [digest]);
    expect(d.digestDate).toBe('2026-09-09');
    expect(d.body).toContain('■ 코어 개발자 콜');
    expect(d.body).not.toMatch(/https?:\/\//);
    expect(d.comment).toBe('전체 요약 보기: https://ethcollective.xyz/news?date=2026-09-09\n텔레그램 채널 The Ticker is ETH: https://t.me/thetickeriseth');
    expect(d.photo).toBe('https://cdn5.telesco.pe/file/cover1559.jpg');

    const z = buildLinkedInPost(p1560, [digest]);
    expect(z.digestDate).toBeUndefined();
    expect(z.body).toBe('ZKsync, 프리비디움 코어 오픈소스화 발표\n\nZKsync가 권한 관리 엔진을 오픈소스로 공개했습니다. R&D 예산도 늘립니다.\n\n#Ethereum #이더리움 #ECK #TheTickerIsETH');
    expect(z.comment).toBe('원문: https://x.com/zksync/status/2097340947625656632\n텔레그램 채널 The Ticker is ETH: https://t.me/thetickeriseth');
  });

  it('should pick unseen recent posts oldest first', () => {
    const posts = parseChannelPage(PAGE, 'thetickeriseth');
    const now = new Date('2026-09-09T12:00:00Z');
    expect(pickChannelPosts(posts, [1559], now).map((p) => p.id)).toEqual([1560]);
    expect(pickChannelPosts(posts, [], new Date('2026-09-20T00:00:00Z')).map((p) => p.id)).toEqual([]);
  });
});
