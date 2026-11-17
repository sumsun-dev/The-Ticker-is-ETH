import { describe, expect, it } from 'vitest';
import { factcheckDigest, mechanicalIssues, type CheckDigest } from '../lib/digest-factcheck';

const URL = 'https://x.com/wolovim/status/2121272123637330397';
const inbox = [
  { url: URL, author: 'wolovim', summary: 'We should fund client diversity.' },
  { url: 'https://x.com/barnabemonnot/status/1', author: 'barnabemonnot', summary: 'Other tweet' },
  { url: 'https://example.com/a', author: 'blog', summary: '' },
];
const byUrl = new Map(inbox.map((i) => [i.url, i]));
const item = (o: Partial<CheckDigest['sections'][0]['items'][0]> = {}) => ({
  title: '클라이언트 다양성',
  summary: 'wolovim, 클라이언트 다양성 지원을 주장',
  why: '의미',
  url: URL,
  source: 'X',
  date: '2026-11-16',
  ...o,
});
const dig = (items = [item()], extra: CheckDigest['sections'] = []): CheckDigest => ({
  intro: '인트로',
  sections: [{ heading: 'A', items }, ...extra],
});

describe('mechanicalIssues', () => {
  it('11-16 사례: wolovim 트윗이 barnabemonnot 발언으로 시작하면 걸린다', () => {
    const d = dig([item({ summary: 'barnabemonnot, 이더리움 재단에 요청' })]);
    const r = [...mechanicalIssues(d, byUrl, new Map([[URL, 'rejoined the EF']])).values()];
    expect(r).toHaveLength(1);
    expect(r[0]).toContain('@wolovim');
  });
  it('lead 핸들이 원문에 나오면 통과, 원문이 없으면 검사 안 함', () => {
    const d = dig([item({ summary: 'barnabemonnot, 이더리움 재단에 요청' })]);
    expect(mechanicalIssues(d, byUrl, new Map([[URL, 'cc @barnabemonnot please']])).size).toBe(0);
    expect(mechanicalIssues(d, byUrl, new Map([[URL, 'rejoined the EF']])).size).toBe(1);
    expect(mechanicalIssues(d, byUrl, new Map()).size).toBe(0);
  });
  it('같은 status id 의 옛 사본(author 틀림)이 있어도 url 이 정확히 같은 항목만 근거로 쓴다', () => {
    const ID = '2121272123637330397';
    const m = new Map([
      [`https://x.com/barnabemonnot/status/${ID}`, { author: 'barnabemonnot' }],
      [`https://x.com/wolovim/status/${ID}`, { author: 'wolovim' }],
    ]);
    expect(mechanicalIssues(dig([item({ url: `https://x.com/wolovim/status/${ID}` })]), m).size).toBe(0);
    // url 이 인박스에 정확히 없으면 id 가 같은 옛 사본으로 author 를 비교하지 않는다
    const onlyOld = new Map([[`https://x.com/barnabemonnot/status/${ID}`, { author: 'barnabemonnot' }]]);
    expect(mechanicalIssues(dig([item({ url: `https://x.com/wolovim/status/${ID}` })]), onlyOld).size).toBe(0);
  });
  it('정상 항목은 안 걸린다', () => {
    expect(mechanicalIssues(dig(), byUrl).size).toBe(0);
  });
  it('url 계정과 인박스 author 가 다르면 걸린다', () => {
    const m = new Map([[URL, { author: 'someoneelse' }]]);
    expect(mechanicalIssues(dig(), m).size).toBe(1);
  });
});

