/**
 * Claude가 쓴 HTML을 헤드리스 Chrome으로 찍어 콘텐츠 썸네일(1280x720 PNG)을 만든다.
 * 서버 설정: CLAUDE_CODE_OAUTH_TOKEN(claude setup-token), CHROME_PATH(chrome-headless-shell), 한글 글꼴(fonts-noto-cjk).
 */
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cliArgs } from '../../scripts/lib/claude.js';

export const W = 1280;
export const H = 720;
const SYMBOL_SLOT = '<!--ECK_SYMBOL-->';

/** 로고 심볼(원 자리는 마스크 구멍). 모델에게는 자리표시만 주고 실제 SVG는 여기서 넣는다 */
const SYMBOL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 302 458" style="height:100%;width:auto;display:block"><mask id="eckgap"><rect x="-8" y="-8" width="302" height="458" fill="#fff"/><circle cx="143" cy="196" r="81"/></mask><g mask="url(#eckgap)"><polygon fill="#E45C59" points="143,0 0,225 143,297 286,225"/><polygon fill="#A93344" points="143,0 286,225 143,297"/><polygon fill="#3E6BA1" points="5,249 143,321.6 281,249 143,442"/><polygon fill="#344E83" points="281,249 143,321.6 143,442"/></g><circle fill="#344E83" cx="143" cy="196" r="70"/><path fill="#E45C59" transform="rotate(15 143 196)" d="M73 196A70 70 0 0 1 213 196A35 35 0 0 0 143 196A35 35 0 0 1 73 196Z"/></svg>`;

export function buildPrompt(title: string, summary: string, variant: number): string {
  const moods = ['남색 바탕에 큰 제목', '밝은 종이색 바탕의 잡지 표지', '빨강과 남색을 크게 나눈 구성', '파랑 계열 단색에 굵은 타이포그래피'];
  return `ECK(Ethereum Collective Korea) 사이트의 리서치 글 썸네일을 HTML 한 장으로 디자인하라.

글 제목: ${title}
글 요약: ${summary || '(없음)'}

조건:
- 화면 크기는 정확히 ${W}x${H}px. html과 body의 margin은 0, overflow는 hidden.
- CSS는 <style> 한 곳에만. <script>, 외부 URL(글꼴, 이미지, CSS) 금지. 이미지가 필요하면 CSS 도형이나 인라인 SVG로 그린다.
- 글꼴은 font-family: 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif.
- 색은 ECK 로고 색만: 남색 #10163A, 파랑 #344E83 / #3E6BA1, 빨강 #E45C59 / #A93344, 종이색 #F4F1EA, 흰색.
- 로고 심볼이 들어갈 자리에 ${SYMBOL_SLOT} 를 그대로 넣고, 그 부모 요소에 높이를 준다 (심볼 비율은 가로 302 : 세로 458).
- 제목은 원문을 줄여 20자 안팎 한국어로, 크게(64~96px) 두세 줄 이내. 작은 머리글로 "ECK RESEARCH"를 넣어도 된다.
- 이모지, 줄표(—), 그라데이션 남발, 빛 번짐 효과 금지. 평면적이고 단정하게.
- 분위기: ${moods[variant % moods.length]}.

설명 없이 \`\`\`html 코드 블록 하나만 출력하라.`;
}

/** 모델 출력에서 HTML만 꺼내고, 스크립트와 외부 주소를 지운 뒤 심볼을 넣는다 */
export function extractHtml(output: string): string {
  const fenced = /```html\s*([\s\S]*?)```/i.exec(output)?.[1];
  const html = (fenced ?? output).trim();
  if (!/<(html|body|div)[\s>]/i.test(html)) throw new Error('모델이 HTML을 돌려주지 않았습니다');
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(https?:)?\/\/[^\s"')]+/gi, '')
    .replace(SYMBOL_SLOT, SYMBOL)
    .replace(/^/, CSP);
}

/** 스크립트·외부 요청 차단. (Chrome의 스크립트 끄기 옵션은 --screenshot까지 막아 쓸 수 없다) */
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">`;

const run = (cmd: string, args: string[], opts: { input?: string; env?: NodeJS.ProcessEnv; timeout: number }) =>
  new Promise<string>((resolve, reject) => {
    const child = execFile(cmd, args, { env: opts.env, timeout: opts.timeout, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} 실패: ${String(stderr || stdout || err.message).slice(0, 300)}`));
      else resolve(stdout);
    });
    if (opts.input !== undefined) child.stdin?.end(opts.input);
  });

export async function generateHtml(title: string, summary: string, variant: number): Promise<string> {
  const home = process.env.CLAUDE_HOME ?? '/var/lib/ethcollective/claude-home';
  await mkdir(home, { recursive: true });
  const raw = await run('claude', cliArgs(process.env.THUMB_MODEL ?? 'sonnet', undefined, { noTools: true }), {
    input: buildPrompt(title, summary, variant),
    // www-data는 홈이 없어 CLI 설정을 쓸 곳을 따로 준다. 인증은 CLAUDE_CODE_OAUTH_TOKEN
    env: { ...process.env, HOME: home, CLAUDECODE: undefined },
    timeout: 150_000,
  });
  const envelope = JSON.parse(raw) as { result?: string; is_error?: boolean };
  if (envelope.is_error || !envelope.result) throw new Error(`Claude 응답 오류: ${String(envelope.result ?? '빈 응답').slice(0, 200)}`);
  return extractHtml(envelope.result);
}

/** HTML을 PNG로. 네트워크는 막힌 프록시로 보내고, 스크립트는 extractHtml의 CSP가 막는다 (모델이 쓴 HTML을 그대로 믿지 않는다) */
export async function renderPng(html: string): Promise<Buffer> {
  const chrome = process.env.CHROME_PATH;
  if (!chrome) throw new Error('CHROME_PATH가 설정되지 않았습니다');
  const dir = await mkdtemp(join(tmpdir(), 'eck-thumb-'));
  try {
    await writeFile(join(dir, 'in.html'), html);
    await run(
      chrome,
      [
        '--headless',
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--proxy-server=127.0.0.1:9',
        '--proxy-bypass-list=<-loopback>',
        `--user-data-dir=${join(dir, 'profile')}`,
        `--window-size=${W},${H}`,
        `--screenshot=${join(dir, 'out.png')}`,
        `file://${join(dir, 'in.html')}`,
      ],
      { timeout: 30_000 },
    );
    return await readFile(join(dir, 'out.png'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
