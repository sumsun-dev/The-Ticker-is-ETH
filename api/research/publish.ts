import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, timingSafeEqual } from 'crypto';
import { getFileContent, createFile, updateFile, deleteFile } from '../_lib/github.js';

interface PublishBody {
  password: string;
  title: string;
  author: string;
  authorAvatar: string;
  category: string;
  summary: string;
  content: string;
  thumbnailUrl: string;
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function generateId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const hex = randomBytes(4).toString('hex');
  return `research-${dateStr}-${hex}`;
}

function estimateReadTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as PublishBody;

  if (!body.password || !body.title || !body.content || !body.author) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const publishPassword = process.env.PUBLISH_PASSWORD;
  if (!publishPassword || !safeCompare(body.password, publishPassword)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const id = generateId();
  const articlePath = `src/data/articles/${id}.md`;
  const indexPath = 'src/data/research-index.json';
  let articleCreated = false;

  try {
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

    // 1. Create article markdown file
    await createFile(
      articlePath,
      body.content,
      `docs(research): publish "${body.title}"`,
    );
    articleCreated = true;

    // 2. Update research-index.json
    const indexFile = await getFileContent(indexPath);
    const indexContent = Buffer.from(indexFile.content, 'base64').toString('utf-8');
    const indexData = JSON.parse(indexContent) as Array<Record<string, unknown>>;

    const newEntry = {
      id,
      title: body.title,
      author: body.author,
      authorId: body.author.toLowerCase().replace(/\s+/g, '-'),
      date: dateStr,
      category: body.category || 'Research',
      summary: body.summary,
      content: '',
      thumbnailUrl: body.thumbnailUrl || '',
      readTime: estimateReadTime(body.content),
      authorAvatar: body.authorAvatar,
    };

    indexData.unshift(newEntry);

    await updateFile(
      indexPath,
      JSON.stringify(indexData, null, 2),
      indexFile.sha,
      `docs(research): add index entry for "${body.title}"`,
    );

    return res.status(200).json({ id, ...newEntry });
  } catch (error) {
    console.error('[PUBLISH ERROR]', error);

    // Rollback: orphaned article md (created but index update failed)
    if (articleCreated) {
      try {
        const orphan = await getFileContent(articlePath);
        await deleteFile(
          articlePath,
          orphan.sha,
          `revert(research): rollback orphaned article ${id}`,
        );
        console.error('[PUBLISH ROLLBACK] removed orphaned', articlePath);
      } catch (rollbackErr) {
        console.error('[PUBLISH ROLLBACK FAILED]', rollbackErr);
      }
    }

    const rawDetail = error instanceof Error ? error.message : 'Unknown error';
    const detail = rawDetail.slice(0, 200);
    const hint = /\b401\b|Bad credentials/i.test(rawDetail)
      ? 'GITHUB_PAT may be invalid/expired or have wrong scope. Verify Vercel env (no quotes/whitespace) and the PAT has Contents: Read & Write on this repo.'
      : undefined;

    return res.status(500).json({
      error: 'Publish failed. Please try again.',
      detail,
      ...(hint ? { hint } : {}),
    });
  }
}
