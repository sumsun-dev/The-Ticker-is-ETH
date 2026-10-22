import { describe, expect, it } from 'vitest';
import { bars, formatReport, lastWeek, liWeek, parseCount, parseLinkedIn, parseLogLine, parseTgPosts, refererSource, siteStats, type LogLine } from '../lib/weekly-stats';

const line = (ip: string, when: string, path: string, ref = '-', ua = 'Mozilla/5.0 (Macintosh) Chrome/130') =>
  `${ip} - - [${when} +0000] "GET ${path} HTTP/2.0" 200 100 "${ref}" "${ua}" ethcollective.xyz`;
const parse = (ls: string[]) => ls.map(parseLogLine).filter((l): l is LogLine => l !== null);

describe('weekly-stats', () => {
  it('lastWeek: KST 월요일 오전 기준 직전 월~일', () => {
    expect(lastWeek(new Date('2026-10-19T00:00:00Z'))).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    // 일요일 23시 KST(= 14시 UTC)는 아직 그 주 안이다
    expect(lastWeek(new Date('2026-10-18T14:00:00Z'))).toEqual({ start: '2026-10-05', end: '2026-10-11' });
  });

  it('parseLogLine: vhost 로그 한 줄', () => {
    const l = parseLogLine(line('1.2.3.4', '21/Oct/2026:00:06:17', '/news?x=1', 'https://t.me/'));
    expect(l).toMatchObject({ ip: '1.2.3.4', method: 'GET', path: '/news?x=1', status: 200, referer: 'https://t.me/' });
    expect(l?.time.toISOString()).toBe('2026-10-21T00:06:17.000Z');
    expect(parseLogLine('garbage')).toBeNull();
  });

  it('refererSource: 채널 분류', () => {
    expect(refererSource('-')).toBe('직접');
    expect(refererSource('https://ethcollective.xyz/news')).toBe('직접');
    expect(refererSource('https://t.co/abc')).toBe('X');
    expect(refererSource('https://www.google.com/')).toBe('검색');
    expect(refererSource('https://search.naver.com/')).toBe('검색');
    expect(refererSource('https://www.linkedin.com/')).toBe('링크드인');
    expect(refererSource('https://example.org/')).toBe('기타');
  });

  it('siteStats: 앱 JS를 받은 방문자만, KST 구간으로 센다', () => {
    const lines = parse([
      line('1.1.1.1', '13/Oct/2026:01:00:00', '/news', 'https://t.co/x'),
      line('1.1.1.1', '13/Oct/2026:01:00:01', '/assets/index-abc.js'),
      line('2.2.2.2', '13/Oct/2026:02:00:00', '/'), // HTML만 긁는 스크래퍼
      line('3.3.3.3', '13/Oct/2026:03:00:00', '/', '-', 'Googlebot/2.1'),
      line('3.3.3.3', '13/Oct/2026:03:00:01', '/assets/index-abc.js', '-', 'Googlebot/2.1'),
      line('4.4.4.4', '18/Oct/2026:16:00:00', '/'), // 10.19 01시 KST, 구간 밖
      line('4.4.4.4', '18/Oct/2026:16:00:01', '/assets/index-abc.js'),
    ]);
    const s = siteStats(lines, { start: '2026-10-12', end: '2026-10-18' });
    expect(s.visitors).toBe(1);
    expect(s.newVisitors).toBe(1);
    expect(s.pageLoads).toBe(1);
    expect(s.mobilePct).toBe(0);
    expect(s.daily[1]).toEqual(['2026-10-13', 1]);
    expect(s.peakHour).toBe(10);
    expect(s.sections).toEqual([['뉴스', 1]]);
    expect(s.topPages).toEqual([['/news', 1]]);
    expect(s.sources).toEqual([['X', 1]]);
    expect(s.refHosts).toEqual([['t.co', 1]]);
    expect(s.bots.search).toBe(2);
  });

  it('siteStats: 구간 전에 본 방문자는 재방문, AI 크롤러 집계', () => {
    const lines = parse([
      line('1.1.1.1', '06/Oct/2026:01:00:00', '/assets/index-abc.js'),
      line('1.1.1.1', '13/Oct/2026:01:00:00', '/'),
      line('1.1.1.1', '13/Oct/2026:01:00:01', '/assets/index-abc.js'),
      line('9.9.9.9', '13/Oct/2026:01:00:00', '/llms.txt', '-', 'Mozilla/5.0 (compatible; GPTBot/1.2)'),
      line('9.9.9.9', '13/Oct/2026:01:00:00', '/', '-', 'ClaudeBot/1.0'),
    ]);
    const s = siteStats(lines, { start: '2026-10-12', end: '2026-10-18' });
    expect(s.visitors).toBe(1);
    expect(s.newVisitors).toBe(0);
    expect(s.bots.ai).toEqual([['OpenAI', 1], ['Anthropic', 1]]);
  });

  it('liWeek: 구간 글만, 자체 첫 댓글 1개 제외, 노출 순', () => {
    const p = (urn: string, date: string, impressions: number, comments: number) => ({ title: urn, urn, date, impressions, reactions: 1, comments });
    const wk = liWeek([p('a', '2026-10-19', 500, 1), p('b', '2026-10-13', 30, 1), p('c', '2026-10-14', 70, 3), p('c', '2026-10-14', 70, 3), p('d', '2026-10-11', 900, 1)], { start: '2026-10-12', end: '2026-10-18' });
    expect(wk.count).toBe(2);
    expect(wk.impressions).toBe(100);
    expect(wk.comments).toBe(2);
    expect(wk.top.map((x) => [x.urn, x.comments])).toEqual([['c', 2], ['b', 0]]);
  });

  it('parseTgPosts: id·날짜·조회수·본문', () => {
    const html = `<div data-post="ch/10"><div class="tgme_widget_message_text js-message_text" dir="auto">첫 글<br/>둘째 &amp; 줄</div><span class="tgme_widget_message_views">1.2K</span><time datetime="2026-10-13T01:00:00+00:00"></time></div>
<div data-post="ch/11"><span class="tgme_widget_message_views">87</span><time datetime="2026-10-14T01:00:00+00:00"></time></div>`;
    expect(parseTgPosts(html, 'ch')).toEqual([
      { id: 10, date: '2026-10-13T01:00:00+00:00', views: 1200, text: '첫 글 둘째 & 줄' },
      { id: 11, date: '2026-10-14T01:00:00+00:00', views: 87, text: '' },
    ]);
    expect(parseCount('2.5M')).toBe(2_500_000);
  });

  it('parseLinkedIn: 분석 화면 텍스트, 로그인 화면이면 에러', () => {
    const f = '팔로워 주요활동\n\n70\n\n총 팔로워\n\n9\n\n최근 30일의 새 팔로워\n\n12.5%';
    const u = '하이라이트\n\n2,880\n\n노출\n\n5.4%\n\n31\n\n반응\n\n35.4%\n\n56\n\n댓글\n\n100%';
    expect(parseLinkedIn(f, u)).toEqual({ followers: 70, newFollowers30: 9, impressions30: 2880, reactions30: 31 });
    expect(() => parseLinkedIn('로그인', '')).toThrow();
  });

  it('formatReport: 전주 대비와 채널별 실패 표시', () => {
    const text = formatReport({
      w: { start: '2026-10-12', end: '2026-10-18' },
      site: new Error('ssh 실패\n상세'),
      tg: { channel: 'ch', subscribers: 1510, posts: [{ id: 1, date: '', views: 300, text: '글' }] },
      li: { followers: 70, newFollowers30: 9, impressions30: 2880, reactions30: 31, posts: [{ title: '글', urn: 'urn:li:activity:1', date: '2026-10-13', impressions: 40, reactions: 2, comments: 2 }] },
      prev: { week: '2026-10-05', subscribers: 1500, followers: 72 },
    });
    expect(text).toContain('<b>ECK 주간 성과</b>\n10.12 (월) ~ 10.18 (일)');
    expect(text).toContain('수집 실패: ssh 실패');
    expect(text).not.toContain('상세');
    expect(text).toContain('구독자 <b>1,510</b>명 (전주 ▲10)');
    expect(text).toContain('팔로워 <b>70</b>명 (전주 ▼2)');
    expect(text).toContain('글 1개, 노출 40회');
    expect(text).toContain('<a href="https://www.linkedin.com/feed/update/urn:li:activity:1/">글</a> <b>40</b> (반응 2, 댓글 1)');
    expect(text).not.toMatch(/—/);
  });

  it('bars: 한글 폭을 맞추고 최대값이 max칸, HTML 이스케이프', () => {
    expect(bars([['직접', 10], ['X', 5], ['<a>', 0]], { max: 4 })).toBe('<pre>직접 ████ 10\nX    ██   5\n&lt;a&gt;       0</pre>');
  });
});
