// VPS용 단일 API 서버 — Vercel serverless 핸들러 3개를 node:http로 그대로 서빙.
// 빌드: npx esbuild server/index.ts --bundle --platform=node --target=node20 --format=esm --outfile=dist-server/api.mjs
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import verifyHandler from '../api/auth/verify.js';
import publishHandler from '../api/research/publish.js';
import deleteHandler from '../api/research/delete.js';

const PORT = Number(process.env.PORT) || 3001;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // publish content 최대 200k자 + JSON 오버헤드 여유

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

const routes: Record<string, Handler> = {
  '/api/auth/verify': verifyHandler as Handler,
  '/api/research/publish': publishHandler as Handler,
  '/api/research/delete': deleteHandler as Handler,
};

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Vercel 핸들러가 기대하는 req.body / res.status().json() 만 얹어주는 최소 shim
function toVercelRes(res: ServerResponse): VercelResponse {
  const v = res as VercelResponse;
  v.status = (code: number) => {
    res.statusCode = code;
    return v;
  };
  v.json = (obj: unknown) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return v;
  };
  return v;
}

const server = createServer(async (req, res) => {
  const url = (req.url ?? '').split('?')[0];
  const handler = routes[url];
  const vres = toVercelRes(res);

  if (!handler) {
    return vres.status(404).json({ error: 'Not found' });
  }

  try {
    const vreq = req as VercelRequest;
    vreq.body = await readBody(req);
    await handler(vreq, vres);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Bad request';
    if (msg === 'Payload too large') return vres.status(413).json({ error: msg });
    if (msg === 'Invalid JSON') return vres.status(400).json({ error: msg });
    console.error('[SERVER ERROR]', error);
    if (!res.headersSent) vres.status(500).json({ error: 'Internal server error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.error(`[ethcollective-api] listening on 127.0.0.1:${PORT}`);
});
