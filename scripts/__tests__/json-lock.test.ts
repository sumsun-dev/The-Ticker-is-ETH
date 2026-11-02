import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { inShard, parseShard, updateJsonLocked } from '../lib/json-lock';

describe('json-lock', () => {
  it('updateJsonLocked: 최신 파일을 다시 읽어 합치고 잠금을 푼다', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jl-')), 'x.json');
    fs.writeFileSync(file, JSON.stringify({ items: [1] }));
    updateJsonLocked<{ items: number[] }>(file, (c) => ({ items: [...c.items, 2] }));
    // 다른 작업자가 그사이 쓴 것도 보존된다
    fs.writeFileSync(file, JSON.stringify({ items: [1, 2, 3] }));
    updateJsonLocked<{ items: number[] }>(file, (c) => ({ items: [...c.items, 4] }));
    expect(JSON.parse(fs.readFileSync(file, 'utf-8')).items).toEqual([1, 2, 3, 4]);
    expect(fs.existsSync(`${file}.lock`)).toBe(false);
  });

  it('updateJsonLocked: 실패해도 잠금을 푼다', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jl-')), 'x.json');
    fs.writeFileSync(file, '{}');
    expect(() => updateJsonLocked(file, () => {
      throw new Error('boom');
    })).toThrow('boom');
    expect(fs.existsSync(`${file}.lock`)).toBe(false);
  });

  it('parseShard·inShard: 대상을 겹치지 않게 나눈다', () => {
    expect(parseShard(undefined)).toEqual({ i: 0, n: 1 });
    const xs = [1, 2, 3, 4, 5];
    expect([inShard(xs, parseShard('1/2')), inShard(xs, parseShard('2/2'))]).toEqual([[1, 3, 5], [2, 4]]);
    expect(() => parseShard('3/2')).toThrow();
  });
});
