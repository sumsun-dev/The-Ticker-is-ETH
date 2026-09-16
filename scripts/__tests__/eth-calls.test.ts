import { describe, expect, it } from 'vitest';
import {
  CallDraftSchema,
  applyTranslations,
  buildRecord,
  callInput,
  compressVtt,
  durationMinutes,
  excerptAt,
  laterTargetUpdates,
  mergeBlocks,
  nextCallEstimate,
  parseChat,
  parseVtt,
  plainLength,
  reapplyRoster,
  renderCaption,
  renderDiscussion,
  discussionParagraphs,
  fitCaption,
  renderDiscussionParts,
  resolveSpeaker,
  secToTs,
  speakerShares,
  tsToSec,
  type CallRecord,
} from '../lib/eth-calls';

const VTT = `WEBVTT

1
00:10:15.630 --> 00:10:18.209
nixo: Okay, I think we can get started.

2
00:10:18.470 --> 00:10:26.170
nixo: Welcome to AllCoreDevs.

3
00:11:13.250 --> 00:11:20.420
Barnabas: Yeah, so a very boring update.

4
00:21:53.440 --> 00:21:59.459
Ben Adams: I'd prefer not to set a precedent of changing a contract.

5
00:22:05.000 --> 00:22:09.000
Ben Adams: It opens the door to the idea that we can change contracts.

6
00:30:00.000 --> 00:30:03.000
Ben Adams: Much later remark.
`;

const CHAT = `00:06:18\twolovim:\tWorked too well
00:06:22\tnixo:\tReacted to "Worked too well" with 😂
00:48:29\tDanno Ferrin (shemnon:\tReplying to "it will impact ours ..."

SELFDESTRUCT was deprecated Shanghai https://eips.ethereum.org/EIPS/eip-6049 including a warning not to use it.
00:49:15\tDanno Ferrin (shemnon:\tThis was almost 4 years ago.  We should not be accommodating new uses.
`;

const ROSTER = {
  nixo: { name: 'Nixo', org: 'EF Protocol Support', role: 'ACDE 진행', handle: 'nixorokish' },
  'Ben Adams': { name: 'Ben Adams', org: 'Nethermind', handle: 'ben_a_adams' },
  Barnabas: { name: 'Barnabas Busa', org: 'EF DevOps', handle: 'BarnabasBusa' },
  'Danno Ferrin (shemnon': { name: 'Danno Ferrin', org: 'Sei Labs', handle: 'shemnon' },
};

