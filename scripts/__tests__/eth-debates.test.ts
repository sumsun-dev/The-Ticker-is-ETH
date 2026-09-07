import { describe, it, expect } from 'vitest';
import {
  computeStatus,
  mergeDebates,
  applyProfiles,
  parseThreadReplies,
  personLines,
  pickNotableReplies,
  tweetIdOf,
  avatarLarge,
  extractJson,
  handleMatchesName,
  DraftEnvelopeSchema,
  type Debate,
  type DebateDraft,
} from '../lib/eth-debates';

const draft = (over: Partial<DebateDraft> = {}): DebateDraft => ({
  id: 'robinhood-chain-eth-accrual',
  title: '로빈후드체인의 성공은 ETH에 호재인가',
  category: '토큰화 · 기관',
  summary: '수익이 ETH로 환류되는지를 두고 갈렸다.',
  keyPoints: ['수익이 ETH 수요로 돌아오는가'],
  positions: [
    { stance: 'pro', label: '호재다', holders: [{ handle: 'ryanberckmans', name: '⟠' }], points: ['ETH 수요를 만들었다'] },
    { stance: 'con', label: '거의 없다', holders: [{ name: '저스틴 본스', watchlist: false }], points: ['0.007%만 돌아온다'] },
  ],
  timeline: [
    { date: '2026-09-02', by: 'ryanberckmans', stance: 'pro', quote: '답은 단호한 예스', url: 'https://x.com/ryanberckmans/status/1', digest: '2026-09-02' },
  ],
  ...over,
});

describe('computeStatus', () => {
  it('should move active → cooling after 7 idle days → archived after 30', () => {
    expect(computeStatus('2026-09-01', '2026-09-06')).toBe('active');
    expect(computeStatus('2026-09-01', '2026-09-08')).toBe('cooling');
    expect(computeStatus('2026-09-01', '2026-10-01')).toBe('archived');
  });
  it('should keep resolved regardless of activity', () => {
    expect(computeStatus('2026-09-06', '2026-09-06', 'resolved')).toBe('resolved');
  });
});

describe('mergeDebates', () => {
  it('should create a new record with firstSeen/lastActivity from the timeline', () => {
    const [d] = mergeDebates([], [draft()], '2026-09-06');
    expect(d.firstSeen).toBe('2026-09-02');
    expect(d.lastActivity).toBe('2026-09-02');
    expect(d.status).toBe('active');
  });

  it('should append timeline, union holders and keep title/category on an existing id', () => {
    const existing = mergeDebates([], [draft()], '2026-09-02');
    const update = draft({
      title: '초안이 바꾸려는 제목',
      category: '규제',
      summary: '갱신된 요약',
      positions: [
        { stance: 'pro', label: '호재다', holders: [{ handle: 'binji_x', name: 'binji' }, { handle: 'RyanBerckmans', name: '⟠' }], points: ['새 논거'] },
        { stance: 'con', label: '거의 없다', holders: [{ name: '저스틴 본스', watchlist: false }], points: ['0.007%만 돌아온다'] },
      ],
      timeline: [
        { date: '2026-09-02', by: 'ryanberckmans', quote: '중복', url: 'https://x.com/ryanberckmans/status/1' },
        { date: '2026-09-05', by: 'ryanberckmans', quote: '정렬 게임은 그만하자', url: 'https://x.com/ryanberckmans/status/2', digest: '2026-09-05' },
      ],
    });
    const [d] = mergeDebates(existing, [update], '2026-09-06');
    expect(d.title).toBe('로빈후드체인의 성공은 ETH에 호재인가');
    expect(d.category).toBe('토큰화 · 기관');
    expect(d.summary).toBe('갱신된 요약');
    expect(d.timeline.map((t) => t.url)).toEqual(['https://x.com/ryanberckmans/status/1', 'https://x.com/ryanberckmans/status/2']);
    expect(d.lastActivity).toBe('2026-09-05');
    // 핸들 대소문자만 다른 인물은 같은 인물, 새 인물은 추가
    expect(d.positions[0].holders.map((h) => h.handle)).toEqual(['ryanberckmans', 'binji_x']);
    expect(d.positions[0].points).toEqual(['새 논거']);
  });

  it('should drop duplicate urls inside a single draft', () => {
    const dup = draft({ timeline: [...draft().timeline, { ...draft().timeline[0], quote: '같은 트윗 다른 요약' }] });
    const [d] = mergeDebates([], [dup], '2026-09-06');
    expect(d.timeline).toHaveLength(1);
  });

  it('should sort by lastActivity desc and recompute status for untouched records', () => {
    const old: Debate = { ...draft({ id: 'old-one' }), status: 'active', firstSeen: '2026-08-01', lastActivity: '2026-08-01' };
    const result = mergeDebates([old], [draft()], '2026-09-06');
    expect(result.map((d) => d.id)).toEqual(['robinhood-chain-eth-accrual', 'old-one']);
    expect(result[1].status).toBe('archived');
  });
});

