import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkAdmin } from '../_lib/auth.js';
import { generateHtml, renderPng } from '../_lib/thumbnail.js';

/** 한 번에 하나만 (Claude 호출과 Chrome이 서버 메모리를 꽤 쓴다) */
let busy = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password, title, summary, variant } = (req.body ?? {}) as { password?: string; title?: string; summary?: string; variant?: number };
  if (!password || checkAdmin(password) !== 'ok') return res.status(401).json({ error: 'Invalid password' });
  if (!title?.trim() || title.length > 300 || (summary?.length ?? 0) > 2000) return res.status(400).json({ error: '제목을 확인해 주세요' });
  // Claude 인증은 CLAUDE_CODE_OAUTH_TOKEN이나 CLAUDE_HOME의 로그인 정보로 한다. Chrome은 꼭 있어야 한다
  if (!process.env.CHROME_PATH) return res.status(503).json({ error: '서버에 썸네일 생성 설정이 아직 없습니다' });
  if (busy) return res.status(429).json({ error: '다른 썸네일을 만드는 중입니다. 잠시 뒤 다시 눌러 주세요' });

  busy = true;
  try {
    const html = await generateHtml(title.trim(), (summary ?? '').trim(), Number.isInteger(variant) ? (variant as number) : 0);
    const png = await renderPng(html);
    return res.status(200).json({ type: 'image/png', data: png.toString('base64') });
  } catch (error) {
    console.error('[THUMBNAIL ERROR]', error);
    return res.status(500).json({ error: '썸네일을 만들지 못했습니다', detail: (error instanceof Error ? error.message : '').slice(0, 200) });
  } finally {
    busy = false;
  }
}
