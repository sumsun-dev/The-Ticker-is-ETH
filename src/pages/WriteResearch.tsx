import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Eye, PenLine, Loader2, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { mockMembers, mockContributors } from '../data/mockData';
import BlockNoteEditor from '../components/editor/BlockNoteEditor';

interface AuthorOption {
    name: string;
    avatarUrl: string;
}

const WriteResearch: React.FC = () => {
    const navigate = useNavigate();
    const [previewMode, setPreviewMode] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishError, setPublishError] = useState('');
    const { t } = useTranslation('contents');
    React.useEffect(() => {
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        if (!isAdmin) {
            navigate('/contents');
        }
    }, [navigate]);

    const authors = useMemo<AuthorOption[]>(() => {
        const seen = new Set<string>();
        const result: AuthorOption[] = [];
        const allPeople = [...mockMembers, ...mockContributors];
        for (const person of allPeople) {
            const key = person.name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            result.push({ name: person.name, avatarUrl: person.avatarUrl });
        }
        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, []);

    const [selectedAuthor, setSelectedAuthor] = useState<AuthorOption>(
        () => authors[0] ?? { name: '', avatarUrl: '' },
    );

    const [formData, setFormData] = useState({
        title: '',
        category: 'Research',
        summary: '',
        content: '',
        thumbnailUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=2832',
    });

    const handleContentChange = useCallback((content: string) => {
        setFormData((prev) => ({ ...prev, content }));
    }, []);

    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isPublishing) return;

        const password = sessionStorage.getItem('publishKey');
        if (!password) {
            setPublishError('Session expired. Please re-authenticate.');
            setTimeout(() => navigate('/admin'), 2000);
            return;
        }

        setIsPublishing(true);
        setPublishError('');

        try {
            const res = await fetch('/api/research/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password,
                    title: formData.title,
                    author: selectedAuthor.name,
                    authorAvatar: selectedAuthor.avatarUrl,
                    category: formData.category,
                    summary: formData.summary,
                    content: formData.content,
                    thumbnailUrl: formData.thumbnailUrl,
                }),
            });

            if (!res.ok) {
                const data = await res.json() as { error?: string; detail?: string; hint?: string };
                const baseMsg = data.error || 'Publish failed';
                const parts = [baseMsg];
                if (data.detail) parts.push(data.detail);
                if (data.hint) parts.push(`Hint: ${data.hint}`);
                throw new Error(parts.join(' — '));
            }

            const publishedEntry = await res.json() as Record<string, unknown>;

            const stored = sessionStorage.getItem('publishedEntries');
            const entries = stored ? JSON.parse(stored) as unknown[] : [];
            entries.push({ ...publishedEntry, _content: formData.content });
            sessionStorage.setItem('publishedEntries', JSON.stringify(entries));

            navigate(`/contents/${publishedEntry.id}`, {
                state: { publishedEntry, publishedContent: formData.content },
            });
        } catch (err) {
            setPublishError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="min-h-screen bg-theme-bg pt-28 pb-20 px-6 overflow-x-hidden text-theme-text">
            <div className="container mx-auto max-w-5xl">
                <div className="flex items-center justify-between mb-12">
                    <Link
                        to="/contents"
                        className="flex items-center gap-2 text-theme-text-secondary hover:text-theme-text transition-colors group"
                    >
                        <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
                        {t('write.backToContents')}
                    </Link>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setPreviewMode(!previewMode)}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all border ${previewMode
                                ? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
                                : 'bg-white/5 border-theme-border text-theme-text-secondary hover:text-theme-text'
                                }`}
                        >
                            {previewMode ? <PenLine size={18} /> : <Eye size={18} />}
                            {previewMode ? t('write.editMode') : t('write.preview')}
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={isPublishing}
                            className={`flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/80 text-theme-text px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-brand-primary/20 ${isPublishing ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isPublishing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            {isPublishing ? 'Publishing...' : t('write.publish')}
                        </button>
                    </div>
                </div>

                {publishError && (
                    <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {publishError}
                    </div>
                )}

                {!previewMode ? (
                    <motion.form
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                        onSubmit={handlePublish}
                    >
                        <div className="space-y-4">
                            <label className="text-sm font-semibold text-theme-text-muted uppercase tracking-widest pl-1">{t('write.titleLabel')}</label>
                            <input
                                type="text"
                                placeholder={t('write.titlePlaceholder')}
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full bg-white/5 border border-theme-border rounded-2xl p-6 text-2xl font-bold focus:outline-none focus:border-brand-accent/50 focus:bg-white/10 transition-all placeholder:text-gray-700"
                                required
                            />
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            <div className="space-y-4">
                                <label className="text-sm font-semibold text-theme-text-muted uppercase tracking-widest pl-1">{t('write.categoryLabel')}</label>
                                <div className="w-full bg-white/5 border border-theme-border rounded-2xl p-4 text-theme-text">
                                    Research
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-sm font-semibold text-theme-text-muted uppercase tracking-widest pl-1">{t('write.authorLabel')}</label>
                                <div className="relative">
                                    <select
                                        value={selectedAuthor.name}
                                        onChange={(e) => {
                                            const found = authors.find(a => a.name === e.target.value);
                                            if (found) setSelectedAuthor(found);
                                        }}
                                        className="w-full bg-white/5 border border-theme-border rounded-2xl p-4 text-theme-text appearance-none cursor-pointer focus:outline-none focus:border-brand-accent/50 transition-all"
                                    >
                                        {authors.map(a => (
                                            <option key={a.name} value={a.name} className="bg-theme-bg">{a.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-text-secondary pointer-events-none" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-sm font-semibold text-theme-text-muted uppercase tracking-widest pl-1">{t('write.thumbnailLabel')}</label>
                                <input
                                    type="text"
                                    value={formData.thumbnailUrl}
                                    onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                                    className="w-full bg-white/5 border border-theme-border rounded-2xl p-4 text-theme-text font-light focus:outline-none focus:border-brand-accent/50 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-semibold text-theme-text-muted uppercase tracking-widest pl-1">{t('write.summaryLabel')}</label>
                            <textarea
                                placeholder={t('write.summaryPlaceholder')}
                                value={formData.summary}
                                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                                className="w-full bg-white/5 border border-theme-border rounded-2xl p-4 min-h-[100px] text-theme-text-secondary font-light focus:outline-none focus:border-brand-accent/50 transition-all"
                                required
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-semibold text-theme-text-muted uppercase tracking-widest pl-1">{t('write.contentLabel')}</label>
                            <div className="bg-white/5 border border-theme-border rounded-2xl p-4 focus-within:border-brand-accent/50 transition-all">
                                <BlockNoteEditor
                                    initialMarkdown={formData.content}
                                    onChange={handleContentChange}
                                />
                            </div>
                        </div>
                    </motion.form>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white/[0.02] border border-theme-border-secondary rounded-[3rem] p-12 md:p-20"
                    >
                        <div className="max-w-3xl mx-auto">
                            <div className="mb-12">
                                <span className="px-3 py-1 rounded-full bg-brand-primary/20 text-xs font-bold text-brand-primary uppercase">
                                    {formData.category}
                                </span>
                                <h1 className="text-4xl md:text-5xl font-bold text-theme-text mt-6 mb-4">{formData.title || 'No Title'}</h1>
                                <p className="text-sm text-theme-text-secondary mt-2">by {selectedAuthor.name}</p>
                                <p className="text-xl text-theme-text-secondary font-light italic mt-4">{formData.summary || 'No Summary'}</p>
                            </div>
                            <div className="prose prose-invert prose-brand lg:prose-xl max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{formData.content || '_No content yet. Start writing..._'}</ReactMarkdown>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default WriteResearch;
