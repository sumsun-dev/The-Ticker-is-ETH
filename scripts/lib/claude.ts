/**
 * 헤드리스 claude CLI 호출 (구독 인증, API 키 없음). 콜 기록 추출과 콜 브리프 스크립트가 같이 쓴다.
 * Claude Code 세션 안에서 돌려도 중첩 실행 차단에 걸리지 않도록 CLAUDECODE를 지운다.
 */
import { execFileSync } from 'node:child_process';

export function runClaude(prompt: string, model: string, timeoutMs = 15 * 60 * 1000): string {
  const raw = execFileSync('claude', ['-p', prompt, '--output-format', 'json', '--model', model], {
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs,
    env: { ...process.env, CLAUDECODE: undefined },
  });
  const envelope = JSON.parse(raw) as { result?: string; is_error?: boolean };
  if (envelope.is_error || !envelope.result) throw new Error(`headless claude (${model}) returned an error`);
  return envelope.result;
}
