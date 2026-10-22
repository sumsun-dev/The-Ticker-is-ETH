import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFile } from 'node:fs/promises';
import { checkAdmin } from '../_lib/auth.js';

/** 관리자 성과 대시보드 데이터. scripts/local/weekly-stats.ts가 매주 올리는 파일을 관리자 비밀번호 확인 후 그대로 내준다 */
const STATS_FILE = process.env.STATS_FILE ?? '/var/lib/ethcollective/stats-history.json';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = checkAdmin((req.body as { password?: unknown }).password);
  if (result === 'misconfigured') return res.status(500).json({ error: 'Server misconfigured' });
  if (result === 'invalid') return res.status(401).json({ error: 'Invalid password' });

  try {
    const raw = await readFile(STATS_FILE, 'utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(raw);
  } catch {
    return res.status(404).json({ error: 'No stats yet' });
  }
}
