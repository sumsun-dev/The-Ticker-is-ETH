import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import data from '../eth-digests.json';

type Digests = { digests: Array<{ date: string; coverImage?: string; coverWebp?: string }> };
const file = (publicPath: string) => path.resolve(process.cwd(), 'public', publicPath.split('?')[0].replace(/^\//, ''));

describe('eth-digests cover files', () => {
  it('should point every cover path at a file that exists', () => {
    const { digests } = data as unknown as Digests;
    const missing = digests.flatMap((d) => [d.coverImage, d.coverWebp]).filter((p): p is string => !!p && !existsSync(file(p)));
    expect(missing).toEqual([]);
  });

  it('should have a WebP cover wherever there is a PNG cover', () => {
    const { digests } = data as unknown as Digests;
    expect(digests.filter((d) => d.coverImage && !d.coverWebp).map((d) => d.date)).toEqual([]);
  });
});
