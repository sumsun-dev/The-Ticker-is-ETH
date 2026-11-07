import { describe, expect, it } from 'vitest';
import { loadContentsIndex } from '../researchData';

describe('loadContentsIndex', () => {
  it('should show the weekly report author under the same name as their Telegram posts', async () => {
    const items = await loadContentsIndex();
    const authors = new Set(items.map((item) => item.author));

    expect(authors.has('@r2jamong')).toBe(false);
    expect([...authors].filter((a) => a.toLowerCase().includes('jamong'))).toEqual(['Rejamong']);
  });

  it('should keep the avatar for the renamed weekly report author', async () => {
    const items = await loadContentsIndex();
    const reports = items.filter((item) => item.id.startsWith('news-'));

    expect(reports.length).toBeGreaterThan(0);
    expect(reports.every((item) => item.author === 'Rejamong' && item.authorAvatar === '/assets/team/rejamong.jpg')).toBe(true);
  });
});
