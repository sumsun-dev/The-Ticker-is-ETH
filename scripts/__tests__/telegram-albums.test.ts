import { describe, expect, it } from 'vitest';
import { mergeAlbums, type AlbumPart } from '../lib/telegram-albums';

const msg = (id: number, extra: Partial<AlbumPart> = {}): AlbumPart => ({ id, text: '', views: 1, forwards: 0, ...extra });

describe('mergeAlbums', () => {
  it('should merge an album into one message with all images in id order and the caption', () => {
    const out = mergeAlbums([
      msg(12, { groupedId: 'g', imageUrls: ['c'], views: 9 }),
      msg(11, { groupedId: 'g', imageUrls: ['b'] }),
      msg(10, { groupedId: 'g', imageUrls: ['a'], text: '본문', linkEntities: [{ offset: 0 }] as unknown[] }),
      msg(9, { text: '따로 쓴 글' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ id: 10, text: '본문', views: 9, forwards: 0, linkEntities: [{ offset: 0 }] as unknown[], imageUrls: ['a', 'b', 'c'] });
    expect(out[1].id).toBe(9);
  });

  it('should use the captioned part even when it is not the first', () => {
    const [m] = mergeAlbums([msg(2, { groupedId: 'g', text: '캡션', imageUrls: ['y'] }), msg(1, { groupedId: 'g', imageUrls: ['x'] })]);
    expect(m.text).toBe('캡션');
    expect(m.id).toBe(1);
    expect(m.imageUrls).toEqual(['x', 'y']);
  });

  it('should leave messages without groupedId untouched', () => {
    const list = [msg(1, { text: 'a' }), msg(2, { imageUrls: ['p'] })];
    expect(mergeAlbums(list)).toEqual(list);
  });
});
