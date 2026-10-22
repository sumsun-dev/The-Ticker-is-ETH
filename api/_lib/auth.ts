import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** 관리자 비밀번호(PUBLISH_PASSWORD) 확인. 서버에 비밀번호가 없으면 'misconfigured' */
export function checkAdmin(password: unknown): 'ok' | 'invalid' | 'misconfigured' {
  const expected = process.env.PUBLISH_PASSWORD;
  if (!expected) return 'misconfigured';
  return typeof password === 'string' && password && safeCompare(password, expected) ? 'ok' : 'invalid';
}
