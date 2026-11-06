import { describe, expect, it } from 'vitest';
// @ts-expect-error 서버 cron용 순수 JS 모듈
import { parseSubscribers, upsertDay } from '../../deploy/tg-subscribers.mjs';

describe('tg-subscribers (서버 cron)', () => {
  it('채널 소개 페이지에서 정확한 구독자 수를 읽는다', () => {
    expect(parseSubscribers('<div class="tgme_page_extra">1 506 subscribers</div>')).toBe(1506);
    expect(parseSubscribers('<div class="tgme_page_extra">12 345 678 subscribers</div>')).toBe(12345678);
    expect(parseSubscribers('<div class="tgme_page_extra">980 subscribers</div>')).toBe(980);
  });

  it('형식이 바뀌면 null (0으로 저장하지 않는다)', () => {
    expect(parseSubscribers('<html>점검 중</html>')).toBeNull();
    expect(parseSubscribers('<div class="tgme_page_extra">1.5K subscribers</div>')).toBeNull();
  });

  it('같은 날은 덮어쓰고 날짜순으로 둔다', () => {
    const list = [{ date: '2026-11-05', subscribers: 1500 }, { date: '2026-11-04', subscribers: 1490 }];
    expect(upsertDay(list, { date: '2026-11-05', subscribers: 1506 })).toEqual([
      { date: '2026-11-04', subscribers: 1490 },
      { date: '2026-11-05', subscribers: 1506 },
    ]);
    expect(upsertDay([], { date: '2026-11-06', subscribers: 1 })).toEqual([{ date: '2026-11-06', subscribers: 1 }]);
  });
});