describe('applyProfiles', () => {
  it('should fill name and avatar by handle, case-insensitively, and leave others alone', () => {
    const [d] = mergeDebates([], [draft()], '2026-09-06');
    const [filled] = applyProfiles([d], { ryanberckmans: { handle: 'ryanberckmans', name: '⟠', avatar: 'https://pbs.twimg.com/a_400x400.jpg' } });
    expect(filled.positions[0].holders[0].avatar).toBe('https://pbs.twimg.com/a_400x400.jpg');
    expect(filled.positions[1].holders[0]).toEqual({ name: '저스틴 본스', watchlist: false });
  });
});

describe('parseThreadReplies / pickNotableReplies', () => {
  const payload = {
    timeline: [
      { tweet_id: '11', screen_name: 'bigacct', text: '@ryanberckmans Robinhood pays onchain users and creates new ETH holders, that is real accrual.', created_at: 'Fri Sep 05 10:00:00 +0000 2026', user_info: { name: 'Big', followers_count: 50000, avatar: 'https://pbs.twimg.com/p_normal.jpg' } },
      { tweet_id: '12', screen_name: 'tiny', text: '@ryanberckmans 💯', created_at: 'Fri Sep 05 10:01:00 +0000 2026', user_info: { name: 'Tiny', followers_count: 10 } },
      { tweet_id: '13', screen_name: 'donnoh_eth', text: '@ryanberckmans the fee share is tiny though, most value stays on the L2 sequencer side.', created_at: 'Fri Sep 05 10:02:00 +0000 2026', user_info: { name: 'donnoh', followers_count: 900 } },
    ],
  };
  it('should drop mention-only replies and normalize fields', () => {
    const replies = parseThreadReplies(payload);
    expect(replies.map((r) => r.id)).toEqual(['11', '13']);
    expect(replies[0].avatar).toBe('https://pbs.twimg.com/p_400x400.jpg');
    expect(replies[0].url).toBe('https://x.com/bigacct/status/11');
    expect(replies[0].date).toBe('2026-09-05T10:00:00.000Z');
  });
  it('should keep watchlist handles even with few followers, and rank by followers', () => {
    const picked = pickNotableReplies(parseThreadReplies(payload), new Set(['donnoh_eth']), { minFollowers: 2000 });
    expect(picked.map((r) => r.handle)).toEqual(['bigacct', 'donnoh_eth']);
  });
});

