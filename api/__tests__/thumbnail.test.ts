import { describe, it, expect } from 'vitest';
import { buildPrompt, extractHtml } from '../_lib/thumbnail';

describe('썸네일 HTML', () => {
  it('코드 블록에서 HTML만 꺼내고 스크립트·이벤트·외부 주소를 지운 뒤 심볼을 넣는다', () => {
    const out = extractHtml('설명\n```html\n<html><body onload="x()"><script>alert(1)</script><div style="background:url(https://evil.test/a.png)"><!--ECK_SYMBOL--></div></body></html>\n```');
    expect(out).not.toMatch(/<script|onload|evil\.test/);
    expect(out).toContain('<svg');
    expect(out).toContain('#E45C59');
    expect(out).toMatch(/^<meta http-equiv="Content-Security-Policy" content="default-src 'none'/);
  });

  it('HTML이 아니면 실패한다', () => {
    expect(() => extractHtml('죄송합니다')).toThrow();
  });

  it('프롬프트에 제목·크기·자리표시를 넣는다', () => {
    const p = buildPrompt('글램스테르담 연기', '요약', 1);
    expect(p).toContain('글램스테르담 연기');
    expect(p).toContain('1280x720');
    expect(p).toContain('<!--ECK_SYMBOL-->');
    expect(p).toContain('종이');
  });
});
