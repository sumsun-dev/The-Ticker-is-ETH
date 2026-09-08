/**
 * X 프로필 캐시 동기화 — 워치리스트(scripts/config/twitter-accounts.json)와 콜 발언자 명단(src/data/call-speakers.json)의
 * 핸들 중 src/data/x-profiles.json에 없는 것을 screenname.php로 채운다 (이름·아바타·팔로워·바이오).
 * 멱등: 이미 있는 핸들은 건너뛴다. 러너에서 논쟁 추출 전에 돌려 새 워치리스트 계정의 아바타를 미리 받아 둔다.
 */
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import type { XProfile } from './lib/eth-debates';
import { fetchProfiles, makeXApi } from './lib/x-api';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PROFILES = path.resolve(process.cwd(), 'src/data/x-profiles.json');
const ACCOUNTS = path.resolve(process.cwd(), 'scripts/config/twitter-accounts.json');
const SPEAKERS = path.resolve(process.cwd(), 'src/data/call-speakers.json');

function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf-8')) as T) : fallback;
}

async function main() {
  const xApi = makeXApi();
  if (!xApi) return;
  const profiles = readJson<Record<string, XProfile>>(PROFILES, {});
  const accounts = readJson<{ accounts: Array<{ screenname: string }> }>(ACCOUNTS, { accounts: [] }).accounts.map((a) => a.screenname);
  const speakers = Object.values(readJson<{ speakers: Record<string, { handle?: string }> }>(SPEAKERS, { speakers: {} }).speakers)
    .map((s) => s.handle ?? '')
    .filter(Boolean);
  const missing = [...new Set([...accounts, ...speakers].map((h) => h.toLowerCase()))].filter((h) => !profiles[h]);
  if (missing.length === 0) {
    console.log('[SKIP] all watchlist and speaker profiles cached');
    return;
  }
  console.log(`Fetching ${missing.length} profiles: ${missing.join(', ')}`);
  await fetchProfiles(missing, profiles, xApi, true);
  fs.writeFileSync(PROFILES, JSON.stringify(profiles, null, 2) + '\n');
  const still = missing.filter((h) => !profiles[h]);
  console.log(`  added ${missing.length - still.length}${still.length ? `, not found: ${still.join(', ')}` : ''}`);
}

main().catch((error) => {
  console.warn('[WARN] sync-x-profiles failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