describe('personLines', () => {
  it('should combine watchlist notes with profile bio and skip unknown people', () => {
    const lines = personLines(['@gakonst', 'Justin_Bons', 'nobody', 'GAKONST'], new Map([['gakonst', { name: 'Georgios', why: '프로토콜 — Paradigm CTO' }]]), {
      justin_bons: { handle: 'Justin_Bons', name: 'Justin Bons', followers: 120000, bio: 'Founder & CIO of Cyber Capital.\nBitcoin critic' },
    });
    expect(lines).toEqual([
      '- @gakonst: 워치리스트: Georgios, 프로토콜 — Paradigm CTO',
      '- @Justin_Bons: 팔로워 120000 · 바이오: Founder & CIO of Cyber Capital. Bitcoin critic',
    ]);
  });
  it('should fill a missing role from a newer draft when merging', () => {
    const existing = mergeDebates([], [draft()], '2026-09-02');
    const update = draft({ positions: [{ ...draft().positions[0], holders: [{ handle: 'ryanberckmans', name: '⟠', role: '인플루언서·투자자' }] }, draft().positions[1]] });
    const [d] = mergeDebates(existing, [update], '2026-09-06');
    expect(d.positions[0].holders[0].role).toBe('인플루언서·투자자');
  });
});

describe('helpers', () => {
  it('should extract tweet ids and enlarge avatars', () => {
    expect(tweetIdOf('https://x.com/ryanberckmans/status/2095869276892606792')).toBe('2095869276892606792');
    expect(tweetIdOf('https://ethresear.ch/t/x')).toBeUndefined();
    expect(avatarLarge('https://pbs.twimg.com/profile_images/1/a_normal.jpg')).toBe('https://pbs.twimg.com/profile_images/1/a_400x400.jpg');
  });
  it('should accept a guessed handle only when the profile name or handle carries the holder name', () => {
    expect(handleMatchesName('Justin Bons', 'Justin Bons', 'Justin_Bons')).toBe(true);
    expect(handleMatchesName('tayvano', 'Taylor Monahan', 'tayvano_')).toBe(true);
    expect(handleMatchesName('Kain Warwick', undefined, 'kaiynne')).toBe(false);
    expect(handleMatchesName('Adam Aron', 'Someone Else', 'CEOAdam')).toBe(false);
  });
  it('should accept neutral stance, background and sources, and keep them across merges', () => {
    const rich = draft({
      background: '8130은 Base가 제안한 계정 추상화다.',
      whyItMatters: 'L1과 L2의 AA 표준이 갈릴 수 있다.',
      sources: [{ title: 'EIP-8130', url: 'https://eips.ethereum.org/EIPS/eip-8130' }],
      positions: [...draft().positions, { stance: 'neutral', label: '둘 다 일리 있다', holders: [{ name: '중립자' }], points: ['절충안'] }],
    });
    expect(DraftEnvelopeSchema.parse({ debates: [rich] }).debates[0].positions[2].stance).toBe('neutral');
    const existing = mergeDebates([], [rich], '2026-09-06');
    const [d] = mergeDebates(existing, [draft()], '2026-09-06');
    expect(d.background).toBe('8130은 Base가 제안한 계정 추상화다.');
    expect(d.sources).toHaveLength(1);
    expect(d.positions.map((p) => p.stance)).toEqual(['pro', 'con', 'neutral']);
  });
  it('should keep reply relations when the same url arrives again without them', () => {
    const withRel = draft({ timeline: [{ ...draft().timeline[0], replyTo: 'Justin_Bons', relation: 'reply' }] });
    const existing = mergeDebates([], [withRel], '2026-09-02');
    const [d] = mergeDebates(existing, [draft()], '2026-09-06');
    expect(d.timeline[0].replyTo).toBe('Justin_Bons');
    expect(d.timeline[0].relation).toBe('reply');
  });
  it('should parse fenced JSON and validate the envelope', () => {
    const parsed = extractJson('```json\n{"debates": []}\n```');
    expect(DraftEnvelopeSchema.parse(parsed)).toEqual({ debates: [] });
    expect(() => DraftEnvelopeSchema.parse({ debates: [{ ...draft(), id: 'Bad Slug' }] })).toThrow();
  });
});
