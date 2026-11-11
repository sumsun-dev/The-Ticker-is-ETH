import { describe, it, expect } from 'vitest';
import { collectKo, hashKo, localize } from '../localize';

const dict = { [hashKo('사용자')]: 'Users', [hashKo('지갑이 바뀝니다')]: 'Wallets change', [hashKo('확정')]: 'Confirmed', [hashKo('번역문')]: 'x' };

describe('localize', () => {
    it('should swap Korean strings found in the dictionary, at any depth', () => {
        const data = { impact: [{ who: '사용자', text: '지갑이 바뀝니다' }], number: 7702, meta: { title: 'Set code' } };
        expect(localize(data, dict)).toEqual({ impact: [{ who: 'Users', text: 'Wallets change' }], number: 7702, meta: { title: 'Set code' } });
    });

    it('should leave strings without a translation in Korean', () => {
        expect(localize(['새 문장', '사용자'], dict)).toEqual(['새 문장', 'Users']);
    });

    it('should keep compared values and drop Korean renderings of English originals', () => {
        const out = localize({ status: '확정', translation: '번역문', original: 'hello', topics: [{ status: { line: '사용자' } }] }, dict);
        expect(out).toEqual({ status: '확정', original: 'hello', topics: [{ status: { line: 'Users' } }] });
    });

    it('should handle empty and null data', () => {
        expect(localize(null, dict)).toBeNull();
        expect(localize([], dict)).toEqual([]);
        expect(localize({ a: undefined }, {})).toEqual({ a: undefined });
    });
});

describe('collectKo', () => {
    it('should collect unique Korean strings in document order, by the same rules as localize', () => {
        const data = { a: '사용자', b: ['English', '지갑이 바뀝니다', '사용자'], status: '확정', translation: '번역문' };
        expect([...collectKo(data)]).toEqual(['사용자', '지갑이 바뀝니다']);
    });
});
