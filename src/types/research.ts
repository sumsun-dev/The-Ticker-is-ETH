export interface ResearchItem {
    id: string;
    title: string;
    author: string;
    authorId: string;
    date: string;
    category: 'Short' | 'Forwarded' | 'Research' | 'Weekly Report';
    forwardedFrom?: string;
    summary: string;
    content: string;
    thumbnailUrl: string;
    readTime: string;
    authorAvatar: string;
    contentType?: 'markdown' | 'html';
    originalLink?: string;
}
