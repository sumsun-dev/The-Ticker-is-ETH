/**
 * 관리자 콘텐츠 작성. 발행하면 /api/research/publish가 글(md)과 인덱스를 GitHub main에 커밋하고,
 * 서버가 10분마다 main을 배포하므로 사이트에는 그 뒤에 보인다.
 */
import React, { useCallback, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle2, Eye, ImagePlus, Loader2, PenLine, Send, Sparkles } from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';
import { mockContributors, mockMembers } from '../data/mockData';
import BlockNoteEditor from '../components/editor/BlockNoteEditor';
import AdminShell, { AdminLogin } from '../components/admin/AdminShell';
import { prepareThumbnail, type PreparedImage } from '../utils/thumbnailImage';

interface Author {
    name: string;
    avatarUrl: string;
}

const field = 'w-full rounded-md border border-theme-border bg-theme-bg px-3 py-2 text-sm text-theme-text focus:border-zinc-400 focus:outline-none';
const Label: React.FC<{ htmlFor: string; children: React.ReactNode; hint?: string }> = ({ htmlFor, children, hint }) => (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-theme-text">
        {children}
        {hint && <span className="font-normal text-theme-text-muted">{hint}</span>}
    </label>
);

/** 기본 썸네일: ECK 로고 색 4종과 사이트 대표 이미지 */
const PRESETS = [
    { url: '/assets/thumbs/eck-navy.png', label: '남색' },
    { url: '/assets/thumbs/eck-blue.png', label: '파랑' },
    { url: '/assets/thumbs/eck-red.png', label: '빨강' },
    { url: '/assets/thumbs/eck-paper.png', label: '밝은 배경' },
    { url: '/assets/eck-og.png', label: '사이트 대표' },
];

type Thumb = { kind: 'preset'; url: string } | { kind: 'upload'; image: PreparedImage; name: string };
const thumbSrc = (t: Thumb) => (t.kind === 'preset' ? t.url : t.image.dataUrl);

/** 서버에서 Claude가 HTML로 그리고 헤드리스 Chrome이 찍은 PNG를 받아 다른 업로드와 똑같이 줄인다 */
async function generateThumbnail(title: string, summary: string, variant: number): Promise<PreparedImage> {
    const res = await fetch('/api/research/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: sessionStorage.getItem('publishKey'), title, summary, variant }),
    });
    const body = (await res.json().catch(() => ({}))) as { type?: string; data?: string; error?: string };
    if (!res.ok || !body.data) throw new Error(body.error ?? `썸네일 생성 실패 (${res.status})`);
    const bytes = Uint8Array.from(atob(body.data), (c) => c.charCodeAt(0));
    return prepareThumbnail(new Blob([bytes], { type: body.type ?? 'image/png' }));
}

