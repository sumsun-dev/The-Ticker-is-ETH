/**
 * EIP·ERC 해설과 발언자 소속 사실 점검 CLI (3단계). 판정만 하고 데이터 파일은 읽기만 한다.
 * 결과: .cache/standards-factcheck.txt (문제 없으면 삭제, 3500자 안), .cache/standards-factcheck.json (전체 결과)
 * 사용: npx tsx scripts/audit-standards-facts.ts [--since YYYY-MM-DD] [--all] [--dry] [--only eips|speakers]
 *   기본은 최근 7일 새로 쓴 해설, 새로 생긴 handle·바뀐 소속(.cache/speaker-seen.json 과 비교). --all 이면 전부.
 *   env: STANDARDS_CHECK_MODEL(기본 sonnet)
 */
import * as fs from 'fs';
import * as path from 'path';
import { runClaude } from './lib/claude';
import {
  composeReport,
  metaMismatches,
  mismatchItem,
  selectStandards,
  standardsFactcheck,
  stdIssueItem,
  type MetaMismatch,
  type ReportItem,
  type StdKind,
  type StdRec,
  type StdTarget,
} from './lib/standards-factcheck';
import { collectAffiliations, conflictBlock, conflicts, nextSeen, pickChanged, speakerFactcheck, speakerIssueBlock, type Seen, type SpeakerData } from './lib/speaker-factcheck';
import { daysBefore } from './lib/weekly-factcheck';

const DATA = path.resolve(process.cwd(), 'src/data');
const CACHE = path.resolve(process.cwd(), '.cache');
const CACHE_HOURS = 20;
const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf-8')) as T;

/** 원문 마크다운 (extract-eips 의 캐시를 재사용). EIP 저장소에 없으면 ERC 저장소. 못 받으면 오래된 캐시, 그것도 없으면 null */
export async function fetchSource(n: number, kind: StdKind, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const dir = path.join(CACHE, kind === 'EIP' ? 'eips' : 'ercs');
  const cached = path.join(dir, `${n}.md`);
  const have = fs.existsSync(cached);
  if (have && Date.now() - fs.statSync(cached).mtimeMs < CACHE_HOURS * 3600e3) return fs.readFileSync(cached, 'utf-8') || null;
  const stale = have ? fs.readFileSync(cached, 'utf-8') || null : null;
  for (const url of [`https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-${n}.md`, `https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-${n}.md`]) {
    try {
      const r = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
      if (r.ok) {
        const text = await r.text();
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(cached, text, 'utf-8');
        return text || null;
      }
      if (r.status !== 404) return stale; // 일시 오류
    } catch {
      return stale;
    }
  }
  return stale;
}

async function main() {
  const args = process.argv.slice(2);
  const today = new Date().toISOString().slice(0, 10);
  const si = args.indexOf('--since');
  const since = si >= 0 ? args[si + 1] : daysBefore(today, 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error('--since YYYY-MM-DD');
  const all = args.includes('--all');
  const dry = args.includes('--dry');
  const oi = args.indexOf('--only');
  const only = oi >= 0 ? args[oi + 1] : '';
  if (only && only !== 'eips' && only !== 'speakers') throw new Error('--only eips|speakers');
  const model = process.env.STANDARDS_CHECK_MODEL ?? 'sonnet';
  const ask = (p: string) => runClaude(p, model);

  const items: ReportItem[] = [];
  const failures: string[] = [];
  const heads: string[] = [];
  const full: Record<string, unknown> = { since, today, all };

  if (only !== 'speakers') {
    const recs: { kind: StdKind; rec: StdRec }[] = [
      ...selectStandards(readJson<{ eips: StdRec[] }>('eips.json').eips, since, all).map((rec) => ({ kind: 'EIP' as const, rec })),
      ...selectStandards(readJson<{ ercs: StdRec[] }>('ercs.json').ercs, since, all).map((rec) => ({ kind: 'ERC' as const, rec })),
    ];
    const targets: StdTarget[] = [];
    const mismatches: MetaMismatch[] = [];
    for (const { kind, rec } of recs) {
      const markdown = (await fetchSource(rec.number, kind)) ?? '';
      targets.push({ kind, rec, markdown });
      if (markdown) mismatches.push(...metaMismatches(kind, rec, markdown));
    }
    const withSource = targets.filter((t) => t.markdown.trim()).length;
    console.log(
      `standards: EIP ${recs.filter((r) => r.kind === 'EIP').length} · ERC ${recs.filter((r) => r.kind === 'ERC').length} 해설, 원문 ${withSource}개, 메타 불일치 ${mismatches.length}건`,
    );
    items.push(...mismatches.map(mismatchItem));
    full.mismatches = mismatches;
    if (!dry) {
      const r = standardsFactcheck(targets, ask);
      items.push(...r.issues.map(stdIssueItem));
      failures.push(...r.failures);
      heads.push(`EIP·ERC 해설 ${recs.length}건 중 검사 ${r.checked}건 · 원문 없어 보류 ${r.held}건`);
      full.standards = r;
    }
  }

  if (only !== 'eips') {
    const data: SpeakerData = {
      callSpeakers: readJson<{ speakers: SpeakerData['callSpeakers'] }>('call-speakers.json').speakers,
      debates: readJson<{ debates: SpeakerData['debates'] }>('eth-debates.json').debates,
      calls: readJson<{ calls: SpeakerData['calls'] }>('eth-calls.json').calls,
      profiles: readJson<SpeakerData['profiles']>('x-profiles.json'),
    };
    const rows = collectAffiliations(data);
    const clash = conflicts(rows);
    const seenFile = path.join(CACHE, 'speaker-seen.json');
    const seen: Seen = fs.existsSync(seenFile) ? (JSON.parse(fs.readFileSync(seenFile, 'utf-8')) as Seen) : {};
    const toCheck = all ? rows : pickChanged(rows, seen);
    console.log(`speakers: handle ${rows.length}명, 소속 엇갈림 ${clash.length}건, 모델 대조 대상 ${toCheck.length}명`);
    items.push(...clash.map((r) => ({ grade: 'mech' as const, block: conflictBlock(r) })));
    full.conflicts = clash.map((r) => ({ handle: r.handle, values: Object.fromEntries(r.values) }));
    if (!dry) {
      const r = speakerFactcheck(toCheck, data.profiles, ask);
      const byHandle = new Map(rows.map((x) => [x.handle.toLowerCase(), x]));
      items.push(...r.issues.map((i) => ({ grade: i.grade, block: speakerIssueBlock(i, byHandle.get(i.handle.toLowerCase())) })));
      failures.push(...r.failures);
      heads.push(`발언자 ${rows.length}명 중 대조 ${r.checked}명 · bio 없어 보류 ${r.held}명`);
      full.speakers = r;
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(seenFile, JSON.stringify(nextSeen(rows, seen, r.failedHandles), null, 1), 'utf-8');
    }
  }
  if (dry) return;

  const head = `${all ? '전체' : `${since} ~ ${today}`} · ${heads.join(' · ')} · 문제 ${items.length}건`;
  const report = composeReport(head, items, failures);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(path.join(CACHE, 'standards-factcheck.json'), JSON.stringify({ ...full, items, failures }, null, 1), 'utf-8');
  const file = path.join(CACHE, 'standards-factcheck.txt');
  if (report) {
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
