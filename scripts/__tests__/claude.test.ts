import { afterEach, describe, expect, it } from 'vitest';
import { FALLBACK_MODEL, fallbackOf, isBlocked } from '../lib/claude';

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
