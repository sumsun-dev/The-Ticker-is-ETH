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
<div class="tgme_widget_message_grouped"><a class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn5.telesco.pe/file/photo1560a.jpg')"></a><a class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn5.telesco.pe/file/photo1560b.jpg')"></a></div>
<div class="tgme_widget_message_text js-message_text" dir="auto"><b>ZKsync, 프리비디움 코어 오픈소스화 발표</b><br/><br/>ZKsync가 권한 관리 엔진을 오픈소스로 공개했습니다. R&amp;D 예산도 늘립니다.<br/><br/><a href="https://x.com/zksync/status/2097340947625656632" target="_blank" rel="noopener">링크</a></div>
<time datetime="2026-09-09T01:31:29+00:00">10:31</time></div></div>
<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="thetickeriseth/1561">
<a class="tgme_widget_message_video_player" href="https://t.me/thetickeriseth/1561"><i class="tgme_widget_message_video_thumb" style="background-image:url('https://cdn5.telesco.pe/file/thumb1561.jpg')"></i>
<div class="tgme_widget_message_video_wrap"><video src="https://cdn5.telesco.pe/file/3e22.mp4?token=abc&amp;x=1" class="tgme_widget_message_video"></video></div></a>
<div class="tgme_widget_message_text js-message_text" dir="auto"><b>새롭게 출시된 Etherscan Flow</b><br/><br/>설명 <a href="https://github.com/etherscan/skills">https://github.com/etherscan/skills</a></div>
<time datetime="2026-09-09T02:30:00+00:00">11:30</time></div></div>
<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="thetickeriseth/1562">
<a class="tgme_widget_message_photo_wrap" style="width:800px;background-image:url('https://cdn5.telesco.pe/file/cover1562.jpg')"></a>
<div class="tgme_widget_message_text js-message_text" dir="auto"><b>ACDT #95 · 9월 7일</b><br/>테스팅 콜이다.<br/><br/><i>결정된 것</i><br/>· EIP-8253은 헤고타로 미뤄졌다.</div>
<time datetime="2026-09-09T05:40:00+00:00">14:40</time></div></div>
<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="thetickeriseth/1563">
<a class="tgme_widget_message_reply user-color-default" href="https://t.me/thetickeriseth/1562" "><i class="tgme_widget_message_reply_thumb" style="background-image:url('https://cdn5.telesco.pe/file/thumb1562.jpg')"></i><div class="tgme_widget_message_author"><span dir="auto">The Ticker is ETH</span></div><div class="tgme_widget_message_text js-message_reply_text" dir="auto">ACDT #95 · 9월 7일 테스팅 콜이다. 결정된 것 · EIP-8253은 헤고타로 미뤄졌다.</div></a>
<div class="tgme_widget_message_text js-message_text" dir="auto"><b>ACDT #95 · 누가 무슨 말을 했나</b><br/><br/>콜 페이지에서 전체 보기 → <a href="https://ethcollective.xyz/calls/acdt-95" target="_blank" rel="noopener">https://ethcollective.xyz/calls/acdt-95</a></div>
<time datetime="2026-09-09T05:41:00+00:00">14:41</time></div></div>`;

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
    expect(posts.map((p) => p.id)).toEqual([1559, 1560, 1561, 1562, 1563]);
    // 답글은 부모 id를 갖고, 본문은 부모 미리보기가 아니라 자기 글만
    expect(posts[4]).toMatchObject({ replyTo: 1562, photos: [] });
    expect(posts[4].html).toContain('콜 페이지에서 전체 보기');
    expect(posts[4].html).not.toContain('테스팅 콜이다');
    expect(posts[3].replyTo).toBeUndefined();
    expect(posts[0]).toMatchObject({ date: '2026-09-09T00:41:00+00:00', photos: ['https://cdn5.telesco.pe/file/cover1559.jpg'] });
    expect(posts[1].photos).toEqual(['https://cdn5.telesco.pe/file/photo1560a.jpg', 'https://cdn5.telesco.pe/file/photo1560b.jpg']);
    expect(posts[1].html).toContain('ZKsync');
    expect(posts[2]).toMatchObject({ photos: [], video: 'https://cdn5.telesco.pe/file/3e22.mp4?token=abc&x=1' });
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
    expect(d.photos).toEqual(['https://cdn5.telesco.pe/file/cover1559.jpg']);

    const z = buildLinkedInPost(p1560, [digest]);
    expect(z.digestDate).toBeUndefined();
    expect(z.body).toBe('ZKsync, 프리비디움 코어 오픈소스화 발표\n\nZKsync가 권한 관리 엔진을 오픈소스로 공개했습니다. R&D 예산도 늘립니다.\n\n#Ethereum #이더리움 #ECK #TheTickerIsETH');
    expect(z.comment).toBe('원문: https://x.com/zksync/status/2097340947625656632\n텔레그램 채널 The Ticker is ETH: https://t.me/thetickeriseth');
    expect(z.photos).toHaveLength(2);

    const v = buildLinkedInPost(parseChannelPage(PAGE, 'thetickeriseth')[2], [digest]);
    expect(v.video).toContain('3e22.mp4');
    expect(v.body).toBe('새롭게 출시된 Etherscan Flow\n\n설명\n\n#Ethereum #이더리움 #ECK #TheTickerIsETH');
    expect(v.comment).toBe('원문: https://github.com/etherscan/skills\n텔레그램 채널 The Ticker is ETH: https://t.me/thetickeriseth');

    // 콜 브리프: 커버 글은 본문 그대로, 답글(토론 메시지)의 사이트 링크는 첫 댓글로
    const all = parseChannelPage(PAGE, 'thetickeriseth');
    const brief = buildLinkedInPost(all[3], [digest], undefined, all.filter((p) => p.replyTo === 1562));
    expect(brief.body.startsWith('ACDT #95 · 9월 7일\n테스팅 콜이다.\n\n결정된 것\n· EIP-8253은 헤고타로 미뤄졌다.')).toBe(true);
    expect(brief.body).not.toMatch(/https?:\/\//);
    expect(brief.comment).toBe('전체 보기: https://ethcollective.xyz/calls/acdt-95\n텔레그램 채널 The Ticker is ETH: https://t.me/thetickeriseth');
    expect(brief.photos).toEqual(['https://cdn5.telesco.pe/file/cover1562.jpg']);
  });

  it('should pick unseen recent posts oldest first', () => {
    const posts = parseChannelPage(PAGE, 'thetickeriseth');
    const now = new Date('2026-09-09T12:00:00Z');
    // 답글(1563)은 따로 올리지 않는다
    expect(pickChannelPosts(posts, [1559], now).map((p) => p.id)).toEqual([1560, 1561, 1562]);
    expect(pickChannelPosts(posts, [], new Date('2026-09-20T00:00:00Z')).map((p) => p.id)).toEqual([]);
  });
});