describe('eth-calls transcript helpers', () => {
  it('should parse cues with speakers, merge consecutive blocks and compute shares', () => {
    const cues = parseVtt(VTT);
    expect(cues).toHaveLength(6);
    expect(cues[0]).toMatchObject({ t: '00:10:15', sec: 615, who: 'nixo' });
    const blocks = mergeBlocks(cues);
    expect(blocks.map((b) => b.who)).toEqual(['nixo', 'Barnabas', 'Ben Adams']);
    expect(blocks[2].cues).toBe(3);
    expect(speakerShares(cues)[0]).toMatchObject({ label: 'Ben Adams', cues: 3 });
    expect(speakerShares(cues).reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
    expect(durationMinutes(cues)).toBe(20);
    expect(compressVtt(VTT)).toContain('[00:21:53] Ben Adams: I\'d prefer not to set a precedent');
  });

  it('should convert timestamps both ways', () => {
    expect(tsToSec('01:37:56')).toBe(5876);
    expect(secToTs(5876)).toBe('01:37:56');
  });

  it('should excerpt a speaker\'s remark near a timestamp and stop at long gaps', () => {
    const blocks = mergeBlocks(parseVtt(VTT));
    // 큐 4·5는 한 블록(같은 사람 연속), 큐 6은 8분 뒤라 이어지지 않는다 — 블록 병합이 먼저 합쳐지므로 excerpt는 블록 단위
    const text = excerptAt(blocks, 'Ben Adams', '00:21:55');
    expect(text).toContain('precedent');
    expect(text).toContain('Much later remark');
    expect(excerptAt(blocks, 'Nobody', '00:21:55')).toBeUndefined();
    expect(excerptAt(blocks, 'Ben Adams', '00:21:55', 30)).toMatch(/…$/);
  });

  it('should parse chat lines, drop reactions and join continuation lines', () => {
    const chat = parseChat(CHAT);
    expect(chat).toHaveLength(2);
    expect(chat[0]).toMatchObject({ timestamp: '00:48:29', speaker: 'Danno Ferrin (shemnon' });
    expect(chat[0].text).toMatch(/^SELFDESTRUCT was deprecated/);
    expect(chat[1].text).toContain('almost 4 years ago');
  });

  it('should resolve speakers by exact label, prefix or name, and read "name | org" labels', () => {
    expect(resolveSpeaker('Ben Adams', ROSTER)?.handle).toBe('ben_a_adams');
    expect(resolveSpeaker('Danno Ferrin (shemnon', ROSTER)?.org).toBe('Sei Labs');
    expect(resolveSpeaker('Ben Adams | Nethermind', ROSTER)?.handle).toBe('ben_a_adams');
    expect(resolveSpeaker('Dima Gusakov | Lido', ROSTER)).toEqual({ name: 'Dima Gusakov', org: 'Lido' });
    expect(resolveSpeaker('Nobody Here', ROSTER)).toBeUndefined();
    // 짧은 키가 다른 이름 앞부분에 걸리지 않는다
    expect(resolveSpeaker('Benjamin Other', ROSTER)).toBeUndefined();
  });

  it('should reapply roster and avatars to an existing record without touching labels or shares', () => {
    const r = record();
    const roster = { ...ROSTER, nixo: { name: 'Nixo Renamed', org: 'EF', handle: 'nixorokish' } };
    const out = reapplyRoster(r, roster, { nixorokish: 'https://pbs.twimg.com/nixo.jpg', ben_a_adams: 'https://pbs.twimg.com/ben2.jpg' });
    const nixo = out.speakers.find((s) => s.label === 'nixo');
    expect(nixo).toMatchObject({ name: 'Nixo Renamed', handle: 'nixorokish', avatar: 'https://pbs.twimg.com/nixo.jpg' });
    expect(out.speakers.find((s) => s.label === 'Ben Adams')?.avatar).toBe('https://pbs.twimg.com/ben2.jpg');
    expect(out.speakers.map((s) => s.share)).toEqual(r.speakers.map((s) => s.share));
  });
});

const DRAFT = CallDraftSchema.parse({
  headline: 'EIP-8141 프레임\n헤고타 포함 확정',
  lead: '계정 추상화의 핵심 제안이 다음 포크에 들어간다',
  intro: '실행 계층(EL) 클라이언트 개발자 격주 콜이다.',
  summary: 'EIP-8141 프레임이 헤고타에 포함 확정(SFI)되면서 계정 추상화가 다음 포크의 중심 과제로 굳었다.',
  whyItMatters: '지갑과 L2가 헤고타의 계정 추상화 방향을 전제로 준비를 시작할 수 있다는 뜻이다.',
  decisions: [
    { n: 1, label: 'EIP-8141 프레임', text: '헤고타 포함 확정. 스펙은 아직 바뀔 수 있다.', status: 'SFI' },
    { n: 9, label: '없는 번호', text: '무시돼야 한다', status: '기타' },
  ],
  targets: [{ n: 1, key: 'sepolia-fork', text: '세폴리아 포크 9월 28일 제안' }],
  actions: [{ n: 1, owner: 'EL 클라이언트 팀', text: '헤고타 선호안 9월 9일까지 제출' }],
  agenda: [
    { n: 1, heading: '데브넷 계획' },
    { n: 2, heading: '예치 계약 PQ 대비' },
  ],
  topics: [
    {
      title: '예치 계약의 포스트 양자 전환',
      intro: '배포된 계약을 손대도 되는지가 처음 논의됐다.',
      agendaN: 2,
      positions: [
        { speaker: 'Ben Adams', text: '선례를 만들면 안 된다며 반대.', timestamp: '00:21:53' },
        { speaker: 'Danno Ferrin', text: '채팅에서 EIP-6049를 들어 반대.', timestamp: '00:48:29', viaChat: true },
      ],
      quote: { text: '계약을 바꾸는 선례를 만들고 싶지 않다.', original: "I'd prefer not to set a precedent of changing a contract.", speaker: 'Ben Adams', timestamp: '00:21:53' },
    },
  ],
  chat: [{ speaker: 'Danno Ferrin (shemnon', text: 'SELFDESTRUCT는 4년 전 폐기 예고됐다', timestamp: '00:48:29' }],
  glossary: [{ term: 'SFI', def: '포함 확정' }],
});

const META = { id: 'acde-244', series: 'acde', number: 244, date: '2026-08-27', title: 'AllCoreDevs - Execution #244', forkcastUrl: 'https://forkcast.org/calls/acde/244/' };

function record(): CallRecord {
  return buildRecord({
    meta: META,
    draft: DRAFT,
    decisions: [{ original_text: 'EIP-8141 (Frames) SFI for Hegota', timestamp: '01:37:56', eips: [8141], fork: 'Hegota', stage_change: { to: 'Scheduled' } }],
    tldr: { targets: [{ timestamp: '00:15:59', target: 'Sepolia fork Sep 28' }], action_items: [{ timestamp: '00:38:35', action: 'prefs', owner: 'EL teams' }], highlights: { x: [{ highlight: 'EIP-8304 demo shown' }] } },
    notes: { sections: [{ heading: 'Devnet', timestamp: '00:10:15' }, { heading: 'Deposit Contract PQ', timestamp: '00:20:23' }, { heading: 'Frames', timestamp: '01:02:06' }] },
    config: { issue: 2197, videoUrl: 'https://youtube.com/watch?v=x' },
    cues: parseVtt(VTT),
    chat: parseChat(CHAT),
    roster: ROSTER,
    avatars: { ben_a_adams: 'https://pbs.twimg.com/ben_400x400.jpg' },
    debates: [
      { id: 'aa-debate', title: '계정 검증 (EIP-8141 vs 8130)', summary: '...', keywords: ['EIP-8141'] },
      { id: 'issuance', title: '발행 소각', summary: 'EIP-8363', keywords: [] },
    ],
  });
}

describe('buildRecord', () => {
  it('should join draft with Forkcast sources by index and drop unknown numbers', () => {
    const r = record();
    expect(r.kind).toBe('full');
    expect(r.decisions).toHaveLength(1);
    expect(r.decisions[0]).toMatchObject({ label: 'EIP-8141 프레임', original: 'EIP-8141 (Frames) SFI for Hegota', eips: [8141], fork: 'Hegota', timestamp: '01:37:56', status: 'SFI' });
    expect(r.targets[0]).toMatchObject({ key: 'sepolia-fork', timestamp: '00:15:59' });
    expect(r.actions[0]).toMatchObject({ owner: 'EL 클라이언트 팀', timestamp: '00:38:35' });
    expect(r.issueUrl).toBe('https://github.com/ethereum/pm/issues/2197');
    expect(r.durationMin).toBe(20);
  });

  it('should flag agenda items with discussion and decision, and collect EIPs and related debates', () => {
    const r = record();
    expect(r.agenda).toEqual([
      { timestamp: '00:10:15', heading: '데브넷 계획' },
      { timestamp: '00:20:23', heading: '예치 계약 PQ 대비', discussion: true },
    ]);
    expect(r.eips).toEqual([8141, 8304]);
    expect(r.relatedDebates).toEqual(['aa-debate']);
  });

  it('should attach transcript excerpts, chat originals, speaker profiles and avatars', () => {
    const r = record();
    const [ben, danno] = r.topics[0].positions;
    expect(ben.original).toContain('precedent');
    expect(danno).toMatchObject({ speaker: 'Danno Ferrin (shemnon', viaChat: true });
    expect(danno.original).toMatch(/^SELFDESTRUCT was deprecated/);
    const speaker = r.speakers.find((s) => s.label === 'Ben Adams');
    expect(speaker).toMatchObject({ name: 'Ben Adams', org: 'Nethermind', handle: 'ben_a_adams', avatar: 'https://pbs.twimg.com/ben_400x400.jpg' });
    expect(r.speakers.find((s) => s.label === 'Danno Ferrin (shemnon')).toMatchObject({ share: 0, org: 'Sei Labs' });
    expect(r.speakers[0].share).toBeGreaterThan(r.speakers[1].share);
  });

  it('should apply translations by position order', () => {
    const r = applyTranslations(record(), [{ topic: 0, position: 0 }], [{ n: 1, text: '선례를 만들고 싶지 않다.' }]);
    expect(r.topics[0].positions[0].translation).toBe('선례를 만들고 싶지 않다.');
    expect(r.topics[0].positions[1].translation).toBeUndefined();
  });
});

describe('schedule helpers', () => {
  it('should link later target updates by key and estimate the next ACD call', () => {
    const a = { id: 'acde-244', series: 'acde', number: 244, date: '2026-08-27', targets: [{ key: 'sepolia-fork', text: '9월 28일 제안' }] };
    const b = { id: 'acdc-186', series: 'acdc', number: 186, date: '2026-09-03', targets: [{ key: 'sepolia-fork', text: '10월 6일 확정' }] };
    expect(laterTargetUpdates(a, [a, b])).toEqual({ 'sepolia-fork': { callId: 'acdc-186', label: 'ACDC #186', text: '10월 6일 확정' } });
    expect(laterTargetUpdates(b, [a, b])).toEqual({});
    expect(nextCallEstimate([a, b], '2026-09-08')).toEqual({ label: 'ACDE #245', date: '2026-09-10' });
    expect(nextCallEstimate([a, b], '2026-09-12')).toEqual({ label: 'ACDC #187', date: '2026-09-17' });
    expect(nextCallEstimate([], '2026-09-08')).toBeUndefined();
  });
});

describe('telegram rendering', () => {
  it('should render caption and discussion from the record with collapsed topics', () => {
    const r = record();
    const caption = renderCaption(r);
    expect(caption).toContain('<b>ACDE #244 · 8월 27일</b>');
    expect(caption).toContain('<i>결정된 것</i>\n· 헤고타 포함 확정');
    expect(caption).not.toContain('용어');
    expect(renderCaption(r, { glossary: true })).toContain('<i>용어</i> SFI: 포함 확정');
    expect(caption).not.toContain('forkcast.org');
    const link = `콜 페이지에서 전체 보기 → https://ethcollective.xyz/calls/${r.id}`;
    expect(renderCaption(r, { link: true }).endsWith(`\n\n${link}`)).toBe(true);
    expect(plainLength(caption)).toBeLessThan(1024);
    const discussion = renderDiscussion(r);
    expect(discussion).toContain('<b><i>예치 계약의 포스트 양자 전환</i></b>');
    expect(discussion).toContain('<blockquote expandable>· <b>Ben Adams</b> (Nethermind): 선례를 만들면 안 된다며 반대.');
    expect(discussion).toContain('<b>Danno Ferrin</b> (Sei Labs): 채팅에서 EIP-6049를 들어 반대. (채팅)');
    expect(discussion).toContain('(Ben Adams, 00:21:53)</blockquote>');
    expect(discussion).toContain('<i>남은 것</i>\n· EL 클라이언트 팀');
    expect(renderDiscussionParts(r)).toEqual([`${discussion}\n\n${link}`]);
    // 상한이 작으면 주제 단위로 나뉜다
    const parts = renderDiscussionParts(r, 200);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join('\n\n')).toBe(`${discussion}\n\n${link}`);
    expect(parts[parts.length - 1].endsWith(link)).toBe(true);
  });

  it('should accept a topic with no agenda item (model sends 0)', () => {
    const base = CallDraftSchema.parse({
      headline: '두 줄\n헤드라인', lead: '한 문장 리드다.', intro: '어떤 콜인지 한 줄이다.',
      summary: '가장 중요한 결정과 그 의미를 담은 한 줄 요약이다.',
      whyItMatters: '사용자와 클라이언트에 무엇이 달라지는지 설명하는 문장이다.',
      decisions: [{ n: 1, label: '결정 이름', text: '무엇이 결정됐는지', status: '확정' }],
      topics: [
        { title: '안건에 걸린 주제', intro: '도입 문장이다.', agendaN: 2, positions: [{ speaker: 'nixo', text: '입장을 밝혔다.' }] },
        { title: '안건 없는 주제', intro: '도입 문장이다.', agendaN: 0, positions: [{ speaker: 'nixo', text: '입장을 밝혔다.' }] },
      ],
    });
    expect(base.topics.map((t) => t.agendaN)).toEqual([2, undefined]);
  });

  it('should number sources for the prompt', () => {
    const input = callInput({ title: META.title, date: META.date, decisions: [{ original_text: 'A' }, { original_text: 'B', fork: 'Hegota' }], tldr: {}, notes: {}, vtt: VTT, chat: [] });
    expect(input).toContain('1. A\n2. B [fork: Hegota]');
    expect(input).toContain('[00:11:13] Barnabas:');
  });
});

