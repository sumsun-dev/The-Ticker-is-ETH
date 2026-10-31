import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const gh = vi.hoisted(() => ({
  createFile: vi.fn().mockResolvedValue(undefined),
  getFileContent: vi.fn().mockResolvedValue({ sha: 's', content: Buffer.from('[]').toString('base64') }),
  updateFile: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../_lib/github.js', () => gh);
import handler from '../research/publish';

const call = async (body: Record<string, unknown>) => {
  let status = 200;
  let json: unknown;
  const res = { status: (c: number) => ((status = c), res), json: (j: unknown) => ((json = j), res) } as unknown as VercelResponse;
  await handler({ method: 'POST', body } as VercelRequest, res);
  return { status, json: json as Record<string, string> };
};
const base = { password: 'pw', title: '제목', author: 'sose', authorAvatar: '', category: 'Research', summary: '요약', content: '# 본문', thumbnailUrl: '/assets/thumbs/eck-navy.png' };

describe('publish API 썸네일', () => {
  beforeEach(() => {
    process.env.PUBLISH_PASSWORD = 'pw';
    vi.clearAllMocks();
  });

  it('기본 이미지는 주소만 인덱스에 남긴다', async () => {
    const r = await call(base);
    expect(r.status).toBe(200);
    expect(r.json.thumbnailUrl).toBe('/assets/thumbs/eck-navy.png');
    expect(gh.createFile).toHaveBeenCalledTimes(1);
  });

  it('올린 이미지는 public/assets/research에 바이너리로 커밋하고 그 주소를 쓴다', async () => {
    const r = await call({ ...base, thumbnailImage: { type: 'image/webp', data: Buffer.from('img').toString('base64') } });
    expect(r.status).toBe(200);
    const [path, content] = gh.createFile.mock.calls[0];
    expect(path).toMatch(/^public\/assets\/research\/research-\d{8}-[0-9a-f]{8}\.webp$/);
    expect(Buffer.isBuffer(content) && content.toString()).toBe('img');
    expect(r.json.thumbnailUrl).toBe(path.replace(/^public/, ''));
  });

  it('지원하지 않는 형식이나 너무 큰 이미지는 거절한다', async () => {
    expect((await call({ ...base, thumbnailImage: { type: 'image/gif', data: 'aGk=' } })).status).toBe(400);
    expect((await call({ ...base, thumbnailImage: { type: 'image/png', data: Buffer.alloc(800 * 1024).toString('base64') } })).status).toBe(413);
    expect(gh.createFile).not.toHaveBeenCalled();
  });
});
