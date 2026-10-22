import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkAdmin } from '../_lib/auth.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body as { password?: string };

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const result = checkAdmin(password);
  if (result === 'misconfigured') {
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  if (result === 'ok') {
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: 'Invalid password' });
}