describe('AMA 브리프 길이', () => {
  const amaCall = {
    id: 'ama-14',
    series: 'ama',
    number: 14,
    date: '2025-08-29',
    title: 'EF 프로토콜 AMA 14회',
    forkcastUrl: 'https://www.reddit.com/r/ethereum/comments/x/',
    kind: 'full' as const,
    headline: '스테이킹 상한\n50%면 보수적',
    lead: '드레이크, ETH 절반 상한은 낙담 공격 막기에 충분',
    summary: '요약',
    decisions: [],
    targets: [],
    actions: [],
    agenda: [],
    topics: Array.from({ length: 6 }, (_, i) => ({
      title: `주제 ${i + 1}`,
      intro: '가'.repeat(180),
      positions: [
        { speaker: 'Ethereum_AMA', text: '나'.repeat(150) },
        { speaker: 'vbuterin', text: '다'.repeat(180) },
        { speaker: 'barnaabe', text: '라'.repeat(180) },
        { speaker: 'bobthesponge1', text: '마'.repeat(180) },
      ],
    })),
    speakers: [
      { label: 'vbuterin', name: 'vbuterin', share: 1 },
      { label: 'barnaabe', name: 'barnaabe', share: 0.5 },
      { label: 'bobthesponge1', name: 'bobthesponge1', share: 0.5 },
    ],
    chat: [],
    glossary: [],
    eips: [],
    relatedDebates: [],
  };

  it('should carry the lead, the key lines and the site link in a single caption', () => {
    // 오너 2026-09-16: AMA는 메시지 1개. 긴 문단 대신 핵심 한 줄 목록으로 읽히게 한다
    const caption = fitCaption({ ...amaCall, highlights: ['발행량은 현 곡선이면 계속 오른다', '증명 병목은 비용이 아니라 전력이다', 'L1은 1초 파이널리티를 좇지 않는다'] }, 1024, { link: true });
    expect(caption).toContain('<i>핵심</i>');
    expect(caption).toContain('· 발행량은 현 곡선이면 계속 오른다');
    // 핵심 줄 사이에는 빈 줄이 들어간다 (오너 2026-09-16, 가독성)
    expect(caption).toContain('· 발행량은 현 곡선이면 계속 오른다\n\n· 증명 병목은 비용이 아니라 전력이다');
    expect(caption).toContain('AMA 페이지에서 전체 보기 → https://ethcollective.xyz/calls/ama-14');
    // 긴 요약 문단은 캡션에서 뺀다 (사이트에서 본다)
    expect(caption).not.toContain('한 줄 요약');
    expect(caption).not.toContain('왜 중요한가');
    expect(plainLength(caption)).toBeLessThanOrEqual(1024);
  });

  it('should fall back to topic titles when the record has no key lines', () => {
    const caption = fitCaption(amaCall, 1024, { link: true });
    expect(caption).toContain('<i>핵심</i>');
    expect(caption).toContain('· 주제 1');
  });

  it('should drop the relay account lines and cap remarks so one message is enough', () => {
    const paras = discussionParagraphs(amaCall);
    expect(paras.join('\n')).not.toContain('Ethereum_AMA');
    // 주제당 발언 2건까지만
    expect(paras[1].match(/· <b>/g)?.length).toBe(2);
    expect(renderDiscussionParts(amaCall)).toHaveLength(1);
  });
});
