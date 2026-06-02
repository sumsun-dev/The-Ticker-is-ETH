import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import DOMPurify from 'dompurify';
import { loadContentsIndex, loadResearchContent, type ResearchIndexItem } from '../data/researchData';
import { getAvatarFallbackUrl } from '../utils/members';
import EthThumbnail from '../components/shared/EthThumbnail';
import type { NewsFeedData } from '../types/news';
import usePageMeta from '../hooks/usePageMeta';
import JsonLd from '../components/common/JsonLd';
import { articleLd, breadcrumbLd } from '../utils/structuredData';

const ALLOWED_TAGS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'strong', 'em', 'a', 'code', 'pre', 'blockquote',
    'div', 'span', 'img',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'id', 'class'];

const ContentsDetail: React.FC = () => {
    const { t } = useTranslation('contents');
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [content, setContent] = useState<string>('');
    const [htmlContent, setHtmlContent] = useState<string>('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [contentsItems, setContentsItems] = useState<ResearchIndexItem[]>([]);
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    const isNewsItem = id?.startsWith('news-') ?? false;

    useEffect(() => {
        loadContentsIndex().then(setContentsItems);
    }, []);

    const handleDelete = async () => {
        if (!window.confirm(t('detail.deleteConfirm'))) return;

        const password = sessionStorage.getItem('publishKey');
        if (!password) {
            navigate('/admin');
            return;
        }

        setIsDeleting(true);
        setDeleteError('');

        try {
            const res = await fetch('/api/research/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, id }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Delete failed');
            }

            const stored = sessionStorage.getItem('deletedIds');
            const ids = stored ? JSON.parse(stored) as string[] : [];
            ids.push(id!);
            sessionStorage.setItem('deletedIds', JSON.stringify(ids));

            navigate('/contents');
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : t('detail.deleteError'));
        } finally {
            setIsDeleting(false);
        }
    };

    const sessionEntry = useMemo(() => {
        try {
            const stored = sessionStorage.getItem('publishedEntries');
            if (!stored) return undefined;
            const entries = JSON.parse(stored) as Array<Record<string, unknown>>;
            return entries.find(e => e.id === id);
        } catch {
            return undefined;
        }
    }, [id]);

    const post = useMemo(() => {
        const found = contentsItems.find(p => p.id === id);
        if (found) return found;
        const state = location.state as { publishedEntry?: Record<string, unknown> } | null;
        if (state?.publishedEntry && state.publishedEntry.id === id) {
            return state.publishedEntry as unknown as ResearchIndexItem;
        }
        if (sessionEntry) {
            return sessionEntry as unknown as ResearchIndexItem;
        }
        return undefined;
    }, [id, location.state, sessionEntry, contentsItems]);

    usePageMeta({
        title: post?.title ?? 'Contents',
        description: post?.summary,
        image: post?.thumbnailUrl || undefined,
        canonical: id ? `/contents/${id}` : undefined,
        type: 'article',
        publishedTime: post?.date,
        author: post?.author,
        noindex: !post,
    });

    const structuredData = useMemo(
        () =>
            post
                ? [
                      articleLd(post),
                      breadcrumbLd([
                          { name: 'Home', url: '/' },
                          { name: 'Contents', url: '/contents' },
                          { name: post.title, url: `/contents/${post.id}` },
                      ]),
                  ]
                : null,
        [post],
    );

    useEffect(() => {
        if (!id) return;

        if (isNewsItem) {
            const newsId = id.replace('news-', '');
            import('../data/news-feed.json').then(({ default: data }) => {
                const feed = data as NewsFeedData;
                const item = feed.items.find(i => i.id === newsId);
                if (item) {
                    setHtmlContent(DOMPurify.sanitize(item.content, { ALLOWED_TAGS, ALLOWED_ATTR }));
                }
            });
            return;
        }

        const state = location.state as { publishedContent?: string } | null;
        if (state?.publishedContent) {
            setContent(state.publishedContent);
            return;
        }
        if (sessionEntry?._content) {
            setContent(sessionEntry._content as string);
            return;
        }
        loadResearchContent(id).then(c => setContent(c ?? ''));
    }, [id, location.state, sessionEntry, isNewsItem]);

    if (!post) {
        return (
            <div className="min-h-screen flex items-center justify-center text-theme-text">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">{t('detail.notFound')}</h1>
                    <Link to="/contents" className="text-brand-primary hover:underline">{t('detail.backToContents')}</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20 overflow-x-hidden bg-theme-bg">
            {structuredData && <JsonLd data={structuredData} id="contents-detail" />}
            {/* Hero Header */}
            <div className="relative h-[60vh] min-h-[400px] w-full overflow-hidden">
                {post.thumbnailUrl ? (
                    <img
                        src={post.thumbnailUrl}
                        alt={post.title}
                        decoding="async"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <EthThumbnail articleId={post.id} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/40 to-transparent" />

                <div className="absolute inset-0 flex flex-col justify-end">
                    <div className="container mx-auto px-6 pb-12">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-4xl"
                        >
                            <Link
                                to="/contents"
                                className="inline-flex items-center gap-2 text-brand-primary mb-6 hover:text-theme-text transition-colors group"
                            >
                                <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
                                {t('detail.backToContents')}
                            </Link>
                            <div className="flex items-center gap-3 mb-6">
                                <span className="px-3 py-1 rounded-full bg-brand-primary/20 backdrop-blur-md border border-theme-border text-xs font-bold text-brand-primary uppercase">
                                    {post.category}
                                </span>
                                {'forwardedFrom' in post && post.forwardedFrom && (
                                    <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-theme-border text-xs text-theme-text-secondary">
                                        via {post.forwardedFrom === 'Unknown' ? t('forwardedFromUnknown') : post.forwardedFrom}
                                    </span>
                                )}
                                <span className="text-theme-text-muted text-sm">{post.readTime} {t('detail.read')}</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-theme-text mb-8 leading-tight">
                                {post.title}
                            </h1>
                            <div className="flex items-center gap-6 text-theme-text-secondary">
                                <div className="flex items-center gap-2">
                                    <img
                                        src={post.authorAvatar}
                                        alt={post.author}
                                        decoding="async"
                                        width={40}
                                        height={40}
                                        className="w-10 h-10 rounded-full object-cover border-2 border-theme-border"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = getAvatarFallbackUrl(post.author, 40);
                                        }}
                                    />
                                    <span className="font-medium">{post.author}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar size={18} />
                                    <span>{post.date}</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="container mx-auto px-6 mt-12">
                <div className="max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        {isNewsItem ? (
                            <div
                                className="prose-news prose prose-invert prose-brand lg:prose-xl max-w-none"
                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                        ) : (
                            <div className="prose prose-invert prose-brand lg:prose-xl max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
                            </div>
                        )}
                    </motion.div>

                    {/* View Original link for Weekly Report */}
                    {post.originalLink && (
                        <div className="mt-8">
                            <a
                                href={post.originalLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-brand-accent hover:underline"
                            >
                                <ExternalLink size={16} />
                                {t('viewOriginal')}
                            </a>
                        </div>
                    )}

                    {deleteError && (
                        <div className="mt-8 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            {deleteError}
                        </div>
                    )}

                    <div className="mt-8 pt-10 border-t border-theme-border-secondary flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {isAdmin && !isNewsItem && (
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                    {isDeleting ? t('detail.deleting') : t('detail.delete')}
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-theme-text-muted">
                            ID: {post.id}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContentsDetail;
