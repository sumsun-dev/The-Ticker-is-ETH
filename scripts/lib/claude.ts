/**
 * 헤드리스 claude CLI 호출 (구독 인증, API 키 없음). 다이제스트·논쟁·콜 스크립트가 같이 쓴다.
 * Claude Code 세션 안에서 돌려도 중첩 실행 차단에 걸리지 않도록 CLAUDECODE를 지운다.
 * 기본 모델이 한도 소진이나 과부하로 막히면 대체 모델로 이어 간다 (오너 2026-09-10: fable 한도 소진 시 opus).
 */
import { execFileSync } from 'node:child_process';

/** 기본 모델이 막혔을 때 대신 쓸 모델. CLAUDE_FALLBACK_MODEL로 덮어쓸 수 있다 */
export const FALLBACK_MODEL: Record<string, string> = { fable: 'opus' };

/**
 * 한도 소진·과부하처럼 "다른 모델이면 될" 실패를 알리는 CLI 메시지. 프롬프트 오류나 타임아웃은 여기 걸리지 않는다.
 * 실측(2026-09-10): 한도 소진은 "You're out of usage credits. Switch to another model, …"으로 오고
 * CLI의 --fallback-model로는 구제되지 않아 여기서 직접 잡는다.
 */
const BLOCKED = /out of usage|usage credits|usage limit|limit reached|rate.?limit|quota|overloaded|capacity|not available|model_not|cc_cli_limit/i;

export const isBlocked = (detail: string): boolean => BLOCKED.test(detail);
export const fallbackOf = (model: string): string | undefined => process.env.CLAUDE_FALLBACK_MODEL || FALLBACK_MODEL[model];

class ClaudeError extends Error {
  /** 대체 모델로 다시 시도할 만한 실패인가 */
  readonly blocked: boolean;
  constructor(model: string, detail: string) {
    super(`headless claude (${model}) failed: ${detail.replace(/\s+/g, ' ').trim().slice(0, 300)}`);
    this.name = 'ClaudeError';
    this.blocked = isBlocked(detail);
  }
}

/** 실패 출력에서 사람이 읽을 메시지만 꺼낸다. JSON이 아니면 원문 그대로 */
function resultOf(stdout: string | undefined): string {
  if (!stdout) return '';
  try {
    return String((JSON.parse(stdout) as { result?: string }).result ?? stdout);
  } catch {
    return stdout;
  }
}

function callOnce(prompt: string, model: string, timeoutMs: number, fallback?: string): string {
  // 우리가 쓰는 건 프롬프트 → 텍스트뿐이다. 파일 도구를 막지 않으면 모델이 결과를 리포에 파일로 쓴다
  // (2026-09-10 opus가 acdt-090.json을 리포 루트에 남김)
  const args = ['-p', prompt, '--output-format', 'json', '--model', model, '--disallowed-tools', 'Write', 'Edit', 'NotebookEdit', 'Bash'];
  // CLI 자체 대체는 과부하·모델 미제공만 다룬다. 한도 소진은 아래 runClaude가 직접 잡는다
  if (fallback) args.push('--fallback-model', fallback);
  let raw: string;
  try {
    raw = execFileSync('claude', args, {
      encoding: 'utf-8',
      maxBuffer: 32 * 1024 * 1024,
      timeout: timeoutMs,
      env: { ...process.env, CLAUDECODE: undefined },
    });
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message?: string };
    // CLI는 실패해도 JSON 봉투를 뱉는다. 사용량 통계가 아니라 사람이 읽을 result만 남긴다
    throw new ClaudeError(model, [resultOf(e.stdout), e.stderr, e.message].filter(Boolean).join('\n'));
  }
  const envelope = JSON.parse(raw) as { result?: string; is_error?: boolean };
  if (envelope.is_error || !envelope.result) throw new ClaudeError(model, envelope.result ?? '(빈 응답)');
  return envelope.result;
}

export function runClaude(prompt: string, model: string, timeoutMs = 15 * 60 * 1000): string {
  const fallback = fallbackOf(model);
  try {
    return callOnce(prompt, model, timeoutMs, fallback);
  } catch (error) {
    if (!fallback || !(error instanceof ClaudeError) || !error.blocked) throw error;
    console.warn(`[WARN] ${model} 사용 불가 → ${fallback}로 대체합니다: ${error.message}`);
    return callOnce(prompt, fallback, timeoutMs);
  }
}
