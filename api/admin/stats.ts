import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFile } from 'node:fs/promises';
import { checkAdmin } from '../_lib/auth.js';

/** 관리자 성과 대시보드 데이터. scripts/local/weekly-stats.ts가 매주 올리는 파일을 관리자 비밀번호 확인 후 그대로 내준다 */
const STATS_FILE = process.env.STATS_FILE ?? '/var/lib/ethcollective/stats-history.json';
/** 서버 cron(deploy/tg-subscribers.mjs)이 매일 쌓는 구독자. 없거나 깨져도 주간 기록은 그대로 내준다 */
const TG_DAILY_FILE = process.env.TG_DAILY_FILE ?? '/var/lib/ethcollective/tg-daily.json';

async function tgDaily(): Promise<unknown[] | undefined> {
  try {
    const list: unknown = JSON.parse(await readFile(TG_DAILY_FILE, 'utf-8'));
    return Array.isArray(list) ? list : undefined;
  } catch {
    return undefined;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = checkAdmin((req.body as { password?: unknown }).password);
  if (result === 'misconfigured') return res.status(500).json({ error: 'Server misconfigured' });
  if (result === 'invalid') return res.status(401).json({ error: 'Invalid password' });

  try {
    const raw = await readFile(STATS_FILE, 'utf-8');
    const daily = await tgDaily();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(daily ? JSON.stringify({ ...(JSON.parse(raw) as object), tgDaily: daily }) : raw);
  } catch {
    return res.status(404).json({ error: 'No stats yet' });
  }
}
