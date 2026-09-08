/**
 * 다이제스트 커버 이미지 렌더러 — HTML 카드를 헤드리스 크로미엄으로 PNG(1200×630) 캡처.
 * ai-secondbrain 카드뉴스와 동일한 스택(playwright-core + 외부 크로미엄 바이너리).
 *
 * 출력: public/assets/digests/{date}.png + 다이제스트에 coverImage 경로 기록.
 * 크로미엄: CHROMIUM_PATH → ~/.cache/ms-playwright → macOS Chrome → 리눅스 시스템 경로.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { renderCover } from './lib/cover';
import * as path from 'path';
import type { Digest } from './generate-eth-digest';

const DIGESTS = path.resolve(process.cwd(), 'src/data/eth-digests.json');
const OUT_DIR = path.resolve(process.cwd(), 'public/assets/digests');

async function main() {
  const data = JSON.parse(readFileSync(DIGESTS, 'utf-8')) as { digests: Digest[] };
  const digest = process.env.DIGEST_DATE
    ? data.digests.find((d) => d.date === process.env.DIGEST_DATE)
    : data.digests[0];
  if (!digest) {
    console.log('[SKIP] no digest to render');
    return;
  }

  const outFile = path.join(OUT_DIR, `${digest.date}.png`);
  const publicPath = `/assets/digests/${digest.date}.png`;
  if (digest.coverImage?.startsWith(publicPath) && existsSync(outFile)) {
    console.log(`[SKIP] cover for ${digest.date} already rendered`);
    return;
  }

  const ok = await renderCover({ headline: digest.shortTitle ?? digest.title, subTitle: digest.subTitle }, outFile);
  if (!ok) return;

  // 같은 파일명 덮어쓰기 시 CDN/브라우저 캐시 무효화를 위해 콘텐츠 해시 쿼리를 붙인다
  const hash = createHash('md5').update(readFileSync(outFile)).digest('hex').slice(0, 8);
  digest.coverImage = `${publicPath}?v=${hash}`;
  writeFileSync(DIGESTS, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Rendered cover ${outFile} and linked as ${publicPath}`);
}

main().catch((error) => {
  console.warn('[WARN] render-digest-cover failed:', error instanceof Error ? error.message : error);
  process.exit(0);
});
