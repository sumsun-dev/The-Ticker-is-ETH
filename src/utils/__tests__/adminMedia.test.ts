import { describe, expect, it } from 'vitest';
import { thumbIndex, tgThumb, pageThumb, liThumb } from '../adminMedia';

const idx = thumbIndex([
  { id: 'tg-1650', thumbnailUrl: 'https://r2.dev/telegram/tg-1650.jpg' },
  { id: 'tg-1690', thumbnailUrl: 'https://r2.dev/telegram/tg-1690.jpg' },
  { id: 'tg-12', thumbnailUrl: '' },
]);

describe('adminMedia', () => {
  it('텔레그램 글 id로 사이트 썸네일을 찾는다', () => {
    expect(tgThumb(1650, idx)).toBe('https://r2.dev/telegram/tg-1650.jpg');
    expect(tgThumb(12, idx)).toBeNull();
    expect(tgThumb(9, idx)).toBeNull();
  });

  it('페이지 경로로 대표 이미지를 고른다', () => {
    expect(pageThumb('/contents/tg-1650', idx)).toBe('https://r2.dev/telegram/tg-1650.jpg');
    expect(pageThumb('/contents/videos/wr6JU4-7M7A', idx)).toBe('https://i.ytimg.com/vi/wr6JU4-7M7A/hqdefault.jpg');
    expect(pageThumb('/events/ek1-genesis', idx)).toBe('/assets/events/ek1-genesis/main-banner.jpg');
    expect(pageThumb('/', idx)).toBe('/assets/eck-og.png');
    expect(pageThumb('/news', idx)).toBeNull();
  });

  it('링크드인 글은 같은 내용으로 시작하는 텔레그램 글의 이미지를 빌린다', () => {
    const tg = [
      { id: 1650, date: '', views: 0, text: '이더리움 코리아 Day2 세션 영상 너무 유익했던 Day2 세션 영상이' },
      { id: 1690, date: '', views: 0, text: 'EIP-8288의 시각화 이더리움 메인 체인에' },
    ];
    expect(liThumb('이더리움 코리아 Day2 세션 영상 너무 유익했던 Day2 세션 영상이 이더리움 코리아 유튜브에', tg, idx)).toBe('https://r2.dev/telegram/tg-1650.jpg');
    expect(liThumb(':  : EIP-8288의 시각화 이더리움 메인 체인에 암호 기능을', tg, idx)).toBe('https://r2.dev/telegram/tg-1690.jpg');
    expect(liThumb('전혀 다른 글', tg, idx)).toBeNull();
  });
});
