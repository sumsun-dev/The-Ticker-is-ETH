/**
 * 여러 프로세스가 같은 JSON 파일에 기록을 쌓을 때: 잠금(디렉터리 생성은 원자적) → 최신 파일을 다시 읽어 합침 → 쓰기 → 해제.
 * EIP·ERC 해설 배치를 작업자 여럿으로 나눠 돌릴 때 서로의 기록을 덮어쓰지 않게 한다.
 */
import fs from 'fs';

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function updateJsonLocked<T>(file: string, update: (current: T) => T, timeoutMs = 60_000): T {
  const lock = `${file}.lock`;
  const started = Date.now();
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // 죽은 작업자가 남긴 잠금은 2분 지나면 걷어 낸다
      if (Date.now() - fs.statSync(lock).mtimeMs > 120_000) fs.rmSync(lock, { recursive: true, force: true });
      if (Date.now() - started > timeoutMs) throw new Error(`${file} 잠금을 얻지 못했습니다`);
      sleep(100);
    }
  }
  try {
    const next = update(JSON.parse(fs.readFileSync(file, 'utf-8')) as T);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
    fs.renameSync(tmp, file);
    return next;
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

/** "1/3" → 0번부터 센 순번 i, 전체 n. 없으면 나누지 않음 */
export function parseShard(s: string | undefined): { i: number; n: number } {
  const m = /^(\d+)\/(\d+)$/.exec(s ?? '');
  if (!m) return { i: 0, n: 1 };
  const i = Number(m[1]) - 1;
  const n = Number(m[2]);
  if (n < 1 || i < 0 || i >= n) throw new Error(`SHARD 값이 이상합니다: ${s} (예: 1/2)`);
  return { i, n };
}

export const inShard = <T,>(xs: T[], shard: { i: number; n: number }): T[] => xs.filter((_, k) => k % shard.n === shard.i);
