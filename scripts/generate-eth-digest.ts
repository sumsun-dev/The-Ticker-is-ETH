/**
 * 이더리움 데일리 다이제스트 생성기 — Claude Code 헤드리스 모드.
 * eth-news-inbox.json의 신규 수집분을 `claude -p`(구독 인증, API 키 불필요)로
 * 한국어 편집 콘텐츠로 재작성해 src/data/eth-digests.json에 프리펜드한다.
 *
 * 실행 환경: claude CLI가 로그인된 곳(VPS 크론 또는 로컬). GH Actions에서는 돌지 않는다.
 * 편집 원칙: 원문 문장 복사 금지(재작성 요약 + 원문 링크), 사실 전달, 과장 금지.
 */
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { detectDebates, type NewsItem } from './lib/eth-news';

const INBOX = path.resolve(process.cwd(), 'src/data/eth-news-inbox.json');
const OUTPUT = path.resolve(process.cwd(), 'src/data/eth-digests.json');
const MAX_INPUT_ITEMS = 120;
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
          why: z.string(),
          url: z.string(),
          source: z.string(),
          date: z.string(),
        }),
      ),
    }),
  ),
});

export type Digest = z.infer<typeof DigestSchema> & {
  date: string;
  telegramMessageId?: number;
  coverImage?: string;
};

const EDITOR_PROMPT = `당신은 ECK(Ethereum Collective Korea)의 데일리 이더리움 다이제스트 수석 편집자입니다.
독자는 이더리움 생태계를 진지하게 따라가는 한국어 사용자(리서처·빌더·투자자)입니다.
아래 수집된 뉴스 아이템 목록으로 전문성 있는 한국어 데일리 다이제스트를 작성하세요.

편집 원칙:
- 모든 요약은 한국어로 재작성합니다. 원문 문장을 그대로 복사하지 않습니다.
- 사실만 전달하고 과장·투자 조언을 하지 않습니다. 수치·발언은 출처를 명시합니다.
- 전문 용어는 정확하게: 통용되는 한국어 표기를 쓰고, 처음 등장하는 핵심 용어는 원어를 병기합니다.
- 기술 맥락을 붙입니다: 관련 EIP·업그레이드·선행 논의와 연결해 "무엇이 어디서 이어지는 이야기인지"를 보여줍니다.
- 트윗은 해당 인물의 발언·발표로 처리하고, 확인되지 않은 주장은 "~라는 제보/주장" 형태로 씁니다.
- 코인니스(tg:) 항목은 사실 참고용으로만 사용합니다.
- r/ethereum의 Daily General Discussion 같은 정기 스레드는 제외합니다.

논쟁 · 담론 파악 (중요):
- 입력에 "감지된 대화 클러스터"가 있으면 — 같은 스레드에서 여러 인물이 직접 주고받은 설전입니다.
- 클러스터가 없어도, 서로 다른 인물들이 같은 쟁점(특정 EIP, 업그레이드, 프로토콜 설계, 사건)에 대해
  각자 트윗으로 입장을 낸 경우를 주제 단위로 묶으세요. 직접 대화가 없어도 담론입니다.
- 위 두 경우가 있으면 "오늘의 논쟁 · 담론" 섹션을 만들고(프로토콜 섹션 다음 배치), 항목마다:
  - title: 쟁점을 담은 헤드라인
  - summary: 참여자별 입장을 압축 정리 (누가 어떤 논거로 어떤 입장인지, 전개 순서대로)
  - why: 이 논쟁이 생태계에 갖는 함의
  - url: 가장 대표적인 트윗/스레드 링크
- 단순 홍보·잡담·인사 교환은 논쟁이 아닙니다. 쟁점이 분명한 것만.

구성:
- title: 그날의 핵심을 담은 한국어 헤드라인 (한 문장, 낚시성 금지)
- intro: 3~4문장 — 그날의 개별 소식들을 관통하는 흐름을 짚는 에디터 노트
- sections: "프로토콜 · 리서치", "오늘의 논쟁 · 담론"(해당 시), "생태계 · 보안", "시장 브리핑" (해당 항목이 없으면 그 섹션 생략)
- 전체 6~12개 항목. 각 항목:
  - title: 한국어 헤드라인
  - summary: 3~4문장 — 사실 + 기술 맥락 + 구체적 수치
  - why: "왜 중요한가" 한 문장 — 이더리움 생태계 관점의 함의 (투자 조언 금지)
  - url, source 라벨(예: ethresear.ch, EF Blog, @handle), date(YYYY-MM-DD)
- 중요도 순으로 배치: 프로토콜 변화 > 보안 > 생태계 > 시장

응답은 아래 형태의 JSON 하나만 출력하세요. 코드펜스·설명 없이 JSON만:
{"title": "...", "intro": "...", "sections": [{"heading": "...", "items": [{"title": "...", "summary": "...", "why": "...", "url": "...", "source": "...", "date": "YYYY-MM-DD"}]}]}`;

function todayKst(): string {
  return process.env.DIGEST_DATE ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

/** 헤드리스 응답에서 JSON만 추출 (혹시 붙은 코드펜스 제거) */
function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in response');
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function main() {
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

  // 스레드 설전 클러스터는 별도 블록으로, 나머지는 평면 목록으로 전달
  const debates = detectDebates(candidates);
  const debateItemIds = new Set(debates.flatMap((d) => d.items.map((item) => item.id)));
  const flatItems = candidates.filter((item) => !debateItemIds.has(item.id));

  const itemLines = flatItems
    .map(
      (item) =>
        `[${item.source} | ${item.publishedAt.slice(0, 10)}] ${item.title}\n` +
        `  요약: ${item.summary.slice(0, 250)}\n  URL: ${item.url}`,
    )
    .join('\n\n');

  const debateLines = debates
    .slice(0, 8)
    .map(
      (d, i) =>
        `### 클러스터 ${i + 1} — 참여: ${d.participants.map((p) => `@${p}`).join(', ')}\n` +
        d.items
          .map((item) => `  [@${item.author} | ${item.publishedAt.slice(5, 16)}] ${item.summary.slice(0, 300)}\n    URL: ${item.url}`)
          .join('\n'),
    )
    .join('\n\n');

  const prompt =
    `${EDITOR_PROMPT}\n\n오늘 날짜: ${today}\n\n` +
    (debateLines ? `감지된 대화 클러스터 (같은 스레드에서 오간 설전):\n\n${debateLines}\n\n` : '') +
    `수집된 아이템:\n\n${itemLines}`;

  console.log(`Generating digest for ${today} from ${candidates.length} items (headless claude)...`);
  const raw = execFileSync('claude', ['-p', prompt, '--output-format', 'json', '--model', 'opus'], {
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  });

  const envelope = JSON.parse(raw) as { result?: string; is_error?: boolean };
  if (envelope.is_error || !envelope.result) throw new Error('headless claude returned an error');

  const parsed = DigestSchema.parse(extractJson(envelope.result));
  const digest: Digest = { date: today, ...parsed };
  const digests = [digest, ...existing.digests].slice(0, KEEP_DIGESTS);
  fs.writeFileSync(OUTPUT, JSON.stringify({ digests }, null, 2), 'utf-8');
  console.log(`Written digest "${digest.title}" (${digest.sections.length} sections) to ${OUTPUT}`);
}

main().catch((error) => {
  console.warn('[WARN] generate-eth-digest failed:', error instanceof Error ? error.message : error);
  process.exit(0);
});
