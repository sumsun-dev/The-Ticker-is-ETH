import { describe, it, expect } from 'vitest';
import { chunk, pickValid } from '../translate-en';

describe('translate-en pickValid', () => {
    const strings = ['사용자', '검증자', '노드'];

    it('should map answers back to their Korean strings', () => {
        const got = pickValid('{"0":"Users","1":"Validators","2":"Nodes"}', strings);
        expect([...got]).toEqual([['사용자', 'Users'], ['검증자', 'Validators'], ['노드', 'Nodes']]);
    });

    it('should read JSON wrapped in a code fence or commentary', () => {
        expect(pickValid('Here you go:\n```json\n{"0":"Users"}\n```', strings).get('사용자')).toBe('Users');
    });

    it('should drop empty, missing and still-Korean answers so they are retried', () => {
        const got = pickValid('{"0":"","1":"검증자 (validator)","5":"x"}', strings);
        expect(got.size).toBe(0);
    });

    it('should return nothing when the answer is not JSON', () => {
        expect(pickValid('직전 답변은 요청받은 번역입니다.', strings).size).toBe(0);
        expect(pickValid('', strings).size).toBe(0);
    });
});

describe('translate-en chunk', () => {
    it('should keep document order and cut by character count', () => {
        expect(chunk(['가나', '다라', '마'], 4)).toEqual([['가나', '다라'], ['마']]);
    });

    it('should give a string longer than the limit its own chunk', () => {
        expect(chunk(['가', '나다라마바사', '아'], 3)).toEqual([['가'], ['나다라마바사'], ['아']]);
    });

    it('should return no chunks for no strings', () => {
        expect(chunk([], 10)).toEqual([]);
    });
});
