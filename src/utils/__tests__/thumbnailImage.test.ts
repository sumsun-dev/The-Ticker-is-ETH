import { describe, it, expect } from 'vitest';
import { coverCrop } from '../thumbnailImage';

describe('coverCrop', () => {
  it('가로로 긴 이미지는 양옆을 자른다', () => {
    expect(coverCrop(4000, 1000)).toEqual({ sx: (4000 - 1777.7777777777778) / 2, sy: 0, sw: 1777.7777777777778, sh: 1000 });
  });
  it('세로로 긴 이미지는 위아래를 자른다', () => {
    const c = coverCrop(1000, 2000);
    expect(c.sw).toBe(1000);
    expect(c.sh).toBeCloseTo(562.5);
    expect(c.sy).toBeCloseTo((2000 - 562.5) / 2);
  });
  it('이미 16:9면 그대로', () => {
    expect(coverCrop(1920, 1080)).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });
});
