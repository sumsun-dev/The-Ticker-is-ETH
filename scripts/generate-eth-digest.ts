/**
 * 이더리움 데일리 다이제스트 생성기.
 * eth-news-inbox.json의 신규 수집분을 Claude가 한국어 편집 콘텐츠로 재작성해
 * src/data/eth-digests.json에 프리펜드한다. ANTHROPIC_API_KEY 없으면 스킵.
 *
 * 편집 원칙: 원문 문장 복사 금지(재작성 요약 + 원문 링크), 사실 전달, 과장 금지.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type { NewsItem } from './lib/eth-news';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const INBOX = path.resolve(process.cwd(), 'src/data/eth-news-inbox.json');
const OUTPUT = path.resolve(process.cwd(), 'src/data/eth-digests.json');
const MAX_INPUT_ITEMS = 80;
const KEEP_DIGESTS = 30;

const DigestSchema = z.object({
  title: z.string(),
  intro: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      items: z.array(
        z.object({
          title: z.string(),
          summary: z.string(),
          url: z.string(),
          source: z.string(),
          date: z.string(),
        }),
      ),
    }),
  ),
});

type Digest = z.infer<typeof DigestSchema> & { date: string };

const SYSTEM_PROMPT = `당신은 ECK(Ethereum Collective Korea)의 데일리 이더리움 다이제스트 편집자입니다.
수집된 뉴스 아이템 목록을 받아 한국어 데일리 다이제스트를 작성합니다.

편집 원칙:
- 모든 요약은 한국어로 재작성합니다. 원문 문장을 그대로 복사하지 않습니다.
- 사실만 전달하고 과장·투자 조언을 하지 않습니다. 수치·발언은 출처를 명시합니다.
- 트윗은 해당 인물의 발언·발표로 처리하고, 확인되지 않은 주장은 "~라는 제보/주장" 형태로 씁니다.
- 코인니스(tg:) 항목은 사실 참고용으로만 사용합니다.
- r/ethereum의 Daily General Discussion 같은 정기 스레드는 제외합니다.

구성:
- title: 그날의 핵심을 담은 한국어 헤드라인 (한 문장, 낚시성 금지)
- intro: 2~3문장의 그날 요약
- sections: "프로토콜 · 리서치", "생태계 · 보안", "시장 브리핑" 3개 (해당 항목이 없으면 그 섹션 생략)
- 전체 6~12개 항목. 각 항목: 한국어 헤드라인 title, 2~3문장 summary, 원문 url, source 라벨(예: ethresear.ch, EF Blog, @handle), date(YYYY-MM-DD)
- 중요도 순으로 배치: 프로토콜 변화 > 보안 > 생태계 > 시장`;

function todayKst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[SKIP] ANTHROPIC_API_KEY not set — digest generation skipped');
    return;
  }

  const inbox = JSON.parse(fs.readFileSync(INBOX, 'utf-8')) as { items: NewsItem[] };
  const existing = fs.existsSync(OUTPUT)
    ? (JSON.parse(fs.readFileSync(OUTPUT, 'utf-8')) as { digests: Digest[] })
    : { digests: [] };

  const today = todayKst();
  if (existing.digests.some((d) => d.date === today)) {
    console.log(`[SKIP] digest for ${today} already exists`);
    return;
  }

  // 마지막 다이제스트 이후(없으면 36시간) 신규 아이템만, RT·정기 스레드 제외
  const lastDate = existing.digests[0]?.date;
  const cutoff = lastDate
    ? new Date(`${lastDate}T00:00:00+09:00`).getTime()
    : Date.now() - 36 * 3_600_000;
  const candidates = inbox.items
    .filter((item) => new Date(item.publishedAt).getTime() >= cutoff)
    .filter((item) => !item.summary.startsWith('RT @'))
    .filter((item) => !item.title.startsWith('Daily General Discussion'))
    .slice(0, MAX_INPUT_ITEMS);

  if (candidates.length < 3) {
    console.log(`[SKIP] only ${candidates.length} new items — not enough for a digest`);
    return;
  }

  const itemLines = candidates
    .map(
      (item) =>
        `[${item.source} | ${item.publishedAt.slice(0, 10)}] ${item.title}\n` +
        `  요약: ${item.summary.slice(0, 250)}\n  URL: ${item.url}`,
    )
    .join('\n\n');

  console.log(`Generating digest for ${today} from ${candidates.length} items...`);
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `오늘 날짜: ${today}\n\n수집된 아이템:\n\n${itemLines}`,
      },
    ],
    output_config: { format: zodOutputFormat(DigestSchema) },
  });

  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    console.warn('[WARN] digest generation failed (refusal or parse failure) — skipped');
    return;
  }

  const digest: Digest = { date: today, ...response.parsed_output };
  const digests = [digest, ...existing.digests].slice(0, KEEP_DIGESTS);
  fs.writeFileSync(OUTPUT, JSON.stringify({ digests }, null, 2), 'utf-8');
  console.log(`Written digest "${digest.title}" (${digest.sections.length} sections) to ${OUTPUT}`);
}

main().catch((error) => {
  console.warn('[WARN] generate-eth-digest failed:', error instanceof Error ? error.message : error);
  process.exit(0);
});
