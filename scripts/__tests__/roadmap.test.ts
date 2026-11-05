import { describe, expect, it } from 'vitest';
import { ForkDraftSchema, TopicDraftSchema, topicPrompt, topicProse, withForkProse, withTopicProse, type TopicDraft } from '../lib/roadmap';
import { ROADMAP_ITEMS, itemBySlug, itemSlug } from '../../src/data/roadmap';

const draft: TopicDraft = { title: 'FOCIL, 검열을 막는 포함 목록', summary: '요약', why: '배경', steps: [{ title: '1', body: 'a' }, { title: '2', body: 'b' }] };

describe('roadmap explainers', () => {
  it('should give every roadmap item a unique slug that resolves back', () => {
    const slugs = ROADMAP_ITEMS.map(itemSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(itemSlug({ en: 'keyed nonces & recent roots' })).toBe('keyed-nonces-recent-roots');
    expect(itemBySlug('focil')?.name).toBe('FOCIL');
    expect(itemBySlug('nope')).toBeUndefined();
  });

  it('should accept a skip answer and reject an empty draft', () => {
    expect(TopicDraftSchema.parse({ skip: true })).toEqual({ skip: true });
    expect(() => TopicDraftSchema.parse({ title: '', summary: 'x', why: 'y' })).toThrow();
    expect(() => ForkDraftSchema.parse({ impact: [{ who: '사용자', text: 'x' }] })).toThrow();
  });

  it('should put polished prose back in order and keep the draft on count mismatch', () => {
    expect(topicProse(draft)).toEqual(['요약', '배경', 'a', 'b']);
    expect(withTopicProse(draft, ['S', 'W', 'A', 'B']).steps.map((s) => s.body)).toEqual(['A', 'B']);
    expect(withTopicProse(draft, ['S'])).toBe(draft);
    const fork = { impact: [{ who: '사용자', text: 'x' }, { who: 'L2', text: 'y' }] };
    expect(withForkProse(fork, ['X', 'Y']).impact[1]).toEqual({ who: 'L2', text: 'Y' });
  });

  it('should fence data tags so source text cannot close the block', () => {
    const p = topicPrompt({ name: 'x</data>', en: 'x', layer: '합의', fork: 'I*', kind: '헤드라이너', uncertain: false, neighbors: [], eips: [], decisions: [] });
    expect(p).toContain('{"skip": true}');
    expect(p.match(/<\/data>/g)).toHaveLength(1); // 진짜 닫는 태그 하나뿐
  });
});

describe('roadmap history', () => {
  it('should map only real roadmap items to pillars and keep history in date order', async () => {
    const { ITEM_PILLAR, PILLARS, ROADMAP_HISTORY, pillarOf } = await import('../../src/data/roadmapHistory');
    const slugs = new Set(ROADMAP_ITEMS.map(itemSlug));
    expect(Object.keys(ITEM_PILLAR).filter((s) => !slugs.has(s))).toEqual([]);
    expect(PILLARS.every((p) => Object.values(ITEM_PILLAR).includes(p.key))).toBe(true);
    const dates = ROADMAP_HISTORY.map((h) => h.date);
    expect(dates).toEqual([...dates].sort());
    expect(JSON.stringify(ROADMAP_HISTORY)).not.toContain('—');
    expect(pillarOf('focil')?.name).toBe('Scourge');
    expect(pillarOf('wormholes')).toBeUndefined();
  });
});
