/**
 * 지난 글 주 1회 사실 점검 CLI. 최근 7일 다이제스트·논쟁·콜을 원문과 대조해 .cache/weekly-factcheck.txt 에 쓴다 (문제 없으면 파일 삭제).
 * 데이터 파일은 읽기만 한다. 사용: npx tsx scripts/audit-weekly-facts.ts [--since YYYY-MM-DD] [--dry]
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'node:child_process';
import { runClaude } from './lib/claude';
import { forkcastArtifactBase } from './lib/eth-news';
import { collectTargets, daysBefore, formatReport, mergeInboxVersions, weeklyFactcheck, type FetchCallSource } from './lib/weekly-factcheck';

const DATA = path.resolve(process.cwd(), 'src/data');
const CACHE = path.resolve(process.cwd(), '.cache');
const read = <T>(file: string, key: string | null): T => {
  const j = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf-8'));
  return (key ? j[key] : j) as T;
};

const MAX_COMMITS = 60;
// ponytail: e91750c(글쓴이 교정, 2026-11-16) 이전 인박스는 답글 author·url 핸들이 틀려 오탐을 낸다. 한 주 지나면 자연히 무의미
const INBOX_TRUSTED_FROM = '2026-11-16T08:30:00Z';
const INBOX = 'src/data/eth-news-inbox.json';
const git = (...a: string[]): string => execFileSync('git', a, { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });

/** 인박스는 900건 상한이라 지난 호 원문이 빠진다. 현재 파일 + 기간 중 커밋 버전을 합친다 (최신 우선) */
function inboxHistory(since: string): ReturnType<typeof mergeInboxVersions> {
  const versions: unknown[] = [JSON.parse(fs.readFileSync(path.join(DATA, 'eth-news-inbox.json'), 'utf-8'))];
  try {
    const shas = git('log', `--since=${[daysBefore(since, 1), INBOX_TRUSTED_FROM].sort().pop()}`, '--format=%H', '--', INBOX).split('\n').filter(Boolean).slice(0, MAX_COMMITS);
    for (const sha of shas) {
      try {
        versions.push(JSON.parse(git('show', `${sha}:${INBOX}`)));
      } catch {
        // 깨진 버전은 건너뜀
      }
    }
  } catch {
    // git 이력을 못 읽으면 현재 인박스만 쓴다
  }
  return mergeInboxVersions(versions);
}

const fetchCallSource: FetchCallSource = async (c) => {
  const cached = path.join(CACHE, 'forkcast', `${c.id}-tldr.json`);
  let text: string | null = fs.existsSync(cached) ? fs.readFileSync(cached, 'utf-8') : null;
  if (!text) {
    const res = await fetch(`${forkcastArtifactBase({ ...c, url: '', title: '' })}/tldr.json`).catch(() => null);
    text = res?.ok ? await res.text() : null;
  }
  if (!text) return null;
  const hl = (JSON.parse(text) as { highlights?: Record<string, { highlight: string }[]> }).highlights ?? {};
  return Object.values(hl).flat().map((h) => `- ${h.highlight}`).join('\n') || null;
};

async function main() {
  const args = process.argv.slice(2);
  const today = new Date().toISOString().slice(0, 10);
  const si = args.indexOf('--since');
  const since = si >= 0 ? args[si + 1] : daysBefore(today, 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error('--since YYYY-MM-DD');
  const dry = args.includes('--dry');

  const targets = await collectTargets(
    {
      digests: read('eth-digests.json', 'digests'),
      debates: read('eth-debates.json', 'debates'),
      calls: read('eth-calls.json', 'calls'),
      inbox: inboxHistory(since),
    },
    since,
    today,
    fetchCallSource,
  );
  const withSource = targets.filter((t) => t.source.trim()).length;
  console.log(`weekly factcheck ${since} ~ ${today}: ${targets.length} targets, ${withSource} with source`);
  if (dry) return;

  const model = process.env.WEEKLY_CHECK_MODEL ?? 'sonnet';
  const report = formatReport(weeklyFactcheck(targets, since, today, (p) => runClaude(p, model)));
  const file = path.join(CACHE, 'weekly-factcheck.txt');
  if (report) {
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, `${report}\n`, 'utf-8');
    console.log(report);
  } else {
    fs.rmSync(file, { force: true });
    console.log('no issues');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
