import type { ResearchItem } from '../types/research';
import type { NewsItem } from '../types/news';
import { loadArticleContent } from '../utils/data-loader';

export type ResearchIndexItem = Omit<ResearchItem, 'content'>;

/** 주간 리포트 RSS 는 작성자를 X 계정(@r2jamong)으로 준다. 텔레그램 글과 같은 이름으로 맞춰 필터가 둘로 갈리지 않게 한다 */
const NEWS_AUTHOR_NAMES: Record<string, string> = {
    '@r2jamong': 'Rejamong',
};

const NEWS_AUTHOR_AVATARS: Record<string, string> = {
    Rejamong: '/assets/team/rejamong.jpg',
};

const newsAuthor = (raw: string) => NEWS_AUTHOR_NAMES[raw] ?? raw;

function adaptNewsItems(newsItems: NewsItem[]): ResearchIndexItem[] {
    return newsItems.map(item => ({
        id: `news-${item.id}`,
        title: item.title,
        author: newsAuthor(item.author),
        authorId: newsAuthor(item.author),
        date: item.published.split('T')[0],
        category: 'Weekly Report' as const,
        summary: item.summary,
        thumbnailUrl: '',
        readTime: '15 min',
        authorAvatar: NEWS_AUTHOR_AVATARS[newsAuthor(item.author)] ?? '',
        contentType: 'html' as const,
        originalLink: item.link,
    }));
}

let indexCache: ResearchIndexItem[] | null = null;
let loadingPromise: Promise<ResearchIndexItem[]> | null = null;

export async function loadResearchIndex(): Promise<ResearchIndexItem[]> {
    if (indexCache) return indexCache;
    if (loadingPromise) return loadingPromise;

    loadingPromise = import('./research-index.json').then(({ default: data }) => {
        indexCache = data as ResearchIndexItem[];
        loadingPromise = null;
        return indexCache;
    });

    return loadingPromise;
}

let contentsCache: ResearchIndexItem[] | null = null;
let contentsPromise: Promise<ResearchIndexItem[]> | null = null;

export async function loadContentsIndex(): Promise<ResearchIndexItem[]> {
    if (contentsCache) return contentsCache;
    if (contentsPromise) return contentsPromise;

    contentsPromise = Promise.all([
        import('./research-index.json').then(({ default: data }) => data as ResearchIndexItem[]),
        import('./news-feed.json').then(({ default: data }) => {
            const feed = data as { items: NewsItem[] };
            return adaptNewsItems(feed.items);
        }),
    ]).then(([researchItems, newsItems]) => {
        const merged = [...researchItems, ...newsItems];
        merged.sort((a, b) => b.date.localeCompare(a.date));
        contentsCache = merged;
        contentsPromise = null;
        return contentsCache;
    });

    return contentsPromise;
}

export async function loadResearchContent(id: string): Promise<string | undefined> {
    return loadArticleContent(id);
}