describe('factcheckDigest', () => {
  const okAll = JSON.stringify([{ n: 1, ok: true }]);
  const fixed = JSON.stringify([{ n: 1, title: '고친 제목', summary: 'wolovim 이 지원 주장', why: '의미' }]);

  it('문제 없으면 그대로, report 비어 있음', () => {
    const d = dig();
    const r = factcheckDigest(d, inbox, () => okAll);
    expect(r.digest).toBe(d);
    expect(r.report).toEqual([]);
  });

  it('판정 실패 → 고침 → 재판정 통과면 반영하고 "고침" 보고', () => {
    const answers = [
      JSON.stringify([{ n: 1, ok: false, problem: '입장 뒤집힘' }]),
      fixed,
      okAll,
      JSON.stringify({ intro: '새 인트로' }),
    ];
    const r = factcheckDigest(dig(), inbox, () => answers.shift() as string);
    expect(r.digest.sections[0].items[0].title).toBe('고친 제목');
    expect(r.digest.intro).toBe('새 인트로');
    expect(r.report[0]).toBe('고침: 클라이언트 다양성 — 입장 뒤집힘');
  });

  it('재판정도 실패하면 항목과 빈 섹션을 뺀다', () => {
    const bad = JSON.stringify([{ n: 1, ok: false, problem: '여전히 틀림' }]);
    const answers = [bad, fixed, bad, JSON.stringify({ intro: '인트로' })];
    const keep = item({ title: '남는 항목', url: 'https://example.com/a' });
    const r = factcheckDigest(dig([item()], [{ heading: 'B', items: [keep] }]), inbox, () => answers.shift() as string);
    expect(r.digest.sections.map((s) => s.heading)).toEqual(['B']);
    expect(r.report[0]).toContain('뺌: 클라이언트 다양성');
  });

  it('기계 대조에서 걸리면 판정이 ok 여도 고침 대상이고 문제에 링크 글쓴이가 들어간다', () => {
    const prompts: string[] = [];
    const answers = [okAll, fixed, okAll, JSON.stringify({ intro: '인트로' })];
    const d = dig([item({ summary: 'barnabemonnot, 이더리움 재단에 요청' })]);
    const r = factcheckDigest(d, inbox, (p) => (prompts.push(p), answers.shift() as string));
    expect(prompts[1]).toContain('링크 글쓴이는 @wolovim');
    expect(r.report[0]).toMatch(/^고침: .*링크 글쓴이는 @wolovim/);
  });

  it('이상한 응답이면 원본 유지 + "검사 실패"', () => {
    const d = dig();
    const r = factcheckDigest(d, inbox, () => '모르겠습니다');
    expect(r.digest).toBe(d);
    expect(r.report).toHaveLength(1);
    expect(r.report[0]).toMatch(/^검사 실패: /);
  });

  it('ask 가 예외를 던져도 원본 유지', () => {
    const d = dig();
    const r = factcheckDigest(d, inbox, () => {
      throw new Error('boom');
    });
    expect(r.digest).toBe(d);
    expect(r.report[0]).toBe('검사 실패: boom');
  });

  it('원문 없는 항목은 판정 보류(모델 호출 없음)', () => {
    let calls = 0;
    const d = dig([item({ url: 'https://example.com/a', summary: '아무 말' })]);
    const r = factcheckDigest(d, inbox, () => (calls++, '[]'));
    expect(calls).toBe(0);
    expect(r.report).toEqual([]);
  });

  it('앞머리 계정 문제를 고쳤다며 그 핸들을 남기면 뺀다', () => {
    const leftover = JSON.stringify([{ n: 1, title: '복귀', summary: 'wolovim, barnabemonnot의 복귀를 전함', why: '의미' }]);
    const answers = [okAll, leftover, okAll, JSON.stringify({ intro: '인트로' })];
    const d = dig([item({ summary: 'barnabemonnot, 이더리움 재단에 복귀한다' })]);
    const r = factcheckDigest(d, inbox, () => answers.shift() as string);
    expect(r.digest.sections).toHaveLength(0);
    expect(r.report[0]).toContain('뺌: ');
  });

  it('같은 conversationId 의 다른 글이 judge 프롬프트 원문에 붙는다', () => {
    const conv = [
      { url: URL, author: 'wolovim', summary: 'MAIN TWEET', conversationId: 'c1' },
      { url: 'https://x.com/other/status/9', author: 'other', summary: 'REPLY TEXT', conversationId: 'c1' },
      { url: 'https://x.com/zzz/status/8', author: 'zzz', summary: 'UNRELATED', conversationId: 'c2' },
    ];
    const prompts: string[] = [];
    factcheckDigest(dig(), conv, (p) => (prompts.push(p), okAll));
    expect(prompts[0]).toContain('MAIN TWEET');
    expect(prompts[0]).toContain('@other: REPLY TEXT');
    expect(prompts[0].indexOf('MAIN TWEET')).toBeLessThan(prompts[0].indexOf('REPLY TEXT'));
    expect(prompts[0]).not.toContain('UNRELATED');
  });
});
