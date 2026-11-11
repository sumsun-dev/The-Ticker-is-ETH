import core from './team-core.json';
import enrichment from './team-enrichment.json?avatars';
import { extraContributors } from './extraContributors';

export type TeamAvatar = { id: string; name: string; avatarUrl: string };

// 홈 화면용: 이름·사진만. 활동 기록(0.5MB)이 든 mockData 를 홈에서 받지 않으려고 따로 둔다.
// 순서·중복 제거는 mockMembers → mockContributors 와 같다 (teamAvatars.test.ts 가 맞춰 봄)
const tg = (enrichment as { contributors: { name: string }[] }).contributors
  .filter((c) => !['gen', 'wonjae', 'bosul mun'].includes(c.name.toLowerCase()))
  .map((c) => ({
    id: `tg-${c.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: c.name,
    avatarUrl: `/assets/team/${c.name.toLowerCase()}.jpg`,
  }));

const seen = new Set<string>();
export const teamAvatars: TeamAvatar[] = [...core, ...extraContributors, ...tg]
  .filter((m) => !seen.has(m.name.toLowerCase()) && !!seen.add(m.name.toLowerCase()))
  .map(({ id, name, avatarUrl }) => ({ id, name, avatarUrl }));
