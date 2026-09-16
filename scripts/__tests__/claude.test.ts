import { afterEach, describe, expect, it } from 'vitest';
import { FALLBACK_MODEL, cliArgs, fallbackOf, isBlocked } from '../lib/claude';

afterEach(() => {
  delete process.env.CLAUDE_FALLBACK_MODEL;
});

describe('headless claude fallback', () => {
  it('should treat limit and capacity failures as retryable, others not', () => {
    // 실제 CLI 문구 (2026-09-10 fable 한도 소진 시)
    expect(isBlocked("You're out of usage credits. Switch to another model, or manage usage credits at claude.ai/settings/usage?from=cc_cli_limit_message, to continue.")).toBe(true);
    expect(isBlocked('Claude AI usage limit reached|1789000000')).toBe(true);
    expect(isBlocked('5-hour limit reached ∙ resets 3pm')).toBe(true);
    expect(isBlocked('API Error: 529 {"type":"overloaded_error"}')).toBe(true);
    expect(isBlocked('Error: model_not_found')).toBe(true);
    // 프롬프트·환경 문제는 모델을 바꿔도 그대로다
    expect(isBlocked('no JSON object in response')).toBe(false);
    expect(isBlocked('spawnSync claude ETIMEDOUT')).toBe(false);
  });

  it('should fall back from fable to opus, and honor the env override', () => {
    expect(FALLBACK_MODEL.fable).toBe('opus');
    expect(fallbackOf('fable')).toBe('opus');
    expect(fallbackOf('sonnet')).toBeUndefined();
    process.env.CLAUDE_FALLBACK_MODEL = 'sonnet';
    expect(fallbackOf('fable')).toBe('sonnet');
    expect(fallbackOf('opus')).toBe('sonnet');
  });
});

describe('프롬프트 전달 방식', () => {
  it('should never put the prompt in a command argument', () => {
    // 인자 하나의 상한이 131,072바이트라 긴 프롬프트는 E2BIG으로 실행이 막힌다 (2026-09-15 다이제스트 실패)
    const args = cliArgs('fable', 'opus');
    expect(args).toEqual(['-p', '--output-format', 'json', '--model', 'fable', '--disallowed-tools', 'Write', 'Edit', 'NotebookEdit', 'Bash', '--fallback-model', 'opus']);
    expect(args.every((a) => a.length < 40)).toBe(true);
  });

  it('should keep the file tools blocked and omit the fallback flag when there is none', () => {
    const args = cliArgs('opus');
    expect(args).toContain('--disallowed-tools');
    expect(args).toContain('Bash');
    expect(args).not.toContain('--fallback-model');
  });
});
