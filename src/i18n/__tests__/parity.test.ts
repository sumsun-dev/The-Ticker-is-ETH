import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..');
const keys = (v: unknown, prefix = ''): string[] =>
    v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => keys(x, `${prefix}${k}.`)) : [prefix.slice(0, -1)];
const load = (lang: string, file: string) => JSON.parse(readFileSync(join(DIR, lang, file), 'utf8'));

// 화면 문구를 한국어에만 넣고 영어를 빠뜨리면 영어판에 한국어가 섞인다
describe('i18n ko/en', () => {
    for (const file of readdirSync(join(DIR, 'ko'))) {
        it(`should have the same keys in both languages: ${file}`, () => {
            expect(keys(load('en', file)).sort()).toEqual(keys(load('ko', file)).sort());
        });
    }
});