const ThumbnailPicker: React.FC<{ value: Thumb; onChange: (t: Thumb) => void; title: string; summary: string }> = ({ value, onChange, title, summary }) => {
    const [busy, setBusy] = useState(false);
    const [making, setMaking] = useState(false);
    const [tries, setTries] = useState(0);
    const [error, setError] = useState('');
    const make = async () => {
        setError('');
        setMaking(true);
        try {
            onChange({ kind: 'upload', image: await generateThumbnail(title.trim(), summary.trim(), tries), name: `Claude 시안 ${tries + 1}` });
            setTries((t) => t + 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : '썸네일을 만들지 못했습니다');
        } finally {
            setMaking(false);
        }
    };
    const upload = async (file: File | undefined) => {
        if (!file) return;
        setError('');
        if (!file.type.startsWith('image/')) return setError('이미지 파일만 올릴 수 있습니다');
        setBusy(true);
        try {
            onChange({ kind: 'upload', image: await prepareThumbnail(file), name: file.name });
        } catch (err) {
            setError(err instanceof Error ? err.message : '이미지를 읽지 못했습니다');
        } finally {
            setBusy(false);
        }
    };
    return (
        <div>
            <span className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-theme-text">
                썸네일
                <span className="font-normal text-theme-text-muted">16:9로 맞춰 잘립니다</span>
            </span>
            <img src={thumbSrc(value)} alt="선택한 썸네일" className="aspect-video w-full rounded-md border border-theme-border object-cover" />
            <div className="mt-2 grid grid-cols-5 gap-1.5" role="group" aria-label="기본 썸네일">
                {PRESETS.map((p) => {
                    const on = value.kind === 'preset' && value.url === p.url;
                    return (
                        <button
                            key={p.url}
                            type="button"
                            aria-pressed={on}
                            title={p.label}
                            onClick={() => onChange({ kind: 'preset', url: p.url })}
                            className={`overflow-hidden rounded border-2 ${on ? 'border-[#E45C59]' : 'border-transparent hover:border-theme-border'}`}
                        >
                            <img src={p.url} alt={p.label} className="aspect-video w-full object-cover" />
                        </button>
                    );
                })}
            </div>
            <label
                className={`mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-[13px] ${value.kind === 'upload' ? 'border-[#E45C59] text-theme-text' : 'border-theme-border text-theme-text-secondary hover:text-theme-text'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    void upload(e.dataTransfer.files[0]);
                }}
            >
                {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={14} aria-hidden="true" />}
                {value.kind === 'upload' ? `사용 중: ${value.name}` : '이미지 파일 올리기 (끌어다 놓아도 됨)'}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
            <button
                type="button"
                onClick={make}
                disabled={making || !title.trim()}
                title={title.trim() ? undefined : '제목을 먼저 쓰세요'}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-theme-border px-3 py-2 text-[13px] text-theme-text-secondary hover:text-theme-text disabled:opacity-50"
            >
                {making ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                {making ? 'Claude가 만드는 중 (20초쯤)' : tries ? '다른 시안 만들기' : '제목으로 Claude가 만들기'}
            </button>
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </div>
    );
};

async function verify(password: string) {
    const res = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (res.status === 401) throw new Error('비밀번호가 맞지 않습니다');
    if (!res.ok) throw new Error(`확인 실패 (${res.status})`);
    sessionStorage.setItem('publishKey', password);
    // 사이트 콘텐츠 화면의 관리자 버튼(수정·삭제)도 같이 열리게
    localStorage.setItem('isAdmin', 'true');
}

const Editor: React.FC<{ onExpired: () => void }> = ({ onExpired }) => {
    const authors = useMemo<Author[]>(() => {
        const seen = new Set<string>();
        return [...mockMembers, ...mockContributors]
            .filter((p) => !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()))
            .map((p) => ({ name: p.name, avatarUrl: p.avatarUrl }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, []);
    const [author, setAuthor] = useState<Author>(() => authors[0] ?? { name: '', avatarUrl: '' });
    const [form, setForm] = useState({ title: '', summary: '', content: '' });
    const [thumb, setThumb] = useState<Thumb>({ kind: 'preset', url: PRESETS[0].url });
    const [preview, setPreview] = useState(false);
    const [state, setState] = useState<{ kind: 'idle' } | { kind: 'publishing' } | { kind: 'error'; message: string } | { kind: 'done'; id: string; title: string }>({ kind: 'idle' });
    const onContent = useCallback((content: string) => setForm((f) => ({ ...f, content })), []);

    const missing = [!form.title.trim() && '제목', !form.summary.trim() && '요약', !form.content.trim() && '본문'].filter(Boolean) as string[];

    const publish = async () => {
        if (state.kind === 'publishing') return;
        if (missing.length) {
            setState({ kind: 'error', message: `${missing.join(', ')}을(를) 채워 주세요` });
            return;
        }
        const password = sessionStorage.getItem('publishKey');
        if (!password) return onExpired();
        setState({ kind: 'publishing' });
        try {
            const res = await fetch('/api/research/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, title: form.title.trim(), author: author.name, authorAvatar: author.avatarUrl, category: 'Research', summary: form.summary.trim(), content: form.content, thumbnailUrl: thumb.kind === 'preset' ? thumb.url : '', ...(thumb.kind === 'upload' ? { thumbnailImage: { type: thumb.image.type, data: thumb.image.data } } : {}) }),
            });
            if (res.status === 401) {
                sessionStorage.removeItem('publishKey');
                return onExpired();
            }
            const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string; detail?: string; hint?: string };
            if (!res.ok || !body.id) throw new Error([body.error ?? `발행 실패 (${res.status})`, body.detail, body.hint].filter(Boolean).join(' · '));
            setState({ kind: 'done', id: body.id, title: form.title.trim() });
        } catch (err) {
            setState({ kind: 'error', message: err instanceof Error ? err.message : '발행 실패' });
        }
    };

    if (state.kind === 'done')
        return (
            <div className="mx-auto mt-[10vh] max-w-md text-center">
                <CheckCircle2 className="mx-auto mb-3 text-green-600" size={32} aria-hidden="true" />
                <h1 className="text-lg font-semibold text-theme-text">발행했습니다</h1>
                <p className="mt-2 text-sm text-theme-text-secondary">「{state.title}」를 GitHub에 올렸습니다. 서버가 10분마다 배포하므로 사이트에는 10분 안에 보입니다.</p>
                <div className="mt-6 flex justify-center gap-2">
                    <a href={`/contents/${state.id}`} target="_blank" rel="noreferrer" className="rounded-md border border-theme-border px-3 py-1.5 text-sm text-theme-text hover:bg-theme-surface-hover">
                        글 주소 열기
                    </a>
                    <button
                        onClick={() => {
                            setForm({ title: '', summary: '', content: '' });
                            setThumb({ kind: 'preset', url: PRESETS[0].url });
                            setState({ kind: 'idle' });
                        }}
                        className="rounded-md bg-[#10163A] px-3 py-1.5 text-sm text-white hover:opacity-90"
                    >
                        새 글 쓰기
                    </button>
                </div>
            </div>
        );

    return (
        <>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold text-theme-text">콘텐츠 작성</h1>
                    <p className="text-xs text-theme-text-muted">사이트 콘텐츠(Research)에 올라갑니다. 발행 후 10분 안에 사이트에 반영됩니다.</p>
                </div>
                <div className="flex gap-1.5">
                    <button onClick={() => setPreview((p) => !p)} className="flex items-center gap-1.5 rounded-md border border-theme-border bg-theme-bg px-3 py-1.5 text-[13px] text-theme-text-secondary hover:text-theme-text">
                        {preview ? <PenLine size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                        {preview ? '편집' : '미리보기'}
                    </button>
                    <button
                        onClick={publish}
                        disabled={state.kind === 'publishing'}
                        className="flex items-center gap-1.5 rounded-md bg-[#10163A] px-3.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
                    >
                        {state.kind === 'publishing' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                        {state.kind === 'publishing' ? '발행 중' : '발행'}
                    </button>
                </div>
            </div>

            {state.kind === 'error' && (
                <p role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.message}
                </p>
            )}

            {/* 미리보기 중에도 에디터를 지우지 않는다 (지우면 입력한 본문이 다시 그려지지 않는다) */}
            <div className={preview ? 'hidden' : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]'}>
                <div className="min-w-0 space-y-5">
                    <div>
                        <Label htmlFor="w-title">제목</Label>
                        <input id="w-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${field} text-base font-semibold`} placeholder="글 제목" />
                    </div>
                    <div>
                        <Label htmlFor="w-summary" hint="목록 카드와 검색 결과에 보입니다">
                            요약
                        </Label>
                        <textarea id="w-summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className={`${field} min-h-[72px]`} placeholder="한두 문장" />
                    </div>
                    <div>
                        <span className="mb-1.5 block text-xs font-semibold text-theme-text">본문</span>
                        <div className="rounded-md border border-theme-border px-2 py-3">
                            <BlockNoteEditor theme="light" initialMarkdown={form.content} onChange={onContent} />
                        </div>
                    </div>
                </div>
                <aside className="space-y-5">
                    <div>
                        <Label htmlFor="w-author">작성자</Label>
                        <select id="w-author" value={author.name} onChange={(e) => setAuthor(authors.find((a) => a.name === e.target.value) ?? author)} className={field}>
                            {authors.map((a) => (
                                <option key={a.name} value={a.name}>
                                    {a.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <ThumbnailPicker value={thumb} onChange={setThumb} title={form.title} summary={form.summary} />
                    <p className="text-xs leading-relaxed text-theme-text-muted">카테고리는 Research로 올라갑니다. 발행한 글은 사이트 콘텐츠 화면에서 수정·삭제할 수 있습니다.</p>
                </aside>
            </div>

            {preview && (
                <article className="mx-auto max-w-3xl">
                    <p className="text-xs font-semibold text-theme-text-muted">Research · {author.name}</p>
                    <h1 className="mt-2 text-3xl font-bold text-theme-text">{form.title || '제목 없음'}</h1>
                    <p className="mt-3 text-theme-text-secondary">{form.summary || '요약 없음'}</p>
                    <img src={thumbSrc(thumb)} alt="" className="mt-6 aspect-video w-full rounded-md object-cover" />
                    <div className="prose prose-zinc mt-8 max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.content || '_본문이 비어 있습니다_'}</ReactMarkdown>
                    </div>
                </article>
            )}
        </>
    );
};

const AdminWrite: React.FC = () => {
    usePageMeta({ title: '콘텐츠 작성', description: 'ECK 콘텐츠 작성', noindex: true });
    const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('publishKey'));
    return (
        <AdminShell active="write">
            {authed ? (
                <Editor onExpired={() => setAuthed(false)} />
            ) : (
                <AdminLogin
                    title="콘텐츠 작성"
                    check={async (pw) => {
                        await verify(pw);
                        setAuthed(true);
                    }}
                />
            )}
        </AdminShell>
    );
};

export default AdminWrite;
