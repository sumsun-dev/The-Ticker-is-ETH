import { describe, it, expect, vi } from 'vitest';
import full from '../team-enrichment.json';
import { sliceAvatars } from '../../../vite-json-slice';

// vitest 는 json-slice 플러그인을 거치지 않으므로 빌드 때와 같은 함수로 만들어 넣는다
vi.mock('../team-enrichment.json?avatars', async () => {
  const [{ default: d }, { sliceAvatars: s }] = await Promise.all([
    import('../team-enrichment.json'),
    import('../../../vite-json-slice'),
  ]);
  return { default: s(d as never) };
});

describe('teamAvatars', () => {
  it('should match the home list built from mockData (order, dedupe, avatar)', async () => {
    const { teamAvatars } = await import('../teamAvatars');
    const { mockMembers, mockContributors } = await import('../mockData');
    const core = new Set(mockMembers.map((m) => m.name.toLowerCase()));
    const expected = [...mockMembers, ...mockContributors.filter((c) => !core.has(c.name.toLowerCase()))].map(
      ({ id, name, avatarUrl }) => ({ id, name, avatarUrl }),
    );
    expect(teamAvatars).toEqual(expected);
    expect(teamAvatars.length).toBeGreaterThan(8);
  });

  it('should keep only names in the avatars slice', () => {
    const out = sliceAvatars(full as never);
    expect(out.contributors.every((c) => Object.keys(c).join() === 'name')).toBe(true);
    expect(JSON.stringify(out).length).toBeLessThan(JSON.stringify(full).length / 100);
  });
});
